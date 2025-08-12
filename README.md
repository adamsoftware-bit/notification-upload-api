# Notification Upload API

Esta API permite enviar correos electrónicos, subir archivos (hasta 5GB) y manejar notificaciones para integrarse con aplicaciones frontend.

## 🚀 Configuración Rápida

### Prerrequisitos
- Docker Desktop instalado y ejecutándose
- Windows Server o Windows 10/11
- Puerto 80 y 3001 disponibles

### Despliegue Automático (Recomendado)

1. Clona el repositorio
2. Ejecuta el script de despliegue:

```powershell
# Despliegue completo con build
.\deploy.ps1 -Build

# Solo despliegue (si ya tienes la imagen)
.\deploy.ps1

# Ver logs en tiempo real
.\deploy.ps1 -Logs

# Parar servicios
.\deploy.ps1 -Stop

# Limpiar todo (imágenes, contenedores, volúmenes)
.\deploy.ps1 -Clean
```

### Configuración Manual

1. **Configura las variables de entorno**:
   ```bash
   cp .env.example .env
   # Edita .env con tus credenciales
   ```

2. **Inicia los servicios**:
   ```bash
   # Producción
   docker-compose up -d
   
   # Desarrollo (con hot reload)
   docker-compose -f docker-compose.dev.yml up -d
   ```

## 🌐 URLs de Acceso

- **API Backend**: http://localhost:3001
- **Nginx Proxy**: http://localhost
- **Health Check**: http://localhost/health
- **Uploads**: http://localhost/uploads/

## 🔧 Configuración del Frontend

Para conectar tu frontend React/Vite con este backend, asegúrate de que tu `VITE_BACKEND_URL` apunte a:

```env
# En tu frontend .env
VITE_BACKEND_URL=http://localhost  # Si usas el proxy nginx
# O
VITE_BACKEND_URL=http://localhost:3001  # Directamente al backend
```

## 📁 Estructura de la API

### Endpoints Principales

- `POST /upload-pdf` - Subir archivos PDF
- `GET /download-file/:radicado` - Descargar archivos por radicado
- `DELETE /delete-file/:radicado` - Eliminar archivos
- `POST /send-email` - Enviar correos electrónicos
- `POST /create-report` - Generar reportes
- `GET /health` - Health check

### Endpoints de Archivos (con prefijo /files)

- `POST /files/upload` - Subir archivos
- `GET /files/download/:radicado` - Descargar por radicado
- `DELETE /files/:radicado` - Eliminar por radicado
- `POST /files/delete-by-urls` - Eliminar por URLs
- `GET /files/view/:radicado` - Ver archivos
- `POST /files/download-single` - Descargar archivo único
- `POST /files/get-info` - Obtener información de archivos

## Volúmenes y Almacenamiento de Archivos

Esta aplicación está configurada para guardar los archivos subidos en la carpeta `uploads` del directorio del proyecto, que está montada como un volumen en Docker.

Los archivos se guardan en la ruta física del sistema host y no dentro del contenedor Docker, lo que permite manejar archivos de hasta 5GB sin problemas.

## Estructura de Directorios

- `/uploads`: Directorio donde se almacenan los archivos subidos
- `/src`: Código fuente de la aplicación
  - `/src/uploads`: Directorio temporal para subidas intermedias

## Endpoints

### Correos Electrónicos

- `POST /send-email`: Enviar un correo electrónico

```json
{
    "to": "recipient-email@gmail.com",
    "subject": "Email Subject",
    "text": "Email content"
}
```

### Archivos

- `POST /files/upload`: Subir archivos (hasta 5GB)
  - Formulario multipart con campo `pdfs` para los archivos y `radicado` para el identificador
- `DELETE /files/:radicado`: Eliminar archivos por radicado
- `POST /files/delete-by-urls`: Eliminar archivos por URLs
- `GET /files/download/:radicado`: Descargar archivos por radicado
- `GET /files/view/:radicado`: Ver archivos por radicado

## Desarrollo Local (sin Docker)

Para desarrollo local sin Docker:

```bash
npm install
npm start
```

La aplicación estará disponible en [http://localhost:3001](http://localhost:3001).
