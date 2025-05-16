const Supabase = require("@supabase/supabase-js");
const GmailSender = require("./gmailSender");

class NotificationService {
  constructor() {
    this.supabase = Supabase.createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    this.gmailSender = new GmailSender({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    });
  }

  async checkExpiringCases() {
    const now = new Date();
    const oneDayFromNow = new Date(now);
    oneDayFromNow.setDate(now.getDate() + 1);
    
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(now.getDate() + 3);
    
    const fiveDaysFromNow = new Date(now);
    fiveDaysFromNow.setDate(now.getDate() + 5);

    const { data: cases, error } = await this.supabase
      .from("cases")
      .select(`
        *,
        users (
          id,
          email_user_auth
        )
      `)
      .or(`expiration_date.eq.${oneDayFromNow.toISOString()},expiration_date.eq.${threeDaysFromNow.toISOString()},expiration_date.eq.${fiveDaysFromNow.toISOString()}`);

    if (error) {
      console.error("Error al consultar casos:", error);
      return;
    }

    for (const case_ of cases) {
      if (!case_.users?.email_user_auth) continue;

      const daysUntilExpiration = Math.ceil(
        (new Date(case_.expiration_date) - now) / (1000 * 60 * 60 * 24)
      );

      const emailSubject = `Caso ${case_.radicado} próximo a expirar`;
      const emailText = `
        <h2>Notificación de Caso Próximo a Expirar</h2>
        <p>El caso con número de radicado <strong>${case_.radicado}</strong> expirará en ${daysUntilExpiration} día(s).</p>
        <p>Por favor, asegúrese de dar respuesta oportuna.</p>
        <br>
        <p><strong>Detalles del caso:</strong></p>
        <ul>
          <li>Descripción: ${case_.description}</li>
          <li>Fecha de expiración: ${new Date(case_.expiration_date).toLocaleDateString()}</li>
        </ul>
      `;

      try {
        await this.gmailSender.sendEmail(
          case_.users.email_user_auth,
          emailSubject,
          emailText
        );
        console.log(`Notificación enviada para el caso ${case_.radicado}`);
      } catch (error) {
        console.error(`Error al enviar notificación para el caso ${case_.radicado}:`, error);
      }
    }
  }
}

module.exports = NotificationService; 