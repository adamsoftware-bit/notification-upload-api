# Notification Upload API

Esta API permite enviar correos electrónicos, subir archivos (hasta 5GB) y manejar notificaciones.

## Configuración con Docker

1. Clona el repositorio.
2. Configura las variables de entorno en el archivo `.env`.
3. Asegúrate de tener Docker y Docker Compose instalados en tu sistema.

## Uso con Docker

### Iniciar la aplicación con Docker Compose

```bash
docker-compose up -d
```

Esto iniciará la aplicación en [http://localhost](http://localhost) (puerto 80).

### Detener la aplicación

```bash
docker-compose down
```

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
