const mysql = require('mysql2/promise');
const ExcelJs = require("exceljs");
const fs = require("fs");
const path = require("path");

const TEMP_DIR = path.join(__dirname, "..", "temp");

class LogService {
  constructor() {
    this.pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: "hik",
      port: process.env.MYSQL_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  /**
   * Obtener logs con paginación y filtros
   */
  async getLogs(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        startDate,
        endDate,
        specificDate,
        id_employee,
      } = req.query;

      const offset = (page - 1) * limit;
      let whereConditions = [];
      let queryParams = [];

      // Filtro por empleado si se proporciona
      if (id_employee) {
        whereConditions.push("id_employee = ?");
        queryParams.push(id_employee);
      }

      // Filtro por fecha específica o rango de fechas
      if (specificDate) {
        whereConditions.push("day = ?");
        queryParams.push(specificDate);
      } else if (startDate && endDate) {
        whereConditions.push("day BETWEEN ? AND ?");
        queryParams.push(startDate, endDate);
      } else if (startDate) {
        whereConditions.push("day >= ?");
        queryParams.push(startDate);
      } else if (endDate) {
        whereConditions.push("day <= ?");
        queryParams.push(endDate);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Consulta para obtener el total de registros
      const countQuery = `SELECT COUNT(*) as total FROM log ${whereClause}`;
      const [countResult] = await this.pool.execute(countQuery, queryParams);
      const total = countResult[0].total;

      // Consulta para obtener los registros paginados
      const dataQuery = `
                SELECT 
                    id,
                    id_employee,
                    date,
                    day,
                    hour,
                    direction,
                    device,
                    deviceSN,
                    employee_name,
                    card_no
                FROM log 
                ${whereClause}
                ORDER BY date DESC
                LIMIT ? OFFSET ?
            `;

      const [rows] = await this.pool.execute(dataQuery, [
        ...queryParams,
        parseInt(limit),
        parseInt(offset),
      ]);

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecords: total,
          recordsPerPage: parseInt(limit),
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Error obteniendo logs:", error);
      res.status(500).json({
        success: false,
        error: "Error al obtener los registros",
        message: error.message,
      });
    }
  }

  /**
   * Obtener logs por empleado específico
   */
  async getLogsByEmployee(req, res) {
    try {
      const { id_employee } = req.params;
      const {
        page = 1,
        limit = 10,
        startDate,
        endDate,
        specificDate,
      } = req.query;

      if (!id_employee) {
        return res.status(400).json({
          success: false,
          error: "El id_employee es requerido",
        });
      }

      const offset = (page - 1) * limit;
      let whereConditions = ["id_employee = ?"];
      let queryParams = [id_employee];

      // Filtro por fecha específica o rango de fechas
      if (specificDate) {
        whereConditions.push("day = ?");
        queryParams.push(specificDate);
      } else if (startDate && endDate) {
        whereConditions.push("day BETWEEN ? AND ?");
        queryParams.push(startDate, endDate);
      } else if (startDate) {
        whereConditions.push("day >= ?");
        queryParams.push(startDate);
      } else if (endDate) {
        whereConditions.push("day <= ?");
        queryParams.push(endDate);
      }

      const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

      // Consulta para obtener el total de registros
      const countQuery = `SELECT COUNT(*) as total FROM log ${whereClause}`;
      const [countResult] = await this.pool.execute(countQuery, queryParams);
      const total = countResult[0].total;

      // Consulta para obtener los registros paginados
      const dataQuery = `
                SELECT 
                    id,
                    id_employee,
                    date,
                    day,
                    hour,
                    direction,
                    device,
                    deviceSN,
                    employee_name,
                    card_no
                FROM log 
                ${whereClause}
                ORDER BY date DESC
                LIMIT ? OFFSET ?
            `;

      const [rows] = await this.pool.execute(dataQuery, [
        ...queryParams,
        parseInt(limit),
        parseInt(offset),
      ]);

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: rows,
        employee: id_employee,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecords: total,
          recordsPerPage: parseInt(limit),
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Error obteniendo logs del empleado:", error);
      res.status(500).json({
        success: false,
        error: "Error al obtener los registros del empleado",
        message: error.message,
      });
    }
  }

  /**
   * Construir cláusula WHERE a partir de filtros de fecha y empleado (sin paginación)
   */
  _buildWhereClause({ id_employee, specificDate, startDate, endDate }) {
    const conditions = [];
    const params = [];

    if (id_employee) {
      conditions.push("id_employee = ?");
      params.push(id_employee);
    }
    if (specificDate) {
      conditions.push("day = ?");
      params.push(specificDate);
    } else if (startDate && endDate) {
      conditions.push("day BETWEEN ? AND ?");
      params.push(startDate, endDate);
    } else if (startDate) {
      conditions.push("day >= ?");
      params.push(startDate);
    } else if (endDate) {
      conditions.push("day <= ?");
      params.push(endDate);
    }

    return {
      whereClause:
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
      queryParams: params,
    };
  }

