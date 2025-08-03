FROM node:18-alpine

WORKDIR /app

# Instalar dependencias requeridas para manejar archivos grandes
RUN apk add --no-cache tzdata

# Copiar archivos de la aplicación
COPY package.json pnpm-lock.yaml* ./

# Instalar dependencias
RUN npm install -g pnpm && pnpm install

# Copiar el código fuente
COPY . .

# Crear directorios para uploads (estos serán solo temporales dentro del contenedor)
RUN mkdir -p uploads
RUN mkdir -p src/uploads

# Exponer el puerto
EXPOSE 3001

# Iniciar la aplicación
CMD ["node", "src/index.js"]
