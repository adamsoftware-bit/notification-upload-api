# Script de despliegue para Windows Server
# Ejecutar como administrador

param(
    [string]$Environment = "production",
    [switch]$Build = $false,
    [switch]$Logs = $false,
    [switch]$Stop = $false,
    [switch]$Clean = $false
)

Write-Host "🚀 Script de despliegue para Notification Upload API" -ForegroundColor Green

# Función para verificar si Docker está corriendo
function Test-DockerRunning {
    try {
        docker version > $null 2>&1
        return $true
    }
    catch {
        Write-Host "❌ Docker no está corriendo. Por favor, inicia Docker Desktop." -ForegroundColor Red
        return $false
    }
}

# Función para verificar puertos disponibles
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
    Write-Host "🛑 Parando contenedores..." -ForegroundColor Yellow
    docker-compose down
    exit 0
}

# Limpiar contenedores e imágenes si se solicita
if ($Clean) {
    Write-Host "🧹 Limpiando contenedores e imágenes..." -ForegroundColor Yellow
    docker-compose down --rmi all --volumes --remove-orphans
    docker system prune -f
    exit 0
}

# Mostrar logs si se solicita
if ($Logs) {
    Write-Host "📋 Mostrando logs..." -ForegroundColor Blue
    docker-compose logs -f
    exit 0
}

# Verificar que Docker está corriendo
if (-not (Test-DockerRunning)) {
    exit 1
}

# Verificar que los puertos están disponibles
Write-Host "🔍 Verificando puertos..." -ForegroundColor Blue
if (-not (Test-PortAvailable -Port 80)) {
    Write-Host "⚠️  Puerto 80 está en uso. ¿Deseas continuar? (s/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne "s" -and $response -ne "S") {
        exit 1
    }
}

if (-not (Test-PortAvailable -Port 3001)) {
    Write-Host "⚠️  Puerto 3001 está en uso. ¿Deseas continuar? (s/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne "s" -and $response -ne "S") {
        exit 1
    }
}

# Verificar que existe el archivo .env
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Archivo .env no encontrado. Creando plantilla..." -ForegroundColor Yellow
    @"
# Configuración del servidor
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
    
    Write-Host "📝 Por favor, edita el archivo .env con tus credenciales antes de continuar." -ForegroundColor Red
    Write-Host "📝 Luego ejecuta el script nuevamente." -ForegroundColor Red
    exit 1
}

# Crear directorio de uploads si no existe
if (-not (Test-Path "uploads")) {
    Write-Host "📁 Creando directorio uploads..." -ForegroundColor Blue
    New-Item -ItemType Directory -Path "uploads" -Force | Out-Null
    New-Item -ItemType Directory -Path "uploads/radicados" -Force | Out-Null
}

# Construir imagen si se solicita
if ($Build) {
    Write-Host "🔨 Construyendo imagen Docker..." -ForegroundColor Blue
    docker-compose build --no-cache
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error al construir la imagen" -ForegroundColor Red
        exit 1
    }
}

# Parar contenedores existentes
Write-Host "🛑 Parando contenedores existentes..." -ForegroundColor Yellow
docker-compose down

# Iniciar servicios
Write-Host "🚀 Iniciando servicios..." -ForegroundColor Green
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Despliegue completado exitosamente!" -ForegroundColor Green
    Write-Host "🌐 API disponible en: http://localhost:3001" -ForegroundColor Cyan
    Write-Host "🌐 Nginx proxy disponible en: http://localhost" -ForegroundColor Cyan
    Write-Host "📋 Para ver logs: docker-compose logs -f" -ForegroundColor Blue
    Write-Host "🛑 Para parar: docker-compose down" -ForegroundColor Blue
    
    # Verificar que los servicios están corriendo
    Start-Sleep -Seconds 5
    Write-Host "🔍 Verificando servicios..." -ForegroundColor Blue
    
    try {
        $healthCheck = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 10
        Write-Host "✅ Backend health check: OK" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Backend health check falló. Revisa los logs." -ForegroundColor Yellow
    }
    
    try {
        $nginxCheck = Invoke-WebRequest -Uri "http://localhost/health" -TimeoutSec 10
        Write-Host "✅ Nginx proxy: OK" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Nginx proxy falló. Revisa los logs." -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Error durante el despliegue" -ForegroundColor Red
    Write-Host "📋 Revisa los logs con: docker-compose logs" -ForegroundColor Blue
    exit 1
}
