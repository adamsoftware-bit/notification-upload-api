require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const GmailSender = require("./gmailSender");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3001;

cloudinary.config({
  cloud_name: process.env.PRIVATE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.PRIVATE_CLOUDINARY_API_KEY,
  api_secret: process.env.PRIVATE_CLOUDINARY_API_SECRET,
});
app.post("/send-email", async (req, res) => {
  const { to, subject, text } = req.body;

  try {
    const gmailSender = new GmailSender({
      client_id: process.env.PRIVATE_GMAIL_CLIENT_ID,
      client_secret: process.env.PRIVATE_GMAIL_CLIENT_SECRET,
      refresh_token: process.env.PRIVATE_GMAIL_REFRESH_TOKEN,
    });
    await gmailSender.sendEmail(to, subject, text);
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
      return cloudinary.uploader.upload(file.path, {
        resource_type: "auto",
        folder: `radicados/${radicado}`,
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

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
