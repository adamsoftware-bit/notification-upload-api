require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const GmailSender = require("./gmailSender");
const { createReport } = require("./reportService");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

// Configuración para manejar archivos grandes
const uploadDir = process.env.BASE_UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar multer para manejar archivos grandes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB en bytes
  }
});

const archiver = require("archiver");
const stream = require("stream");
const fileService = require('./fileService');
const { console } = require("inspector");
const schedule = require('node-schedule');
const { checkExpiringCases } = require('./notificationService');

const app = express();
app.use(express.json());
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

console.log(process.env.PORT);
const PORT = process.env.PORT || 3001;

cloudinary.config({
  cloud_name: process.env.PRIVATE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.PRIVATE_CLOUDINARY_API_KEY,
  api_secret: process.env.PRIVATE_CLOUDINARY_API_SECRET,
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

schedule.scheduleJob('0 13 * * *', async () => {
  console.log('Ejecutando verificación de casos próximos a expirar...');
  try {
    await checkExpiringCases();
    console.log('Verificación completada exitosamente');
  } catch (error) {
    console.error('Error durante la verificación de casos:', error);
  }
});

app.post("/create-report", async (req, res) => {
  const { startDate, endDate } = req.body;
  const filePath = await createReport({ startDate, endDate });
  res.download(filePath);
});
app.post("/send-email", async (req, res) => {
  const { to, subject, text } = req.body;

  try {
    const gmailSender = new GmailSender({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    });
    const from = process.env.FROM_EMAIL || process.env.SMTP_USER || "Archivo Pueblo Nuevo <pueblonuevoarchivo@gmail.com>"; 
    await gmailSender.sendEmail(to, subject, text, from);
    res.status(200).send("Correo enviado con éxito");
  } catch (error) {
    console.error("Error enviando el correo:", error);
    res.status(500).send("Error enviando el correo");
  }
});

app.post("/upload-pdf", upload.array("pdfs"), async (req, res) => {
  const { radicado } = req.body;
  const files = req.files;

  if (!radicado || !files || files.length === 0) {
    return res
      .status(400)
      .send("Número de radicado y archivos PDF son requeridos");
  }

  try {
    const uploadPromises = files.map((file) => {
      const fileExtension = path.extname(file.originalname).substring(1);
      const fileName = path.basename(file.originalname, path.extname(file.originalname));
      return cloudinary.uploader.upload(file.path, {
        resource_type: "auto",
        folder: `radicados/${radicado}`,
        public_id: `${fileName}.${fileExtension}`,
      });
    });

    const uploadResults = await Promise.all(uploadPromises);

    files.forEach((file) => fs.unlinkSync(file.path));

    res.status(200).send({
      message: "Archivos subidos con éxito",
      results: uploadResults,
    });
  } catch (error) {
    console.error("Error subiendo los archivos:", error);
    res.status(500).send("Error subiendo los archivos");
  }
});

app.delete("/delete-file/:radicado", async (req, res) => {
  const { radicado } = req.params;

  if (!radicado) {
    return res.status(400).send("Número de radicado es requerido");
  }

  try {
    // Eliminar todos los archivos en la carpeta del radicado
    const deleteResources = await cloudinary.api.delete_resources_by_prefix(
      `radicados/${radicado}`
    );

    // Eliminar la carpeta del radicado
    const deleteFolder = await cloudinary.api.delete_folder(
      `radicados/${radicado}`
    );

    res.status(200).send({
      message: "Carpeta y archivos eliminados con éxito",
      deleteResources,
      deleteFolder,
    });
  } catch (error) {
    console.error("Error eliminando la carpeta y archivos:", error);
    res.status(500).send("Error eliminando la carpeta y archivos");
  }
});

app.get("/download-file/:radicado", async (req, res) => {
  const { radicado } = req.params;

  if (!radicado) {
    return res.status(400).send("Número de radicado es requerido");
  }

  try {
    // Obtener la lista de archivos en la carpeta del radicado
    const resources = await cloudinary.api.resources({
      type: 'upload',
      prefix: `radicados/${radicado}`
    });

    if (resources.resources.length === 0) {
      return res.status(404).send("No se encontraron archivos para el radicado proporcionado");
    }

    // Crear un archivo .zip en memoria
    const zipStream = new stream.PassThrough();
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.on('error', (err) => {
      throw err;
    });

    res.attachment(`${radicado}.zip`);
    archive.pipe(zipStream);
    zipStream.pipe(res);

    for (const resource of resources.resources) {
      const fileStream = await cloudinary.utils.download_archive_url({
        public_ids: [resource.public_id],
        resource_type: resource.format,
        type: 'upload',
        target_format: 'zip'
      });

      // Cambiar el nombre del archivo para que no incluya la carpeta
      const fileName = `${resource.public_id.split('/').pop()}.${resource.format}`;
      archive.append(fileStream, { name: fileName });
    }

    await archive.finalize();
  } catch (error) {
    console.error("Error descargando los archivos:", error);
    res.status(500).send("Error descargando los archivos");
  }
});

app.delete("/delete-files-by-urls", async (req, res) => {
  const { secure_urls } = req.body;

  if (!secure_urls || !Array.isArray(secure_urls) || secure_urls.length === 0) {
    return res
      .status(400)
      .send("secure_urls es requerido y debe ser un array de strings");
  }

  try {
    const deletePromises = secure_urls.map((secure_url) => {
      // Extraer el public_id del secure_url
      const url = new URL(secure_url);
      const pathParts = url.pathname.split("/");
      const publicIdWithExtension = pathParts.slice(-2).join("/"); // Considera la estructura completa
      const publicId = publicIdWithExtension.split(".")[0];

      // Eliminar el archivo usando el public_id
      return cloudinary.uploader.destroy(`radicados/${publicId}`);
    });

    const results = await Promise.all(deletePromises);

    res.status(200).send({
      message: "Archivos eliminados con éxito",
      results,
    });
  } catch (error) {
    console.error("Error eliminando los archivos:", error);
    res.status(500).send("Error eliminando los archivos");
  }
});


app.post('/files/upload', upload.array('pdfs'), (req, res) => {
  console.log(req.files);
  console.log(req.body);
  fileService.saveFiles(req, res);
});

app.delete('/files/:radicado', (req, res) => {
  fileService.deleteFiles(req, res);
});

app.post('/files/delete-by-urls', (req, res) => {
  fileService.deleteFilesByUrls(req, res);
});

app.get('/files/download/:radicado', (req, res) => {
  fileService.downloadFiles(req, res);
});

app.get('/files/view/:radicado', (req, res) => {
  fileService.streamFiles(req, res);
});

app.post('/files/download-single', (req, res) => {
  fileService.downloadSingleFile(req, res);
});

app.post('/files/get-info', (req, res) => {
  fileService.getFileInfo(req, res);
});
