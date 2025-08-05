const fs = require('fs');
const { console } = require('inspector');
const path = require('path');

// Priorizar la variable de entorno BASE_UPLOAD_DIR
const BASE_UPLOAD_DIR = process.env.BASE_UPLOAD_DIR || path.join(__dirname, 'uploads');

// Asegurar que el directorio base de uploads exista
if (!fs.existsSync(BASE_UPLOAD_DIR)) {
    console.log(`Creando directorio base: ${BASE_UPLOAD_DIR}`);
    fs.mkdirSync(BASE_UPLOAD_DIR, { recursive: true });
}

class FileService {
    async saveFiles(req, res) {
        const { radicado } = req.body;
        const files = req.files;

        console.log("Files:", files);
        console.log("Radicado:", radicado);

        if (!radicado || typeof radicado !== 'string' || radicado.trim() === '') {
            return res.status(400).send("Número de radicado es inválido");
        }

        if (!files || files.length === 0) {
            return res.status(400).send("Archivos PDF son requeridos");
        }

        try {
            const uploadDir = path.join(BASE_UPLOAD_DIR, `radicados/${radicado}`);
            console.log("Ruta del directorio de subida:", uploadDir);

            if (!fs.existsSync(uploadDir)) {
                console.log(`Creando directorio: ${uploadDir}`);
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const savedFiles = [];

            files.forEach((file) => {
                const filePath = path.join(uploadDir, file.originalname);
                console.log(`Guardando archivo en: ${filePath}`);
                fs.writeFileSync(filePath, fs.readFileSync(file.path));
                fs.unlinkSync(file.path);
                savedFiles.push(filePath);
            });

            res.status(200).send({
                message: "Archivos guardados con éxito",
                results: savedFiles,
            });
        } catch (error) {
            console.error("Error guardando los archivos:", error);
            res.status(500).send("Error guardando los archivos");
        }
    }

    async deleteFiles(req, res) {
        const { radicado } = req.params;

        if (!radicado) {
            return res.status(400).send("Número de radicado es requerido");
        }

        try {
            const folderPath = path.join(BASE_UPLOAD_DIR, `radicados/${radicado}`);

            if (!fs.existsSync(folderPath)) {
                return res.status(404).send("La carpeta especificada no existe");
            }

            fs.readdirSync(folderPath).forEach((file) => {
                const filePath = path.join(folderPath, file);
                fs.unlinkSync(filePath); 
            });

            fs.rmdirSync(folderPath);

            res.status(200).send({
                message: "Carpeta y archivos eliminados con éxito",
                folder: folderPath,
            });
        } catch (error) {
            console.error("Error eliminando la carpeta y archivos:", error);
            res.status(500).send("Error eliminando la carpeta y archivos");
        }
    }

       async deleteFilesByUrls(req, res) {
        const { secure_urls } = req.body;
    
        if (!secure_urls || !Array.isArray(secure_urls) || secure_urls.length === 0) {
            return res
                .status(400)
                .send("secure_urls es requerido y debe ser un array de strings");
        }
    
        try {
            const deleteResults = secure_urls.map((secure_url) => {
                const filePath = path.isAbsolute(secure_url)
                    ? secure_url
                    : path.join(BASE_UPLOAD_DIR, secure_url);
    
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
    
                    if (stats.isDirectory()) {
                        fs.readdirSync(filePath).forEach((file) => {
                            const innerFilePath = path.join(filePath, file);
                            fs.unlinkSync(innerFilePath);
                        });
    
                        fs.rmdirSync(filePath);
                        return { file: filePath, status: "deleted directory" };
                    } else {
                        fs.unlinkSync(filePath);
                        return { file: filePath, status: "deleted file" };
                    }
                } else {
                    return { file: filePath, status: "not found" };
                }
            });
    
            res.status(200).send({
                message: "Archivos procesados",
                results: deleteResults,
            });
        } catch (error) {
            console.error("Error eliminando los archivos:", error);
            res.status(500).send("Error eliminando los archivos: " + error.message);
        }
    }
    async downloadFiles(req, res) {
        const { radicado } = req.params;

        if (!radicado) {
            return res.status(400).send("Número de radicado es requerido");
        }

        try {
            const folderPath = path.join(BASE_UPLOAD_DIR, `radicados/${radicado}`);

            if (!fs.existsSync(folderPath)) {
                return res.status(404).send("La carpeta especificada no existe");
            }

            const files = fs.readdirSync(folderPath);

            if (files.length === 0) {
                return res.status(404).send("No hay archivos para descargar en este radicado");
            }

            const archiver = require('archiver');
            const zipFileName = `radicado_${radicado}.zip`;
            const zipFilePath = path.join(BASE_UPLOAD_DIR, zipFileName);

            const output = fs.createWriteStream(zipFilePath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                res.download(zipFilePath, zipFileName, (err) => {
                    if (err) {
                        console.error("Error enviando el archivo ZIP:", err);
                        res.status(500).send("Error enviando el archivo ZIP");
                    }

                    fs.unlinkSync(zipFilePath);
                });
            });

            archive.on('error', (err) => {
                console.error("Error creando el archivo ZIP:", err);
                res.status(500).send("Error creando el archivo ZIP");
            });

            archive.pipe(output);

            files.forEach((file) => {
                const filePath = path.join(folderPath, file);
                archive.file(filePath, { name: file });
            });

            archive.finalize();
        } catch (error) {
            console.error("Error descargando los archivos:", error);
            res.status(500).send("Error descargando los archivos");
        }
    }
    async streamFiles(req, res) {
        const { radicado } = req.params;

        if (!radicado) {
            return res.status(400).send("Número de radicado es requerido");
        }

        try {
            const folderPath = path.join(BASE_UPLOAD_DIR, `radicados/${radicado}`);

            if (!fs.existsSync(folderPath)) {
                return res.status(404).send("La carpeta especificada no existe");
            }

            const files = fs.readdirSync(folderPath);

            if (files.length === 0) {
                return res.status(404).send("No hay archivos para visualizar en este radicado");
            }

            res.setHeader('Content-Type', 'application/json');
            res.write('[');
            files.forEach((file, index) => {
                const filePath = path.join(folderPath, file);

                const fileContent = fs.readFileSync(filePath).toString('base64');
                const fileType = path.extname(file).substring(1); 

                res.write(JSON.stringify({
                    fileName: file,
                    fileType: fileType,
                    content: fileContent
                }));

                if (index < files.length - 1) {
                    res.write(',');
                }
            });

            res.write(']');
            res.end();
        } catch (error) {
            console.error("Error obteniendo los archivos:", error);
            res.status(500).send("Error obteniendo los archivos");
        }
    }

    async downloadSingleFile(req, res) {
        const { filePath: requestedPath } = req.body;

        if (!requestedPath || typeof requestedPath !== 'string') {
            return res.status(400).send("La ruta del archivo es requerida");
        }

        try {
            // Determinar si la ruta es absoluta o relativa
            const absolutePath = path.isAbsolute(requestedPath) 
                ? requestedPath 
                : path.join(BASE_UPLOAD_DIR, requestedPath);

            console.log("Ruta absoluta del archivo:", absolutePath);

            if (!fs.existsSync(absolutePath)) {
                return res.status(404).send("El archivo especificado no existe");
            }

            const stats = fs.statSync(absolutePath);
            if (!stats.isFile()) {
                return res.status(400).send("La ruta especificada no es un archivo");
            }

            const archiver = require('archiver');
            const fileName = path.basename(absolutePath);
            const fileNameWithoutExt = path.parse(fileName).name;
            const zipFileName = `${fileNameWithoutExt}.zip`;

            // Configurar headers para la descarga
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.on('error', (err) => {
                console.error("Error creando el archivo ZIP:", err);
                res.status(500).send("Error creando el archivo ZIP");
            });

            archive.pipe(res);
            archive.file(absolutePath, { name: fileName });
            archive.finalize();

        } catch (error) {
            console.error("Error descargando el archivo:", error);
            res.status(500).send("Error descargando el archivo: " + error.message);
        }
    }

    async getFileInfo(req, res) {
        const { filePath: requestedPath } = req.body;

        if (!requestedPath || typeof requestedPath !== 'string') {
            return res.status(400).send("La ruta del archivo es requerida");
        }

        try {
            // Determinar si la ruta es absoluta o relativa
            const absolutePath = path.isAbsolute(requestedPath) 
                ? requestedPath 
                : path.join(BASE_UPLOAD_DIR, requestedPath);

            console.log("Ruta absoluta del archivo:", absolutePath);

            if (!fs.existsSync(absolutePath)) {
                return res.status(404).send("El archivo especificado no existe");
            }

            const stats = fs.statSync(absolutePath);
            if (!stats.isFile()) {
                return res.status(400).send("La ruta especificada no es un archivo");
            }

            const fileName = path.basename(absolutePath);
            const fileExtension = path.extname(fileName).substring(1).toLowerCase();
            const fileSize = stats.size;
            const lastModified = stats.mtime;

            // Leer el contenido del archivo y convertirlo a base64
            const fileContent = fs.readFileSync(absolutePath);
            const base64Content = fileContent.toString('base64');

            // Determinar el tipo MIME basado en la extensión
            const mimeTypes = {
                'pdf': 'application/pdf',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'txt': 'text/plain',
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'xls': 'application/vnd.ms-excel',
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            };

            const mimeType = mimeTypes[fileExtension] || 'application/octet-stream';

            res.status(200).send({
                fileName: fileName,
                fileExtension: fileExtension,
                fileSize: fileSize,
                lastModified: lastModified,
                mimeType: mimeType,
                filePath: absolutePath,
                content: base64Content,
                // URL para abrir en nueva ventana (data URL)
                dataUrl: `data:${mimeType};base64,${base64Content}`
            });

        } catch (error) {
            console.error("Error obteniendo información del archivo:", error);
            res.status(500).send("Error obteniendo información del archivo: " + error.message);
        }
    }
}

module.exports = new FileService();