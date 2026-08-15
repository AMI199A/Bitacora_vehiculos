require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const { Parser }  = require('json2csv');
const crypto      = require('crypto');
const fs = require('fs');

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
    ssl: { rejectUnauthorized: false } // Requerido por Supabase
});

pool.connect()
    .then(() => console.log('✅ Conexión exitosa a PostgreSQL (Supabase)'))
    .catch(err => console.error('❌ Error BD:', err));

const hash = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex');

// ══════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════

// POST /api/auth/login
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

// POST /api/auth/activar — primer uso con código de aceptación
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

// POST /api/auth/cambiar-password
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

// POST /api/usuarios — admin crea usuario y el sistema genera código de aceptación
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

// PUT /api/usuarios/:id — admin edita usuario (nombre, apellido, rol)
app.put('/api/usuarios/:id', async (req, res) => {
    const { nombre, apellido, rol } = req.body;
    if (!nombre || !apellido)
        return res.status(400).json({ success: false, message: 'Nombre y apellido requeridos' });
    try {
        await pool.query(`
            UPDATE usuarios 
            SET nombre = $1, apellido = $2, rol = $3
            WHERE id = $4
        `, [nombre.trim(), apellido.trim(), rol || 'conductor', req.params.id]);
        res.json({ success: true, message: 'Usuario actualizado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
    }
});

// PUT /api/usuarios/:id/reset-password — admin resetea, genera nuevo código
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
            INSERT INTO vehiculos (placa, marca, ultimo_kilometraje)
            VALUES ($1, $2, $3)
            RETURNING *
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

// POST /api/comisiones
app.post('/api/comisiones', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const {
            usuario_id, vehiculo_id, fecha_salida, descripcion_comision,
            lugares, acompanantes, con_nombramiento, no_nombramiento,
            departamento, seccion, kilometraje_salida, kilometraje_ingreso,
            hora_salida, hora_entrada
        } = req.body;

        const result = await client.query(`
            INSERT INTO bitacora_comisiones (
                usuario_id, vehiculo_id, fecha_salida, descripcion_comision,
                lugares, acompanantes, con_nombramiento, no_nombramiento,
                departamento, seccion, kilometraje_salida, kilometraje_ingreso,
                hora_salida, hora_entrada, estado
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'PENDIENTE'
            ) RETURNING *
        `, [
            usuario_id, vehiculo_id, fecha_salida, descripcion_comision,
            lugares, acompanantes ?? null, con_nombramiento ? true : false, 
            con_nombramiento ? (no_nombramiento ?? null) : null,
            departamento, seccion, kilometraje_salida, kilometraje_ingreso ?? null,
            hora_salida, hora_entrada ?? null
        ]);

        if (kilometraje_ingreso) {
            await client.query(`UPDATE vehiculos SET ultimo_kilometraje=$1 WHERE id=$2`, 
                               [kilometraje_ingreso, vehiculo_id]);
        }
        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ success: false, message: 'Error: ' + error.message });
    } finally {
        client.release();
    }
});