  /**
   * Crear libro Excel con la plantilla de reporte de accesos
   */
  async _createLogsWorkbook(rows, titulo = "REPORTE DE ACCESOS") {
    const workbook = new ExcelJs.Workbook();
    const worksheet = workbook.addWorksheet("Reporte");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10, style: { font: { size: 12 } } },
      {
        header: "ID EMPLEADO",
        key: "id_employee",
        width: 20,
        style: { font: { size: 12 } },
      },
      {
        header: "NOMBRE EMPLEADO",
        key: "employee_name",
        width: 35,
        style: { font: { size: 12 } },
      },
      {
        header: "NO. TARJETA",
        key: "card_no",
        width: 20,
        style: { font: { size: 12 } },
      },
      {
        header: "FECHA Y HORA",
        key: "date",
        width: 22,
        style: { font: { size: 12 } },
      },
      { header: "DÍA", key: "day", width: 15, style: { font: { size: 12 } } },
      { header: "HORA", key: "hour", width: 12, style: { font: { size: 12 } } },
      {
        header: "DIRECCIÓN",
        key: "direction",
        width: 15,
        style: { font: { size: 12 } },
      },
      {
        header: "DISPOSITIVO",
        key: "device",
        width: 30,
        style: { font: { size: 12 } },
      },
      {
        header: "NO. SERIE DISPOSITIVO",
        key: "deviceSN",
        width: 30,
        style: { font: { size: 12 } },
      },
    ];

    // Filas de encabezado institucional
    worksheet.insertRow(1, ["ALCALDÍA MUNICIPAL DE PUEBLO NUEVO"]);
    worksheet.insertRow(2, ["Sistema de Control de Acceso"]);
    worksheet.insertRow(3, [titulo]);
    worksheet.insertRow(4, [
      `Generado el: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}`,
    ]);

    worksheet.mergeCells("A1:J1");
    worksheet.mergeCells("A2:J2");
    worksheet.mergeCells("A3:J3");
    worksheet.mergeCells("A4:J4");

    for (let i = 1; i <= 4; i++) {
      worksheet.getRow(i).alignment = { horizontal: "center" };
      worksheet.getRow(i).font = { size: 14, bold: true };
    }

    // Estilo de la fila de cabecera de columnas (fila 5 tras los inserts)
    const headerRow = worksheet.getRow(5);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    };

    rows.forEach((row) => {
      worksheet.addRow({
        id: row.id,
        id_employee: row.id_employee,
        employee_name: row.employee_name,
        card_no: row.card_no,
        date: row.date,
        day: row.day,
        hour: row.hour,
        direction: row.direction,
        device: row.device,
        deviceSN: row.deviceSN,
      });
    });

    return workbook;
  }

  /**
   * Generar reporte Excel con todos los logs (mismos filtros que getLogs, sin paginación)
   */
  async generateLogsReport(req, res) {
    try {
      const { startDate, endDate, specificDate, id_employee } = req.query;
      const { whereClause, queryParams } = this._buildWhereClause({
        id_employee,
        specificDate,
        startDate,
        endDate,
      });

      const dataQuery = `
                SELECT id, id_employee, date, day, hour, direction, device, deviceSN, employee_name, card_no
                FROM log
                ${whereClause}
                ORDER BY date DESC
            `;
      const [rows] = await this.pool.execute(dataQuery, queryParams);

      const workbook = await this._createLogsWorkbook(
        rows,
        "REPORTE GENERAL DE ACCESOS",
      );

      if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
      const filePath = path.join(
        TEMP_DIR,
        `reporte_accesos_${Date.now()}.xlsx`,
      );
      await workbook.xlsx.writeFile(filePath);

      res.download(filePath, `reporte_accesos.xlsx`, (err) => {
        if (err) console.error("Error al enviar el reporte:", err);
        fs.unlink(filePath, () => {});
      });
    } catch (error) {
      console.error("Error generando reporte de logs:", error);
      res.status(500).json({
        success: false,
        error: "Error al generar el reporte",
        message: error.message,
      });
    }
  }

  /**
   * Generar reporte Excel de logs por empleado (mismos filtros que getLogsByEmployee, sin paginación)
   */
  async generateLogsReportByEmployee(req, res) {
    try {
      const { id_employee } = req.params;

      if (!id_employee) {
        return res.status(400).json({
          success: false,
          error: "El id_employee es requerido",
        });
      }

      const { startDate, endDate, specificDate } = req.query;
      const { whereClause, queryParams } = this._buildWhereClause({
        id_employee,
        specificDate,
        startDate,
        endDate,
      });

      const dataQuery = `
                SELECT id, id_employee, date, day, hour, direction, device, deviceSN, employee_name, card_no
                FROM log
                ${whereClause}
                ORDER BY date DESC
            `;
      const [rows] = await this.pool.execute(dataQuery, queryParams);

      const employeeName =
        rows.length > 0 ? rows[0].employee_name : id_employee;
      const workbook = await this._createLogsWorkbook(
        rows,
        `REPORTE DE ACCESOS — ${employeeName}`,
      );

      if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
      const filePath = path.join(
        TEMP_DIR,
        `reporte_accesos_empleado_${id_employee}_${Date.now()}.xlsx`,
      );
      await workbook.xlsx.writeFile(filePath);

      const fileName = `reporte_accesos_${id_employee}.xlsx`;
      res.download(filePath, fileName, (err) => {
        if (err) console.error("Error al enviar el reporte:", err);
        fs.unlink(filePath, () => {});
      });
    } catch (error) {
      console.error("Error generando reporte de logs del empleado:", error);
      res.status(500).json({
        success: false,
        error: "Error al generar el reporte del empleado",
        message: error.message,
      });
    }
  }

  /**
   * Cerrar el pool de conexiones
   */
  async closePool() {
    await this.pool.end();
  }
}

module.exports = new LogService();