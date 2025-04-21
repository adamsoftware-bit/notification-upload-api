const ExcelJs = require("exceljs");
const Supabase = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const DIR_TO_CLEAR = "./temp";
const createWorkbookTemplate = async () => {
  const workbook = new ExcelJs.Workbook();
  const worksheet = workbook.addWorksheet("Reporte");

  worksheet.columns = [
    {
      header: "No. DE RADICADO",
      key: "radicado",
      width: 35,
      style: {
        font: {
          size: 22,
        },
      },
    },
    {
      header: "FECHA DE RADICADO",
      key: "date",
      width: 15,
      style: {
        font: {
          size: 22,
        },
      },
    },
    {
      header: "MEDIO DE SOLICITUD",
      key: "medium",
      width: 30,
      style: {
        font: {
          size: 22,
        },
      },
    },
    {
      header: "NOMBRE DEL PETICIONARIO O REMITENTE",
      key: "petitioner",
      width: 50,
      style: {
        font: {
          size: 22,
        },
      },
    },
    {
      header: "DIRECCION",
      key: "address",
      width: 60,
      style: {
        font: {
          size: 22,
        },
      },
    },
    {
      header: "ASUNTO",
      key: "subject",
      width: 60,
      style: {
        font: {
          size: 22,
        },
      },
    },
    {
      header: "TIPO DE SOLICITUD",
      key: "type",
      width: 60,
      style: {
        font: {
          size: 22,
        },
      },
    },
    {
      header: "RESPONSABLE DE DAR RESPUESTA",
      key: "responsible",
      width: 60,
      style: {
        font: {
          size: 22,
        },
      },
    },
    {
      header: "FECHA DE VENCIMIENTO",
      key: "expirationDate",
      width: 60,
      style: {
        font: {
          size: 22,
        },
      },
    },
    {
      header: "No OFICIO DE RESPUESTA",
      key: "responseCode",
      width: 60,
      style: {
        font: {
          size: 22,
        },
      },
    },
    {
      header: "FECHA OFICIO DE RESPUESTA",
      key: "responseDate",
      width: 60,
      style: {
        font: {
          size: 22,
        },
      },
    },
    {
      header: "OBSERVACION",
      key: "observation",
      width: 50,
      style: {
        font: {
          size: 22,
        },
      },
    },
  ];

  // Add title rows
  worksheet.insertRow(1, ["ALCALDIA MUNICIPAL DE PUEBLO NUEVO"]);
  worksheet.insertRow(2, ["Sistema de Gestión Integrado"]);
  worksheet.insertRow(3, ["FORMATO"]);
  worksheet.insertRow(4, [
    "SEGUIMIENTO A QUEJAS, RECLAMOS Y DERECHOS DE PETICION",
  ]);
  worksheet.insertRow(5, [
    "ALERTAS DE ATENCION AL CIUDADANO (DERECHOS DE PETICION, QUEJAS Y RECLAMOS)",
  ]);
  worksheet.insertRow(6, ["PROCESO ATENCION AL CIUDADANO"]);
  worksheet.insertRow(7, ["DEPENDENCIA : ARCHIVO"]);

  // Merge cells for headers
  worksheet.mergeCells("A1:L1");
  worksheet.mergeCells("A2:L2");
  worksheet.mergeCells("A3:L3");
  worksheet.mergeCells("A4:L4");
  worksheet.mergeCells("A5:L5");
  worksheet.mergeCells("A6:L6");
  worksheet.mergeCells("A7:L7");

  // Center align the headers
  for (let i = 1; i <= 7; i++) {
    worksheet.getRow(i).alignment = { horizontal: "center" };
    worksheet.getRow(i).font = {
      size: 24,
      bold: true,
    };
  }

  return workbook;
};

const createReport = async ({ startDate, endDate }) => {
  fs.rm(DIR_TO_CLEAR, { recursive: true }, () =>
    console.log("Se limpia carpeta temporal")
  );
  const workbook = await createWorkbookTemplate();
  const supabase = Supabase.createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  const { data: document, error: documentError } = await supabase
    .from("cases")
    .select(
      `
              *,
              dependencies:dependencies!cases_id_dependency_fkey (
                id,
                code,
                name
              ),
              case_type:case_type!cases_id_case_type_fkey (
                id,
                name
              ),
              users (
                id,
                id_user_auth,
                full_name
              ),
              responses (
                created_at,
                office_number
              )
            `
    )
    .order("created_at", { ascending: false })
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  document.forEach((value) => {
    //Map data
    let data = {
      radicado: value.radicado,
      date: formatDate(value.created_at),
      medium: value.request_medium,
      petitioner: value.requester_name,
      address: value.requester_address,
      subject: value.description,
      type: value.case_type.name,
      responsible: value.users.full_name || value.dependencies.name,
      expirationDate: formatDate(value.expiration_date),
    };
    if (value.responses && value.responses.length > 0) {
      // get the last response
      const lastResponse = value.responses[value.responses.length - 1];
      data = {
        ...data,
        responseCode: lastResponse.office_number,
        responseDate: formatDate(lastResponse.created_at),
      };
    }
    workbook.getWorksheet("Reporte").addRow(data);
  });

  // create file
  if (!fs.existsSync(DIR_TO_CLEAR)) {
    fs.mkdirSync(DIR_TO_CLEAR);
  }
  const filePath = `./temp/report_${new Date().getTime()}.xlsx`;
  await workbook.xlsx.writeFile(filePath);
  return filePath;
};
function formatDate(timestampz) {
  // Crear un objeto Date de JavaScript a partir del timestampz
  const date = new Date(timestampz);

  // Formatear la fecha como "1 Jan 2025"
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}
module.exports = {
  createReport,
};