// GET /api/comisiones/semanal
app.get('/api/comisiones/semanal', async (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;
    try {
        const fi = fecha_inicio || new Date().toISOString().split('T')[0];
        const ff = fecha_fin || new Date().toISOString().split('T')[0];
        
        const result = await pool.query(`
            SELECT b.*, u.nombre, u.apellido, v.marca, v.placa
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id
            JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE b.fecha_salida BETWEEN $1 AND $2
            ORDER BY b.fecha_salida ASC, b.hora_salida ASC
        `, [fi, ff]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar' });
    }
});

// ── Generador de PDF reutilizable ────────────────────────
const generarPDF = (registros, titulo, doc) => {
    const fmt = (v) => v instanceof Date ? v.toISOString().substring(11,16) : (v ?? 'Pendiente');
    const fmtFecha = (v) => v instanceof Date ? v.toISOString().split('T')[0] : (typeof v === 'string' ? v.split('T')[0] : String(v ?? ''));

    registros.forEach((data, idx) => {
        if (idx > 0) doc.addPage();

        // Logo INGECOP
        if (fs.existsSync('logo.png')) {
            doc.image('logo.png', 40, 25, { width: 75 });
        }

        // Encabezado
        doc.y = 40;
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a365d').text('INSPECCIÓN GENERAL DE COOPERATIVAS', { align: 'center' });
        doc.moveDown(0.2);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333').text('AUTORIZACIÓN Y CONTROL DE SALIDA DE VEHÍCULOS', { align: 'center' });
        if (titulo) {
            doc.moveDown(0.2);
            doc.fontSize(10).font('Helvetica').fillColor('#666666').text(titulo, { align: 'center' });
        }
        
        // Asegurarse de que la línea separadora quede por debajo del logo
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

        drawSection('DATOS GENERALES');
        row('Fecha',        fmtFecha(data.fecha_salida));
        row('Vehículo',     `${data.marca}  —  Placa: ${data.placa}`);
        row('Conductor',    `${data.nombre} ${data.apellido}`);
        row('Departamento', data.departamento);
        row('Sección',      data.seccion);
        
        doc.moveDown(1);
        drawSection('DETALLES DE LA COMISIÓN');
        row('Comisión',     data.descripcion_comision);
        row('Lugares',      data.lugares);
        row('Acompañantes', data.acompanantes || 'Ninguno');
        if (data.con_nombramiento) row('No. Nombramiento', data.no_nombramiento);

        doc.moveDown(1);
        drawSection('CONTROL DE KILOMETRAJE Y HORARIO');
        
        // Grid: 2 columnas
        const col2 = (l1,v1,l2,v2) => {
            const y = doc.y;
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#444444').text(`${l1}: `, 40, y, { continued: true, width: 250 });
            doc.font('Helvetica').fillColor('black').text(String(v1 ?? 'N/A'), { width: 200 });
            doc.font('Helvetica-Bold').fillColor('#444444').text(`${l2}: `, 310, y, { continued: true, width: 250 });
            doc.font('Helvetica').fillColor('black').text(String(v2 ?? 'N/A'), { width: 200 });
            doc.moveDown(0.5);
        };

        col2('Hora Salida', fmt(data.hora_salida), 'Hora Entrada', fmt(data.hora_entrada));
        col2('KM Salida', data.kilometraje_salida, 'KM Ingreso', data.kilometraje_ingreso ?? 'Pendiente');

        doc.moveDown(1);
        
        const totalRectY = doc.y;
        doc.roundedRect(40, totalRectY, 515, 30, 5).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12)
           .text(`TOTAL KILÓMETROS RECORRIDOS: ${data.total_kilometros ?? 'Pendiente'} Km`, 50, totalRectY + 9, { align: 'center' });

        doc.y = totalRectY + 45;
        // Firma eliminada por solicitud
    });
};

// GET /api/comisiones/pdf-semana
app.get('/api/comisiones/pdf-semana', async (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;
    try {
        const result = await pool.query(`
            SELECT b.*, u.nombre, u.apellido, v.marca, v.placa
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE b.fecha_salida BETWEEN $1 AND $2 ORDER BY b.fecha_salida ASC, b.hora_salida ASC
        `, [fecha_inicio, fecha_fin]);
        
        if (!result.rows.length) return res.status(404).send('Sin registros para esa semana');
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Semana_${fecha_inicio}_${fecha_fin}.pdf`);
        doc.pipe(res);
        generarPDF(result.rows, `Semana: ${fecha_inicio} al ${fecha_fin}`, doc);
        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al generar PDF');
    }
});

// GET /api/comisiones/pdf-dia/:fecha
app.get('/api/comisiones/pdf-dia/:fecha', async (req, res) => {
    const { fecha } = req.params;
    try {
        const result = await pool.query(`
            SELECT b.*, u.nombre, u.apellido, v.marca, v.placa
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE b.fecha_salida=$1 ORDER BY b.hora_salida ASC
        `, [fecha]);
        
        if (!result.rows.length) return res.status(404).send('Sin registros para esa fecha');
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Dia_${fecha}.pdf`);
        doc.pipe(res);
        generarPDF(result.rows, `Registros del ${fecha}`, doc);
        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al generar PDF');
    }
});

// GET /api/comisiones/:id/pdf — boleta individual
app.get('/api/comisiones/:id/pdf', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, u.nombre, u.apellido, v.marca, v.placa
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE b.id=$1
        `, [req.params.id]);
        
        if (!result.rows.length) return res.status(404).send('No encontrado');
        const data = result.rows[0];
        
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

// POST /api/admin/cierre-anual
app.post('/api/admin/cierre-anual', async (req, res) => {
    const { anio } = req.body;
    try {
        const result = await pool.query(`
            SELECT b.fecha_salida, b.hora_salida, b.hora_entrada,
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