const nodemailer = require("nodemailer");

class GmailSender {
  constructor(credentials) {
    console.log(credentials);
    this.transporter = nodemailer.createTransport({
      port: credentials.port,
      host: credentials.host,
      auth: {
        user: credentials.user,
        pass: credentials.pass,
      },
      secure: true,
    });
  }

  async sendEmail(to, subject, text) {
    const mailOptions = {
      from: "adausencias@gmail.com",
      to,
      subject,
      html: text,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log("Correo enviado exitosamente");
    } catch (error) {
      console.error("Error enviando el correo:", error);
    }
  }
}

module.exports = GmailSender;
