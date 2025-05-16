require("dotenv").config();
const Supabase = require("@supabase/supabase-js");
const GmailSender = require("./gmailSender");
const { differenceInDays } = require('date-fns/differenceInDays');

const supabase = Supabase.createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const gmailSender = new GmailSender({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
});
const formatDateToYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const checkExpiringCases = async () => {

    const date = new Date().toLocaleString("en-US", { timeZone: "America/Bogota" });
    const colombiaDateForSearch = new Date(date);
    const oneDayFromNow = formatDateToYYYYMMDD(new Date(colombiaDateForSearch.setDate(colombiaDateForSearch.getDate() + 2)));
    const threeDaysFromNow = formatDateToYYYYMMDD(new Date(colombiaDateForSearch.setDate(colombiaDateForSearch.getDate() + 2))); // +2 porque now ya tiene +1
    const fiveDaysFromNow = formatDateToYYYYMMDD(new Date(colombiaDateForSearch.setDate(colombiaDateForSearch.getDate() + 2))); // +2 porque now ya tiene +3;

    const { data: cases, error } = await supabase
        .from("cases")
        .select(`
      *,
      users (
        id,
        email_user_auth,
        full_name
      )
    `).filter("expiration_date", "in", `(${oneDayFromNow}, ${threeDaysFromNow}, ${fiveDaysFromNow})`);

    if (error) {
        console.error("Error al consultar casos:", error);
        return;
    }

    for (const case_ of cases) {
        if (!case_.users?.email_user_auth) continue;

        const [year, month, day] = case_.expiration_date.split('-');
        const expirationDate = new Date(year, month - 1, day-1); 
        const daysUntilExpiration = differenceInDays(
            expirationDate.setHours(0,0,0,0),
            new Date(date).setHours(0,0,0,0)
        );

        const caseUrl = `${process.env.VITE_FRONTEND_URL}/documents/${case_.radicado}`;

        const emailSubject = `Caso ${case_.radicado} próximo a expirar`;
        const emailText = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Notificación de Caso Próximo a Expirar</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 1px solid #dddddd;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            color: #333333;
        }
        .content {
            padding: 20px 0;
        }
        .content p {
            font-size: 16px;
            color: #555555;
            line-height: 1.6;
        }
        .details {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
        }
        .details p {
            margin: 8px 0;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #dddddd;
            font-size: 14px;
            color: #777777;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            margin: 20px 0;
            font-size: 16px;
            color: #ffffff !important;
            background-color: #4F46E5;
            border-color: #4F46E5;
            text-decoration: none;
            border-radius: 5px;
        }
        .button:hover {
            background-color: #4338CA;
            border-color: #4338CA;
        }
        .warning {
            color: #dc3545;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Caso Próximo a Expirar</h1>
        </div>
        <div class="content">
            <p>Hola ${case_.users.full_name || 'Usuario'},</p>
            <p class="warning">¡ATENCIÓN! El siguiente caso expirará en ${daysUntilExpiration} día(s).</p>
            
            <div class="details">
                <p><strong>Número de Radicado:</strong> ${case_.radicado}</p>
                <p><strong>Descripción:</strong> ${case_.description}</p>
                <p><strong>Fecha de Expiración:</strong> ${new Date(case_.expiration_date).toLocaleDateString()}</p>
                <p><strong>Medio de Solicitud:</strong> ${case_.request_medium}</p>
                <p><strong>Nombre del Peticionario:</strong> ${case_.requester_name}</p>
            </div>

            <p>Por favor, asegúrese de dar respuesta oportuna al caso antes de la fecha de vencimiento.</p>
            
            <center>
                <a href="${caseUrl}" class="button">Ver Detalles del Caso</a>
            </center>
        </div>
        <div class="footer">
            <p>Esta es una notificación automática. Si tienes problemas, contacta al equipo de soporte.</p>
            <p>Atentamente,<br>Sistema de Gestión Documental</p>
        </div>
    </div>
</body>
</html>
    `;

        try {
            await gmailSender.sendEmail(
                case_.users.email_user_auth,
                emailSubject,
                emailText
            );
            console.log(`Notificación enviada para el caso ${case_.radicado}`);
        } catch (error) {
            console.error(`Error al enviar notificación para el caso ${case_.radicado}:`, error);
        }
    }
};

module.exports = {
    checkExpiringCases,
}; 