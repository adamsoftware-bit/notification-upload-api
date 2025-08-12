@echo off
title Notification Upload API - Deployment Script
echo ===============================================
echo Notification Upload API - Deployment Script
echo ===============================================
echo.

REM Verificar si Docker esta corriendo
docker version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker no esta corriendo. Por favor, inicia Docker Desktop.
    pause
    exit /b 1
)

echo [INFO] Docker verificado correctamente.

REM Verificar si existe .env
if not exist ".env" (
    echo [WARNING] Archivo .env no encontrado.
    echo Copiando plantilla desde .env.example...
    if exist ".env.example" (
        copy ".env.example" ".env"
        echo [INFO] Archivo .env creado desde plantilla.
        echo [IMPORTANT] Por favor edita .env con tus credenciales reales.
        echo Presiona cualquier tecla para continuar cuando hayas editado .env...
        pause
    ) else (
        echo [ERROR] No se encontro .env ni .env.example
        echo Por favor crea un archivo .env con las variables necesarias.
        pause
        exit /b 1
    )
)

REM Crear directorio uploads si no existe
if not exist "uploads" (
    echo [INFO] Creando directorio uploads...
    mkdir "uploads"
    mkdir "uploads\radicados"
)

echo [INFO] Parando contenedores existentes...
docker-compose down

echo [INFO] Iniciando servicios...
docker-compose up -d

if errorlevel 1 (
    echo [ERROR] Fallo al iniciar los servicios.
    echo Revisa los logs con: docker-compose logs
    pause
    exit /b 1
)

echo.
echo ===============================================
echo           DESPLIEGUE COMPLETADO
echo ===============================================
echo.
echo URLs disponibles:
echo   - API Backend: http://localhost:3001
echo   - Nginx Proxy: http://localhost
echo   - Health Check: http://localhost/health
echo.
echo Comandos utiles:
echo   - Ver logs: docker-compose logs -f
echo   - Parar servicios: docker-compose down
echo.
echo Para tu frontend, usa:
echo   VITE_BACKEND_URL=http://localhost
echo.

REM Pequeña pausa para que los servicios se inicien
echo Verificando servicios en 5 segundos...
timeout /t 5 /nobreak >nul

echo Verificando health checks...
curl -s "http://localhost:3001/health" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Backend health check fallo - revisa los logs
) else (
    echo [OK] Backend funcionando correctamente
)

curl -s "http://localhost/health" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Nginx proxy health check fallo - revisa los logs
) else (
    echo [OK] Nginx proxy funcionando correctamente
)

echo.
echo Presiona cualquier tecla para salir...
pause >nul
