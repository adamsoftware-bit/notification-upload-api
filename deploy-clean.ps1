# Script de despliegue para Windows Server
# Ejecutar como administrador en PowerShell

param(
    [string]$Environment = "production",
    [switch]$Build = $false,
    [switch]$Logs = $false,
    [switch]$Stop = $false,
    [switch]$Clean = $false
)

Write-Host "=== Notification Upload API Deployment Script ===" -ForegroundColor Green
Write-Host ""

# Funcion para verificar si Docker esta corriendo
function Test-DockerRunning {
    try {
        docker version > $null 2>&1
        return $true
    }
    catch {
        Write-Host "ERROR: Docker no esta corriendo. Por favor, inicia Docker Desktop." -ForegroundColor Red
        return $false
    }
}

# Funcion para verificar puertos disponibles
function Test-PortAvailable {
    param([int]$Port)
    
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
        return -not $connection.TcpTestSucceeded
    }
    catch {
        return $true
    }
}

# Parar contenedores si se solicita
if ($Stop) {
    Write-Host "Parando contenedores..." -ForegroundColor Yellow
    docker-compose down
    Write-Host "Contenedores detenidos." -ForegroundColor Green
    exit 0
}

# Limpiar contenedores e imagenes si se solicita
if ($Clean) {
    Write-Host "Limpiando contenedores e imagenes..." -ForegroundColor Yellow
    docker-compose down --rmi all --volumes --remove-orphans
    docker system prune -f
    Write-Host "Limpieza completada." -ForegroundColor Green
    exit 0
}

# Mostrar logs si se solicita
if ($Logs) {
    Write-Host "Mostrando logs..." -ForegroundColor Blue
    docker-compose logs -f
    exit 0
}

# Verificar que Docker esta corriendo
Write-Host "Verificando Docker..." -ForegroundColor Blue
if (-not (Test-DockerRunning)) {
    exit 1
}

# Verificar que los puertos estan disponibles
Write-Host "Verificando puertos..." -ForegroundColor Blue
if (-not (Test-PortAvailable -Port 80)) {
    Write-Host "ADVERTENCIA: Puerto 80 esta en uso. Deseas continuar? (s/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne "s" -and $response -ne "S") {
        Write-Host "Operacion cancelada." -ForegroundColor Red
        exit 1
    }
}

if (-not (Test-PortAvailable -Port 3001)) {
    Write-Host "ADVERTENCIA: Puerto 3001 esta en uso. Deseas continuar? (s/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne "s" -and $response -ne "S") {
        Write-Host "Operacion cancelada." -ForegroundColor Red
        exit 1
    }
}

# Verificar que existe el archivo .env
if (-not (Test-Path ".env")) {
    Write-Host "Archivo .env no encontrado. Creando plantilla..." -ForegroundColor Yellow
    @"
# Configuracion del servidor
PORT=3001
NODE_ENV=production
BASE_UPLOAD_DIR=/app/uploads

# Gmail/SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
FROM_EMAIL=tu-email@gmail.com

# Cloudinary Configuration
PRIVATE_CLOUDINARY_CLOUD_NAME=tu-cloud-name
PRIVATE_CLOUDINARY_API_KEY=tu-api-key
PRIVATE_CLOUDINARY_API_SECRET=tu-api-secret

# Supabase Configuration (si es necesario)
SUPABASE_URL=tu-supabase-url
SUPABASE_ANON_KEY=tu-supabase-anon-key
"@ | Out-File -FilePath ".env" -Encoding UTF8
    
    Write-Host "IMPORTANTE: Por favor, edita el archivo .env con tus credenciales antes de continuar." -ForegroundColor Red
    Write-Host "Luego ejecuta el script nuevamente." -ForegroundColor Red
    exit 1
}

# Crear directorio de uploads si no existe
if (-not (Test-Path "uploads")) {
    Write-Host "Creando directorio uploads..." -ForegroundColor Blue
    New-Item -ItemType Directory -Path "uploads" -Force | Out-Null
    New-Item -ItemType Directory -Path "uploads/radicados" -Force | Out-Null
}

# Construir imagen si se solicita
if ($Build) {
    Write-Host "Construyendo imagen Docker..." -ForegroundColor Blue
    docker-compose build --no-cache
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Fallo al construir la imagen" -ForegroundColor Red
        exit 1
    }
    Write-Host "Imagen construida exitosamente." -ForegroundColor Green
}

# Parar contenedores existentes
Write-Host "Parando contenedores existentes..." -ForegroundColor Yellow
docker-compose down

# Iniciar servicios
Write-Host "Iniciando servicios..." -ForegroundColor Green
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== DESPLIEGUE COMPLETADO EXITOSAMENTE ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "URLs disponibles:" -ForegroundColor Cyan
    Write-Host "  - API Backend: http://localhost:3001" -ForegroundColor White
    Write-Host "  - Nginx Proxy: http://localhost" -ForegroundColor White
    Write-Host "  - Health Check: http://localhost/health" -ForegroundColor White
    Write-Host ""
    Write-Host "Comandos utiles:" -ForegroundColor Cyan
    Write-Host "  - Ver logs: docker-compose logs -f" -ForegroundColor White
    Write-Host "  - Parar servicios: docker-compose down" -ForegroundColor White
    Write-Host "  - Ver logs especificos: docker-compose logs notification-api" -ForegroundColor White
    Write-Host ""
    
    # Verificar que los servicios estan corriendo
    Start-Sleep -Seconds 5
    Write-Host "Verificando servicios..." -ForegroundColor Blue
    
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 10
        Write-Host "  [OK] Backend health check" -ForegroundColor Green
    }
    catch {
        Write-Host "  [FAIL] Backend health check - Revisa los logs" -ForegroundColor Yellow
    }
    
    try {
        $null = Invoke-WebRequest -Uri "http://localhost/health" -TimeoutSec 10
        Write-Host "  [OK] Nginx proxy" -ForegroundColor Green
    }
    catch {
        Write-Host "  [FAIL] Nginx proxy - Revisa los logs" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Para conectar tu frontend, usa:" -ForegroundColor Cyan
    Write-Host "  VITE_BACKEND_URL=http://localhost" -ForegroundColor White
    Write-Host ""
    
} else {
    Write-Host ""
    Write-Host "ERROR: Fallo durante el despliegue" -ForegroundColor Red
    Write-Host "Revisa los logs con: docker-compose logs" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
