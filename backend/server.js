require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const { Parser }  = require('json2csv');
const crypto      = require('crypto');
const fs          = require('fs');
const ExcelJS     = require('exceljs');

const app = express();
app.use(cors());
app.use(express.json());

// ── DB Config (PostgreSQL / Supabase) ─────────────────────────
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
});

pool.connect()
    .then(() => console.log('✅ Conexión exitosa a PostgreSQL (Supabase)'))
    .catch(err => console.error('❌ Error BD:', err));

const hash = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex');

// ══════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
    const { nombre, apellido, password } = req.body;
    if (!nombre || !apellido || !password)
        return res.status(400).json({ success: false, message: 'Datos incompletos' });
    try {
        const result = await pool.query(
            `SELECT * FROM usuarios WHERE nombre = $1 AND apellido = $2`,
            [nombre.trim(), apellido.trim()]
        );
        if (result.rows.length === 0)
            return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
        const u = result.rows[0];
        if (u.password_hash !== hash(password))
            return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
        res.json({ success: true, user: { id: u.id, nombre: u.nombre, apellido: u.apellido, rol: u.rol, primer_ingreso: u.primer_ingreso } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

app.post('/api/auth/activar', async (req, res) => {
    const { nombre, apellido, codigo, nueva_password } = req.body;
    if (!nombre || !apellido || !codigo || !nueva_password)
        return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
    try {
        const result = await pool.query(
            `SELECT * FROM usuarios WHERE nombre=$1 AND apellido=$2 AND codigo_aceptacion=$3`,
            [nombre.trim(), apellido.trim(), codigo.trim()]
        );
        if (result.rows.length === 0)
            return res.status(401).json({ success: false, message: 'Código de aceptación inválido o datos incorrectos' });
        const u = result.rows[0];
        await pool.query(
            `UPDATE usuarios SET password_hash=$1, primer_ingreso=false WHERE id=$2`,
            [hash(nueva_password), u.id]
        );
        res.json({ success: true, user: { id: u.id, nombre: u.nombre, apellido: u.apellido, rol: u.rol, primer_ingreso: false } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

app.post('/api/auth/cambiar-password', async (req, res) => {
    const { usuario_id, nueva_password } = req.body;
    try {
        await pool.query(
            `UPDATE usuarios SET password_hash=$1, primer_ingreso=false WHERE id=$2`,
            [hash(nueva_password), usuario_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error al cambiar contraseña' });
    }
});

// ══════════════════════════════════════════════════════════
//  USUARIOS
// ══════════════════════════════════════════════════════════
app.get('/api/usuarios', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, nombre, apellido, rol, primer_ingreso, codigo_aceptacion, created_at FROM usuarios ORDER BY nombre`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error al obtener usuarios' });
    }
});

app.post('/api/usuarios', async (req, res) => {
    const { nombre, apellido, rol } = req.body;
    if (!nombre || !apellido)
        return res.status(400).json({ success: false, message: 'Nombre y apellido requeridos' });
    try {
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const result = await pool.query(`
            INSERT INTO usuarios (nombre, apellido, password_hash, rol, codigo_aceptacion, primer_ingreso)
            VALUES ($1, $2, $3, $4, $5, true)
            RETURNING id, nombre, apellido, rol, codigo_aceptacion, primer_ingreso
        `, [nombre.trim(), apellido.trim(), hash(codigo), rol || 'conductor', codigo]);
        res.status(201).json({ success: true, data: result.rows[0], codigo });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error al crear usuario' });
    }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM usuarios WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error al eliminar' });
    }
});

app.put('/api/usuarios/:id', async (req, res) => {
    const { nombre, apellido, rol } = req.body;
    if (!nombre || !apellido)
        return res.status(400).json({ success: false, message: 'Nombre y apellido requeridos' });
    try {
        await pool.query(`
            UPDATE usuarios SET nombre = $1, apellido = $2, rol = $3 WHERE id = $4
        `, [nombre.trim(), apellido.trim(), rol || 'conductor', req.params.id]);
        res.json({ success: true, message: 'Usuario actualizado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
    }
});

app.put('/api/usuarios/:id/reset-password', async (req, res) => {
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        await pool.query(
            `UPDATE usuarios SET password_hash=$1, codigo_aceptacion=$2, primer_ingreso=true WHERE id=$3`,
            [hash(codigo), codigo, req.params.id]
        );
        res.json({ success: true, codigo });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error' });
    }
});

// ══════════════════════════════════════════════════════════
//  VEHÍCULOS
// ══════════════════════════════════════════════════════════
app.get('/api/vehiculos', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM vehiculos ORDER BY marca`);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error' });
    }
});

app.post('/api/vehiculos', async (req, res) => {
    const { placa, marca, ultimo_kilometraje } = req.body;
    if (!placa || !marca)
        return res.status(400).json({ success: false, message: 'Placa y marca requeridos' });
    try {
        const result = await pool.query(`
            INSERT INTO vehiculos (placa, marca, ultimo_kilometraje) VALUES ($1, $2, $3) RETURNING *
        `, [placa.trim().toUpperCase(), marca.trim(), Number(ultimo_kilometraje) || 0]);
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error: ' + err.message });
    }
});

app.delete('/api/vehiculos/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM vehiculos WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error' });
    }
});

// ══════════════════════════════════════════════════════════
//  COMISIONES
// ══════════════════════════════════════════════════════════

// ── Helper: insertar movimientos ──────────────────────────
const insertarMovimientos = async (client, comision_id, movimientos) => {
    if (!Array.isArray(movimientos) || movimientos.length === 0) return;
    for (let i = 0; i < movimientos.length; i++) {
        const m = movimientos[i];
        if (!m.lugar) continue;
        await client.query(`
            INSERT INTO comision_movimientos
              (comision_id, orden, lugar, actividad, hora_llegada, hora_salida_lugar, kilometraje, fecha_movimiento)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            comision_id,
            i + 1,
            m.lugar.trim(),
            m.actividad?.trim() || null,
            m.hora_llegada || null,
            m.hora_salida_lugar || null,
            m.kilometraje ? Number(m.kilometraje) : null,
            m.fecha_movimiento || null,
        ]);
    }
};

// ── Helper: cargar movimientos para un array de comisiones ─
const cargarMovimientosParaComisiones = async (comisiones) => {
    const ids = comisiones.map(c => c.id);
    if (ids.length === 0) return comisiones;
    const mRes = await pool.query(`
        SELECT * FROM comision_movimientos
        WHERE comision_id = ANY($1::uuid[])
        ORDER BY comision_id, orden ASC
    `, [ids]);
    const map = {};
    mRes.rows.forEach(m => {
        if (!map[m.comision_id]) map[m.comision_id] = [];
        map[m.comision_id].push(m);
    });
    return comisiones.map(c => ({ ...c, movimientos: map[c.id] || [] }));
};

// GET /api/comisiones/ultima/:vehiculo_id
app.get('/api/comisiones/ultima/:vehiculo_id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT descripcion_comision, kilometraje_ingreso
            FROM bitacora_comisiones
            WHERE vehiculo_id = $1
            ORDER BY fecha_salida DESC, hora_salida DESC
            LIMIT 1
        `, [req.params.vehiculo_id]);
        res.json({ success: true, data: result.rows[0] || null });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error: ' + err.message });
    }
});

// GET /api/comisiones/:id/movimientos
app.get('/api/comisiones/:id/movimientos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM comision_movimientos WHERE comision_id = $1 ORDER BY orden ASC
        `, [req.params.id]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error: ' + err.message });
    }
});

// POST /api/comisiones
app.post('/api/comisiones', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const {
            usuario_id, vehiculo_id, fecha_salida, fecha_entrada,
            descripcion_comision, lugares, acompanantes,
            con_nombramiento, no_nombramiento,
            seccion, kilometraje_salida, kilometraje_ingreso,
            hora_salida, hora_entrada, movimientos
        } = req.body;

        const result = await client.query(`
            INSERT INTO bitacora_comisiones (
                usuario_id, vehiculo_id, fecha_salida, fecha_entrada,
                descripcion_comision, lugares, acompanantes,
                con_nombramiento, no_nombramiento,
                seccion, kilometraje_salida, kilometraje_ingreso,
                hora_salida, hora_entrada, estado
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'PENDIENTE') RETURNING *
        `, [
            usuario_id, vehiculo_id, fecha_salida, fecha_entrada || null,
            descripcion_comision, lugares, acompanantes ?? null,
            con_nombramiento ? true : false,
            con_nombramiento ? (no_nombramiento ?? null) : null,
            seccion, kilometraje_salida, kilometraje_ingreso ?? null,
            hora_salida, hora_entrada ?? null
        ]);

        const comision = result.rows[0];
        await insertarMovimientos(client, comision.id, movimientos);

        if (kilometraje_ingreso) {
            await client.query(`UPDATE vehiculos SET ultimo_kilometraje=$1 WHERE id=$2`,
                               [kilometraje_ingreso, vehiculo_id]);
        }
        await client.query('COMMIT');
        res.status(201).json({ success: true, data: comision });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ success: false, message: 'Error: ' + error.message });
    } finally { client.release(); }
});

// DELETE /api/comisiones/:id
app.delete('/api/comisiones/:id', async (req, res) => {
    try {
        const result = await pool.query(`DELETE FROM bitacora_comisiones WHERE id=$1 RETURNING id`, [req.params.id]);
        if (result.rowCount === 0)
            return res.status(404).json({ success: false, message: 'Registro no encontrado' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error al eliminar: ' + err.message });
    }
});

// PUT /api/comisiones/:id
app.put('/api/comisiones/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const {
            usuario_id, vehiculo_id, fecha_salida, fecha_entrada,
            descripcion_comision, lugares, acompanantes,
            con_nombramiento, no_nombramiento,
            seccion, kilometraje_salida, kilometraje_ingreso,
            hora_salida, hora_entrada, movimientos
        } = req.body;

        const result = await client.query(`
            UPDATE bitacora_comisiones SET
                usuario_id=$1, vehiculo_id=$2, fecha_salida=$3, fecha_entrada=$4,
                descripcion_comision=$5, lugares=$6, acompanantes=$7,
                con_nombramiento=$8, no_nombramiento=$9,
                seccion=$10, kilometraje_salida=$11, kilometraje_ingreso=$12,
                hora_salida=$13, hora_entrada=$14
            WHERE id=$15 RETURNING *
        `, [
            usuario_id, vehiculo_id, fecha_salida, fecha_entrada || null,
            descripcion_comision, lugares, acompanantes ?? null,
            con_nombramiento ? true : false,
            con_nombramiento ? (no_nombramiento ?? null) : null,
            seccion, kilometraje_salida, kilometraje_ingreso ?? null,
            hora_salida, hora_entrada ?? null,
            req.params.id
        ]);

        if (result.rowCount === 0)
            return res.status(404).json({ success: false, message: 'Registro no encontrado' });

        await client.query(`DELETE FROM comision_movimientos WHERE comision_id=$1`, [req.params.id]);
        await insertarMovimientos(client, req.params.id, movimientos);

        if (kilometraje_ingreso) {
            await client.query(`UPDATE vehiculos SET ultimo_kilometraje=$1 WHERE id=$2`,
                               [kilometraje_ingreso, vehiculo_id]);
        }
        await client.query('COMMIT');
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ success: false, message: 'Error: ' + error.message });
    } finally { client.release(); }
});

// GET /api/comisiones/semanal
app.get('/api/comisiones/semanal', async (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;
    try {
        const fi = fecha_inicio || new Date().toISOString().split('T')[0];
        const ff = fecha_fin    || new Date().toISOString().split('T')[0];

        const result = await pool.query(`
            SELECT b.*, u.nombre, u.apellido, v.marca, v.placa
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id
            JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE b.fecha_salida <= $2
              AND COALESCE(b.fecha_entrada, b.fecha_salida) >= $1
            ORDER BY b.fecha_salida ASC, b.hora_salida ASC
        `, [fi, ff]);

        const data = await cargarMovimientosParaComisiones(result.rows);
        res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al consultar' });
    }
});

// ══════════════════════════════════════════════════════════
//  REPORTE EXCEL DE KILOMETRAJE
// ══════════════════════════════════════════════════════════

// Formatea fecha como dd/mm/yyyy
const fmtExcelFecha = (v) => {
    if (!v) return '';
    const s = typeof v === 'string' ? v.split('T')[0]
            : v instanceof Date    ? v.toISOString().split('T')[0]
            : String(v);
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
};

// GET /api/reportes/kilometraje-excel
app.get('/api/reportes/kilometraje-excel', async (req, res) => {
    const {
        fecha_inicio, fecha_fin,
        ids             = '',
        observaciones   = '',
        elaborado_nombre = '', elaborado_cargo   = '',
        vobo1_nombre    = '', vobo1_cargo       = '',
        encargada_nombre = '', encargada_cargo  = '',
        vobo2_nombre    = '', vobo2_cargo       = '',
    } = req.query;

    if (!fecha_inicio || !fecha_fin)
        return res.status(400).json({ success: false, message: 'Fechas requeridas' });

    try {
        // 1. Obtener comisiones en el rango
        const result = await pool.query(`
            SELECT b.*, u.nombre AS conductor_nombre, u.apellido AS conductor_apellido,
                   v.marca, v.placa
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id
            JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE b.fecha_salida <= $2
              AND COALESCE(b.fecha_entrada, b.fecha_salida) >= $1
            ORDER BY b.fecha_salida ASC, b.hora_salida ASC
        `, [fecha_inicio, fecha_fin]);

        if (ids) {
            const idsArray = ids.split(',');
            result.rows = result.rows.filter(r => idsArray.includes(r.id));
        }

        const comisiones = await cargarMovimientosParaComisiones(result.rows);

        // 2. Construir filas del reporte
        const reportRows = [];

        for (const com of comisiones) {
            const movs = com.movimientos || [];

            if (movs.length >= 2) {
                // Pares consecutivos de movimientos → cada par = una fila
                for (let i = 0; i < movs.length - 1; i++) {
                    const from = movs[i];
                    const to   = movs[i + 1];
                    const kmS  = from.kilometraje != null ? Number(from.kilometraje)
                               : i === 0            ? Number(com.kilometraje_salida)
                               : null;
                    const kmL  = to.kilometraje   != null ? Number(to.kilometraje)
                               : i === movs.length - 2 ? Number(com.kilometraje_ingreso)
                               : null;
                    const total = (kmS != null && kmL != null) ? kmL - kmS : null;
                    const fecha = fmtExcelFecha(
                        to.fecha_movimiento || from.fecha_movimiento || com.fecha_salida
                    );
                    reportRows.push({
                        fecha,
                        lugar_salida:  from.lugar,
                        km_salida:     kmS,
                        lugar_llegada: to.lugar,
                        km_llegada:    kmL,
                        total,
                    });
                }
            } else {
                // 0 o 1 movimiento → una fila con los km de la comisión
                const kmS   = Number(com.kilometraje_salida)  || null;
                const kmL   = Number(com.kilometraje_ingreso) || null;
                const total = (kmS != null && kmL != null) ? kmL - kmS : null;
                const lS    = movs[0]?.lugar || com.lugares || '';
                const lL    = movs[0]?.lugar || com.lugares || '';
                reportRows.push({
                    fecha:         fmtExcelFecha(com.fecha_salida),
                    lugar_salida:  lS,
                    km_salida:     kmS,
                    lugar_llegada: lL,
                    km_llegada:    kmL,
                    total,
                });
            }
        }

        const grandTotal = reportRows.reduce((s, r) => s + (Number(r.total) || 0), 0);

        // 3. Generar Excel con exceljs
        const wb = new ExcelJS.Workbook();
        wb.creator = 'INGECOP';
        wb.created = new Date();

        const ws = wb.addWorksheet('Reporte Kilometraje', {
            pageSetup: {
                paperSize: 9, orientation: 'portrait', fitToPage: true,
                margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
            }
        });

        // Anchos de columna (A=margen, B=Fecha, C=LugarS, D=KmS, E=LugarL, F=KmL, G=Total, H=margen)
        ws.columns = [
            { width: 1.5 },  // A
            { width: 12 },   // B Fecha
            { width: 28 },   // C Lugar salida
            { width: 13 },   // D KM salida
            { width: 28 },   // E Lugar llegada
            { width: 13 },   // F KM llegada
            { width: 10 },   // G TOTAL
            { width: 1.5 },  // H
        ];

        const thin = { style: 'thin' };
        const med  = { style: 'medium' };

        const borderAll = (s = 'thin') => ({
            top: { style: s }, left: { style: s }, bottom: { style: s }, right: { style: s }
        });

        const HDR_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        const BOLD11   = { bold: true, size: 11 };

        const setMergedCell = (r, c1, c2, value, font = {}, align = 'center') => {
            ws.mergeCells(r, c1, r, c2);
            const cell = ws.getCell(r, c1);
            cell.value = value;
            cell.font  = font;
            cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
            return cell;
        };

        // ── ENCABEZADO ─────────────────────────────────────────────
        ws.getRow(1).height = 5;

        // Row 2: ANEXO 5
        ws.getRow(2).height = 14;
        const c_anexo = ws.getCell(2, 7);
        c_anexo.value = 'ANEXO 5';
        c_anexo.alignment = { horizontal: 'center' };
        c_anexo.font = { size: 9 };

        // Row 3: nombre institución
        ws.getRow(3).height = 22;
        setMergedCell(3, 2, 7, 'INSPECCIÓN GENERAL DE COOPERATIVAS', { bold: true, size: 14 });

        // Row 4: siglas
        ws.getRow(4).height = 20;
        setMergedCell(4, 2, 7, 'I N G E C O P', { bold: true, size: 13 });

        ws.getRow(5).height = 8;

        // Row 6: sección
        ws.getRow(6).height = 16;
        setMergedCell(6, 2, 7, 'SECCIÓN DE SERVICIOS INTERNOS, TRANSPORTES', { bold: true, size: 11 });

        // Row 7: título reporte
        ws.getRow(7).height = 18;
        setMergedCell(7, 2, 7, 'REPORTE DE KILOMETRAJE', { bold: true, size: 12, underline: true });

        ws.getRow(8).height = 8;
        ws.getRow(9).height = 6;
        ws.getRow(10).height = 6;

        // ── CABECERA DE TABLA ───────────────────────────────────────
        // Fila 11: grupos "Km de salida" y "Km llegada"
        ws.getRow(11).height = 22;

        // Fecha (span filas 11-12)
        ws.mergeCells(11, 2, 12, 2);
        const hFecha = ws.getCell(11, 2);
        hFecha.value = 'Fecha';
        hFecha.font  = BOLD11;
        hFecha.alignment = { horizontal: 'center', vertical: 'middle' };
        hFecha.fill   = HDR_FILL;
        hFecha.border = borderAll('medium');

        // Kilometraje de salida (C11:D11)
        ws.mergeCells(11, 3, 11, 4);
        const hKmS = ws.getCell(11, 3);
        hKmS.value = 'Kilometraje de salida';
        hKmS.font  = BOLD11;
        hKmS.alignment = { horizontal: 'center', vertical: 'middle' };
        hKmS.fill   = HDR_FILL;
        hKmS.border = borderAll('medium');

        // Kilometraje Llegada (E11:F11)
        ws.mergeCells(11, 5, 11, 6);
        const hKmL = ws.getCell(11, 5);
        hKmL.value = 'Kilometraje Llegada';
        hKmL.font  = BOLD11;
        hKmL.alignment = { horizontal: 'center', vertical: 'middle' };
        hKmL.fill   = HDR_FILL;
        hKmL.border = borderAll('medium');

        // TOTAL (G11:G12 span)
        ws.mergeCells(11, 7, 12, 7);
        const hTotal = ws.getCell(11, 7);
        hTotal.value = 'TOTAL';
        hTotal.font  = BOLD11;
        hTotal.alignment = { horizontal: 'center', vertical: 'middle' };
        hTotal.fill   = HDR_FILL;
        hTotal.border = borderAll('medium');

        // Fila 12: sub-encabezados
        ws.getRow(12).height = 20;
        const subHdr = (col, label) => {
            const c = ws.getCell(12, col);
            c.value = label;
            c.font  = { bold: true, size: 10 };
            c.alignment = { horizontal: 'center', vertical: 'middle' };
            c.fill   = HDR_FILL;
            c.border = borderAll('medium');
        };
        subHdr(3, 'Lugar');
        subHdr(4, 'Kilometraje');
        subHdr(5, 'Lugar');
        subHdr(6, 'Kilometraje');

        // ── FILAS DE DATOS ─────────────────────────────────────────
        let row = 13;
        const MIN_ROWS = 12;

        const styleDataCell = (r, col, value, opts = {}) => {
            const c = ws.getCell(r, col);
            c.value  = value !== undefined ? value : null;
            c.border = borderAll('thin');
            c.alignment = { horizontal: opts.align || 'center', vertical: 'middle', wrapText: true };
            if (opts.bold)  c.font = { bold: true };
            if (opts.color) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.color } };
            return c;
        };

        for (const r of reportRows) {
            ws.getRow(row).height = 32;
            styleDataCell(row, 2, r.fecha);
            styleDataCell(row, 3, r.lugar_salida,  { align: 'center' });
            styleDataCell(row, 4, r.km_salida,     { align: 'center' });
            styleDataCell(row, 5, r.lugar_llegada, { align: 'center' });
            styleDataCell(row, 6, r.km_llegada,    { align: 'center' });
            styleDataCell(row, 7, r.total,         { bold: true, align: 'center' });
            row++;
        }

        // Filas vacías hasta completar mínimo
        while (row < 13 + MIN_ROWS) {
            ws.getRow(row).height = 18;
            [2, 3, 4, 5, 6].forEach(col => {
                ws.getCell(row, col).border = borderAll('thin');
                ws.getCell(row, col).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            });
            // Columna TOTAL con fondo verde claro (igual al formato)
            ws.getCell(row, 7).border = borderAll('thin');
            ws.getCell(row, 7).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
            row++;
        }

        // ── FILA TOTAL ─────────────────────────────────────────────
        ws.getRow(row).height = 22;
        ws.mergeCells(row, 2, row, 6);
        const cTL = ws.getCell(row, 2);
        cTL.value = 'TOTAL';
        cTL.font  = { bold: true, size: 12 };
        cTL.alignment = { horizontal: 'center', vertical: 'middle' };
        cTL.border = borderAll('medium');

        const cTV = ws.getCell(row, 7);
        cTV.value = grandTotal;
        cTV.font  = { bold: true, size: 12 };
        cTV.alignment = { horizontal: 'center', vertical: 'middle' };
        cTV.border = borderAll('medium');
        cTV.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
        row++;

        // ── OBSERVACIONES ──────────────────────────────────────────
        ws.getRow(row).height = 8; row++;
        ws.getRow(row).height = 8; row++;

        ws.getRow(row).height = 18;
        ws.getCell(row, 2).value = 'Observaciones:';
        ws.getCell(row, 2).font  = { bold: true };
        ws.mergeCells(row, 3, row, 7);
        const cObs = ws.getCell(row, 3);
        cObs.value  = observaciones;
        cObs.border = { bottom: thin };
        cObs.alignment = { horizontal: 'left', vertical: 'middle' };
        row++;

        for (let i = 0; i < 4; i++) { ws.getRow(row).height = 8; row++; }

        // ── FIRMAS ─────────────────────────────────────────────────
        const firmaBloque = (r, label, nombre, cargo, col_label, col_c1, col_c2, col_v1, col_v2) => {
            ws.getRow(r).height = 16;
            ws.getCell(r, col_label).value = label;
            ws.getCell(r, col_label).font  = { bold: true };
            ws.getCell(r, col_v1).value = 'Vo. Bo.';
            ws.getCell(r, col_v1).font  = { bold: true };

            // Línea de firma
            ws.getRow(r + 1).height = 20;
            ws.mergeCells(r + 1, col_c1, r + 1, col_c2);
            ws.getCell(r + 1, col_c1).border = { bottom: thin };
            ws.mergeCells(r + 1, col_v1 + 1, r + 1, col_v2);
            ws.getCell(r + 1, col_v1 + 1).border = { bottom: thin };

            // Nombre
            ws.getRow(r + 2).height = 14;
            ws.mergeCells(r + 2, col_c1, r + 2, col_c2);
            ws.getCell(r + 2, col_c1).value = nombre || '';
            ws.getCell(r + 2, col_c1).alignment = { horizontal: 'center' };
            ws.getCell(r + 2, col_c1).font = { size: 9, italic: true };
            ws.mergeCells(r + 2, col_v1 + 1, r + 2, col_v2);
            ws.getCell(r + 2, col_v1 + 1).value = '';
            ws.getCell(r + 2, col_v1 + 1).alignment = { horizontal: 'center' };

            // Cargo
            ws.getRow(r + 3).height = 14;
            ws.mergeCells(r + 3, col_c1, r + 3, col_c2);
            ws.getCell(r + 3, col_c1).value = cargo || '';
            ws.getCell(r + 3, col_c1).alignment = { horizontal: 'center' };
            ws.getCell(r + 3, col_c1).font = { size: 9 };
            ws.mergeCells(r + 3, col_v1 + 1, r + 3, col_v2);
            ws.getCell(r + 3, col_v1 + 1).value = '';
        };

        // Elaborado por (izquierda) | Vo. Bo. 1 (derecha)
        firmaBloque(row, 'Elaborado por:', elaborado_nombre, elaborado_cargo, 2, 3, 4, 5, 7);
        // Vo.Bo. nombre y cargo (derecha)
        ws.getCell(row + 2, 5).value = vobo1_nombre;
        ws.getCell(row + 2, 5).alignment = { horizontal: 'center' };
        ws.getCell(row + 2, 5).font = { size: 9, italic: true };
        ws.mergeCells(row + 2, 5, row + 2, 7);
        ws.getCell(row + 3, 5).value = vobo1_cargo;
        ws.getCell(row + 3, 5).alignment = { horizontal: 'center' };
        ws.getCell(row + 3, 5).font = { size: 9 };
        ws.mergeCells(row + 3, 5, row + 3, 7);
        row += 4;

        for (let i = 0; i < 3; i++) { ws.getRow(row).height = 8; row++; }

        // Encargada (izquierda) | Vo. Bo. 2 (derecha)
        firmaBloque(row, 'Encargada:', encargada_nombre, encargada_cargo, 2, 3, 4, 5, 7);
        ws.getCell(row + 2, 5).value = vobo2_nombre;
        ws.getCell(row + 2, 5).alignment = { horizontal: 'center' };
        ws.getCell(row + 2, 5).font = { size: 9, italic: true };
        ws.mergeCells(row + 2, 5, row + 2, 7);
        ws.getCell(row + 3, 5).value = vobo2_cargo;
        ws.getCell(row + 3, 5).alignment = { horizontal: 'center' };
        ws.getCell(row + 3, 5).font = { size: 9 };
        ws.mergeCells(row + 3, 5, row + 3, 7);

        // ── Enviar respuesta ──────────────────────────────────────
        res.setHeader('Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition',
            `attachment; filename=Reporte_KM_${fecha_inicio}_al_${fecha_fin}.xlsx`);
        await wb.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Error generando Excel:', err);
        res.status(500).json({ success: false, message: 'Error al generar Excel: ' + err.message });
    }
});

// ══════════════════════════════════════════════════════════
//  PDF
// ══════════════════════════════════════════════════════════
const generarPDF = (registros, titulo, doc) => {
    const fmtHora = (v) => {
        if (!v) return 'Pendiente';
        if (typeof v === 'string') return v.substring(0, 5);
        if (v instanceof Date) return v.toISOString().substring(11, 16);
        return String(v).substring(0, 5);
    };
    const fmtFecha = (v) => v instanceof Date ? v.toISOString().split('T')[0]
        : typeof v === 'string' ? v.split('T')[0] : String(v ?? '');

    registros.forEach((data, idx) => {
        if (idx > 0) doc.addPage();

        if (fs.existsSync('logo.png')) {
            doc.image('logo.png', 40, 25, { width: 75 });
        }

        doc.y = 40;
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a365d')
           .text('INSPECCIÓN GENERAL DE COOPERATIVAS', { align: 'center' });
        doc.moveDown(0.2);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333')
           .text('AUTORIZACIÓN Y CONTROL DE SALIDA DE VEHÍCULOS', { align: 'center' });
        if (titulo) {
            doc.moveDown(0.2);
            doc.fontSize(10).font('Helvetica').fillColor('#666666').text(titulo, { align: 'center' });
        }

        if (doc.y < 125) doc.y = 125;
        else doc.moveDown(1);

        doc.moveTo(40, doc.y).lineTo(555, doc.y).lineWidth(1).strokeColor('#cccccc').stroke();
        doc.moveDown(1);

        const drawSection = (title) => {
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a365d').text(title);
            doc.moveDown(0.5);
        };
        const row = (lbl, val) => {
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#444444').text(`${lbl}: `, { continued: true });
            doc.font('Helvetica').fillColor('black').text(String(val ?? 'N/A'));
            doc.moveDown(0.3);
        };

        const fechaSalida  = fmtFecha(data.fecha_salida);
        const fechaEntrada = data.fecha_entrada ? fmtFecha(data.fecha_entrada) : null;
        const rangoFecha   = fechaEntrada && fechaEntrada !== fechaSalida
            ? `${fechaSalida}  al  ${fechaEntrada}` : fechaSalida;

        drawSection('DATOS GENERALES');
        row('Fecha',     rangoFecha);
        row('Vehículo',  `${data.marca}  —  Placa: ${data.placa}`);
        row('Conductor', `${data.nombre} ${data.apellido}`);
        row('Sección',   data.seccion);

        doc.moveDown(1);
        drawSection('DETALLES DE LA COMISIÓN');
        row('Comisión',     data.descripcion_comision);
        row('Acompañantes', data.acompanantes || 'Ninguno');
        if (data.con_nombramiento) row('No. Nombramiento', data.no_nombramiento);

        const movs = data.movimientos || [];
        if (movs.length > 0) {
            doc.moveDown(1);
            drawSection('LUGARES Y ACTIVIDADES REALIZADAS');
            movs.forEach((m, i) => {
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a365d')
                   .text(`${i + 1}. ${m.lugar}`);
                if (m.actividad) {
                    doc.font('Helvetica').fontSize(9).fillColor('#333333')
                       .text(`   Actividad: ${m.actividad}`);
                }
                const hs = [];
                if (m.hora_llegada)      hs.push(`Llegada: ${fmtHora(m.hora_llegada)}`);
                if (m.hora_salida_lugar) hs.push(`Salida: ${fmtHora(m.hora_salida_lugar)}`);
                if (m.kilometraje)       hs.push(`Km: ${m.kilometraje}`);
                if (hs.length > 0)
                    doc.font('Helvetica').fontSize(9).fillColor('#666666').text(`   ${hs.join('  •  ')}`);
                doc.moveDown(0.3);
            });
        } else if (data.lugares) {
            row('Lugares', data.lugares);
        }

        doc.moveDown(1);
        drawSection('CONTROL DE KILOMETRAJE Y HORARIO');

        const col2 = (l1, v1, l2, v2) => {
            const y = doc.y;
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#444444')
               .text(`${l1}: `, 40, y, { continued: true, width: 250 });
            doc.font('Helvetica').fillColor('black').text(String(v1 ?? 'N/A'), { width: 200 });
            doc.font('Helvetica-Bold').fillColor('#444444')
               .text(`${l2}: `, 310, y, { continued: true, width: 250 });
            doc.font('Helvetica').fillColor('black').text(String(v2 ?? 'N/A'), { width: 200 });
            doc.moveDown(0.5);
        };

        col2('Hora Salida', fmtHora(data.hora_salida), 'Hora Entrada', fmtHora(data.hora_entrada));
        col2('KM Salida', data.kilometraje_salida, 'KM Ingreso', data.kilometraje_ingreso ?? 'Pendiente');

        doc.moveDown(1);
        const totalRectY = doc.y;
        doc.roundedRect(40, totalRectY, 515, 30, 5).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12)
           .text(`TOTAL KILÓMETROS RECORRIDOS: ${data.total_kilometros ?? 'Pendiente'} Km`,
                 50, totalRectY + 9, { align: 'center' });
        doc.y = totalRectY + 45;
    });
};

app.get('/api/comisiones/pdf-semana', async (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;
    try {
        const result = await pool.query(`
            SELECT b.*, u.nombre, u.apellido, v.marca, v.placa
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE b.fecha_salida <= $2
              AND COALESCE(b.fecha_entrada, b.fecha_salida) >= $1
            ORDER BY b.fecha_salida ASC, b.hora_salida ASC
        `, [fecha_inicio, fecha_fin]);
        if (!result.rows.length) return res.status(404).send('Sin registros para esa semana');
        const registros = await cargarMovimientosParaComisiones(result.rows);
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Semana_${fecha_inicio}_${fecha_fin}.pdf`);
        doc.pipe(res);
        generarPDF(registros, `Semana: ${fecha_inicio} al ${fecha_fin}`, doc);
        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al generar PDF');
    }
});

