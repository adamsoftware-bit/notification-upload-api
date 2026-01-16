const mysql = require('mysql2/promise');

class LogService {
    constructor() {
        this.pool = mysql.createPool({
            host: process.env.MYSQL_HOST || 'localhost',
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: 'hik',
            port: process.env.MYSQL_PORT || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
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
                id_employee
            } = req.query;

            const offset = (page - 1) * limit;
            let whereConditions = [];
            let queryParams = [];

            // Filtro por empleado si se proporciona
            if (id_employee) {
                whereConditions.push('id_employee = ?');
                queryParams.push(id_employee);
            }

            // Filtro por fecha específica o rango de fechas
            if (specificDate) {
                whereConditions.push('day = ?');
                queryParams.push(specificDate);
            } else if (startDate && endDate) {
                whereConditions.push('day BETWEEN ? AND ?');
                queryParams.push(startDate, endDate);
            } else if (startDate) {
                whereConditions.push('day >= ?');
                queryParams.push(startDate);
            } else if (endDate) {
                whereConditions.push('day <= ?');
                queryParams.push(endDate);
            }

            const whereClause = whereConditions.length > 0 
                ? `WHERE ${whereConditions.join(' AND ')}` 
                : '';

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
            
            const [rows] = await this.pool.execute(
                dataQuery, 
                [...queryParams, parseInt(limit), parseInt(offset)]
            );

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
                    hasPreviousPage: page > 1
                }
            });

        } catch (error) {
            console.error('Error obteniendo logs:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener los registros',
                message: error.message
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
                specificDate
            } = req.query;

            if (!id_employee) {
                return res.status(400).json({
                    success: false,
                    error: 'El id_employee es requerido'
                });
            }

            const offset = (page - 1) * limit;
            let whereConditions = ['id_employee = ?'];
            let queryParams = [id_employee];

            // Filtro por fecha específica o rango de fechas
            if (specificDate) {
                whereConditions.push('day = ?');
                queryParams.push(specificDate);
            } else if (startDate && endDate) {
                whereConditions.push('day BETWEEN ? AND ?');
                queryParams.push(startDate, endDate);
            } else if (startDate) {
                whereConditions.push('day >= ?');
                queryParams.push(startDate);
            } else if (endDate) {
                whereConditions.push('day <= ?');
                queryParams.push(endDate);
            }

            const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

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
            
            const [rows] = await this.pool.execute(
                dataQuery, 
                [...queryParams, parseInt(limit), parseInt(offset)]
            );

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
                    hasPreviousPage: page > 1
                }
            });

        } catch (error) {
            console.error('Error obteniendo logs del empleado:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener los registros del empleado',
                message: error.message
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