const nodemailer = require("nodemailer");

class GmailSender {
  constructor(credentials) {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: "adausencias@gmail.com",
        pass: process.env.PRIVATE_GMAIL_PASS,
        clientId: credentials.client_id,
        clientSecret: credentials.client_secret,
        refreshToken: credentials.refresh_token,
      },
    });
  }

  async sendEmail(to, subject, text) {
    const mailOptions = {
      from: "adausencias@gmail.com",
      to,
      subject,
      text,
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