app.get('/api/comisiones/pdf-dia/:fecha', async (req, res) => {
    const { fecha } = req.params;
    try {
        const result = await pool.query(`
            SELECT b.*, u.nombre, u.apellido, v.marca, v.placa
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE b.fecha_salida <= $1
              AND COALESCE(b.fecha_entrada, b.fecha_salida) >= $1
            ORDER BY b.hora_salida ASC
        `, [fecha]);
        if (!result.rows.length) return res.status(404).send('Sin registros para esa fecha');
        const registros = await cargarMovimientosParaComisiones(result.rows);
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Dia_${fecha}.pdf`);
        doc.pipe(res);
        generarPDF(registros, `Registros del ${fecha}`, doc);
        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al generar PDF');
    }
});

app.get('/api/comisiones/:id/pdf', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, u.nombre, u.apellido, v.marca, v.placa
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE b.id=$1
        `, [req.params.id]);
        if (!result.rows.length) return res.status(404).send('No encontrado');
        const [data] = await cargarMovimientosParaComisiones(result.rows);
        await pool.query(`UPDATE bitacora_comisiones SET estado='DESCARGADO' WHERE id=$1`, [req.params.id]);
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const fecha = data.fecha_salida instanceof Date
            ? data.fecha_salida.toISOString().split('T')[0] : String(data.fecha_salida ?? '').split('T')[0];
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Boleta_${fecha}.pdf`);
        doc.pipe(res);
        generarPDF([data], null, doc);
        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al generar PDF');
    }
});

// ══════════════════════════════════════════════════════════
//  CIERRE ANUAL
// ══════════════════════════════════════════════════════════
app.post('/api/admin/cierre-anual', async (req, res) => {
    const { anio } = req.body;
    try {
        const result = await pool.query(`
            SELECT b.fecha_salida, b.fecha_entrada, b.hora_salida, b.hora_entrada,
                   CONCAT(u.nombre,' ',u.apellido) AS conductor,
                   v.placa, v.marca, b.departamento, b.seccion,
                   b.descripcion_comision, b.lugares, b.acompanantes,
                   b.kilometraje_salida, b.kilometraje_ingreso, b.total_kilometros
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE EXTRACT(YEAR FROM b.fecha_salida) = $1 ORDER BY b.fecha_salida ASC
        `, [anio]);
        if (!result.rows.length)
            return res.status(400).json({ success: false, message: 'Sin registros para ese año' });
        const csv = new Parser().parse(result.rows);
        await pool.query(`DELETE FROM bitacora_comisiones WHERE EXTRACT(YEAR FROM fecha_salida)=$1`, [anio]);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=Respaldo_${anio}.csv`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error: ' + err.message });
    }
});

app.get('/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT version() AS v, NOW() AS t');
        res.json({ status: 'OK', datos: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'Error', detalle: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend activo en el puerto ${PORT}`));