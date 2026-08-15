require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const sql      = require('mssql');
const PDFDocument = require('pdfkit');
const { Parser }  = require('json2csv');
const crypto      = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ── DB Config ──────────────────────────────────────────────
const dbConfig = {
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER, database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true }
};
sql.connect(dbConfig)
    .then(() => console.log('✅ Conexión exitosa a SQL Server'))
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
        const r = new sql.Request();
        r.input('nombre',   sql.VarChar(100), nombre.trim());
        r.input('apellido', sql.VarChar(100), apellido.trim());
        const result = await r.query(
            `SELECT * FROM usuarios WHERE nombre = @nombre AND apellido = @apellido`
        );
        if (!result.recordset.length)
            return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
        const u = result.recordset[0];
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
        const r = new sql.Request();
        r.input('nombre',   sql.VarChar(100), nombre.trim());
        r.input('apellido', sql.VarChar(100), apellido.trim());
        r.input('codigo',   sql.VarChar(50),  codigo.trim());
        const result = await r.query(
            `SELECT * FROM usuarios WHERE nombre=@nombre AND apellido=@apellido AND codigo_aceptacion=@codigo`
        );
        if (!result.recordset.length)
            return res.status(401).json({ success: false, message: 'Código de aceptación inválido o datos incorrectos' });
        const u = result.recordset[0];
        const upd = new sql.Request();
        upd.input('id',   sql.UniqueIdentifier, u.id);
        upd.input('hash', sql.VarChar(64),      hash(nueva_password));
        await upd.query(`UPDATE usuarios SET password_hash=@hash, primer_ingreso=0 WHERE id=@id`);
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
        const r = new sql.Request();
        r.input('id',   sql.UniqueIdentifier, usuario_id);
        r.input('hash', sql.VarChar(64),      hash(nueva_password));
        await r.query(`UPDATE usuarios SET password_hash=@hash, primer_ingreso=0 WHERE id=@id`);
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
        const result = await sql.query(
            `SELECT id, nombre, apellido, rol, primer_ingreso, codigo_aceptacion, created_at FROM usuarios ORDER BY nombre`
        );
        res.json({ success: true, data: result.recordset });
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
        const r = new sql.Request();
        r.input('nombre',   sql.VarChar(100), nombre.trim());
        r.input('apellido', sql.VarChar(100), apellido.trim());
        r.input('rol',      sql.VarChar(50),  rol || 'conductor');
        r.input('codigo',   sql.VarChar(50),  codigo);
        r.input('hash',     sql.VarChar(64),  hash(codigo));
        const result = await r.query(`
            INSERT INTO usuarios (id, nombre, apellido, password_hash, rol, codigo_aceptacion, primer_ingreso)
            OUTPUT INSERTED.id, INSERTED.nombre, INSERTED.apellido, INSERTED.rol,
                   INSERTED.codigo_aceptacion, INSERTED.primer_ingreso
            VALUES (NEWID(), @nombre, @apellido, @hash, @rol, @codigo, 1)
        `);
        res.status(201).json({ success: true, data: result.recordset[0], codigo });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error al crear usuario' });
    }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    try {
        const r = new sql.Request();
        r.input('id', sql.UniqueIdentifier, req.params.id);
        await r.query(`DELETE FROM usuarios WHERE id=@id`);
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
        const r = new sql.Request();
        r.input('id', sql.UniqueIdentifier, req.params.id);
        r.input('nombre', sql.VarChar(100), nombre.trim());
        r.input('apellido', sql.VarChar(100), apellido.trim());
        r.input('rol', sql.VarChar(50), rol || 'conductor');
        
        await r.query(`
            UPDATE usuarios 
            SET nombre = @nombre, apellido = @apellido, rol = @rol
            WHERE id = @id
        `);
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
        const r = new sql.Request();
        r.input('id',     sql.UniqueIdentifier, req.params.id);
        r.input('codigo', sql.VarChar(50),      codigo);
        r.input('hash',   sql.VarChar(64),      hash(codigo));
        await r.query(`UPDATE usuarios SET password_hash=@hash, codigo_aceptacion=@codigo, primer_ingreso=1 WHERE id=@id`);
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
        const result = await sql.query(`SELECT * FROM vehiculos ORDER BY marca`);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error' });
    }
});

app.post('/api/vehiculos', async (req, res) => {
    const { placa, marca, ultimo_kilometraje } = req.body;
    if (!placa || !marca)
        return res.status(400).json({ success: false, message: 'Placa y marca requeridos' });
    try {
        const r = new sql.Request();
        r.input('placa', sql.VarChar(20),  placa.trim().toUpperCase());
        r.input('marca', sql.VarChar(100), marca.trim());
        r.input('km',    sql.Numeric(10,2), Number(ultimo_kilometraje) || 0);
        const result = await r.query(`
            INSERT INTO vehiculos (placa, marca, ultimo_kilometraje)
            OUTPUT INSERTED.*
            VALUES (@placa, @marca, @km)
        `);
        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error: ' + err.message });
    }
});

app.delete('/api/vehiculos/:id', async (req, res) => {
    try {
        const r = new sql.Request();
        r.input('id', sql.Int, req.params.id);
        await r.query(`DELETE FROM vehiculos WHERE id=@id`);
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
    const transaction = new sql.Transaction();
    try {
        await transaction.begin();
        const {
            usuario_id, vehiculo_id, fecha_salida, descripcion_comision,
            lugares, acompanantes, con_nombramiento, no_nombramiento,
            departamento, seccion, kilometraje_salida, kilometraje_ingreso,
            hora_salida, hora_entrada
        } = req.body;

        const r = new sql.Request(transaction);
        r.input('usuario_id',           sql.UniqueIdentifier, usuario_id);
        r.input('vehiculo_id',          sql.Int,              vehiculo_id);
        r.input('fecha_salida',         sql.Date,             fecha_salida);
        r.input('descripcion_comision', sql.VarChar(500),     descripcion_comision);
        r.input('lugares',              sql.VarChar(300),     lugares);
        r.input('acompanantes',         sql.VarChar(300),     acompanantes ?? null);
        r.input('con_nombramiento',     sql.Bit,              con_nombramiento ? 1 : 0);
        r.input('no_nombramiento',      sql.VarChar(50),      con_nombramiento ? (no_nombramiento ?? null) : null);
        r.input('departamento',         sql.VarChar(100),     departamento);
        r.input('seccion',              sql.VarChar(100),     seccion);
        r.input('kilometraje_salida',   sql.Numeric(10,2),    kilometraje_salida);
        r.input('kilometraje_ingreso',  sql.Numeric(10,2),    kilometraje_ingreso ?? null);
        r.input('hora_salida',          sql.VarChar(8),       hora_salida);
        r.input('hora_entrada',         sql.VarChar(8),       hora_entrada ?? null);
        const totalKm = (kilometraje_ingreso && kilometraje_salida)
            ? (Number(kilometraje_ingreso) - Number(kilometraje_salida)) : null;
        r.input('total_km', sql.Numeric(10,2), totalKm);

        const result = await r.query(`
            INSERT INTO bitacora_comisiones (
                id, usuario_id, vehiculo_id, fecha_salida, descripcion_comision,
                lugares, acompanantes, con_nombramiento, no_nombramiento,
                departamento, seccion, kilometraje_salida, kilometraje_ingreso,
                hora_salida, hora_entrada, estado
            )
            OUTPUT INSERTED.*
            VALUES (
                NEWID(), @usuario_id, @vehiculo_id, @fecha_salida, @descripcion_comision,
                @lugares, @acompanantes, @con_nombramiento, @no_nombramiento,
                @departamento, @seccion, @kilometraje_salida, @kilometraje_ingreso,
                @hora_salida, @hora_entrada, 'PENDIENTE'
            )
        `);

        if (kilometraje_ingreso) {
            const u = new sql.Request(transaction);
            u.input('km',  kilometraje_ingreso);
            u.input('vid', sql.Int, vehiculo_id);
            await u.query(`UPDATE vehiculos SET ultimo_kilometraje=@km WHERE id=@vid`);
        }
        await transaction.commit();
        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        await transaction.rollback();
        console.error(error);
        res.status(500).json({ success: false, message: 'Error: ' + error.message });
    }
});

// GET /api/comisiones/semanal
app.get('/api/comisiones/semanal', async (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;
    try {
        const r = new sql.Request();
        r.input('fi', sql.Date, fecha_inicio || new Date());
        r.input('ff', sql.Date, fecha_fin    || new Date());
        const result = await r.query(`
            SELECT b.*, u.nombre, u.apellido, v.marca, v.placa
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id
            JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE b.fecha_salida BETWEEN @fi AND @ff
            ORDER BY b.fecha_salida ASC, b.hora_salida ASC
        `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar' });
    }
});

// ── Generador de PDF reutilizable ────────────────────────
const fs = require('fs');
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
        const r = new sql.Request();
        r.input('fi', sql.Date, fecha_inicio);
        r.input('ff', sql.Date, fecha_fin);
        const result = await r.query(`
            SELECT b.*, u.nombre, u.apellido, v.marca, v.placa
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE b.fecha_salida BETWEEN @fi AND @ff ORDER BY b.fecha_salida ASC, b.hora_salida ASC
        `);
        if (!result.recordset.length) return res.status(404).send('Sin registros para esa semana');
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Semana_${fecha_inicio}_${fecha_fin}.pdf`);
        doc.pipe(res);
        generarPDF(result.recordset, `Semana: ${fecha_inicio} al ${fecha_fin}`, doc);
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
        const r = new sql.Request();
        r.input('fecha', sql.Date, fecha);
        const result = await r.query(`
            SELECT b.*, u.nombre, u.apellido, v.marca, v.placa
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE b.fecha_salida=@fecha ORDER BY b.hora_salida ASC
        `);
        if (!result.recordset.length) return res.status(404).send('Sin registros para esa fecha');
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Dia_${fecha}.pdf`);
        doc.pipe(res);
        generarPDF(result.recordset, `Registros del ${fecha}`, doc);
        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al generar PDF');
    }
});

// GET /api/comisiones/:id/pdf — boleta individual
app.get('/api/comisiones/:id/pdf', async (req, res) => {
    try {
        const r = new sql.Request();
        r.input('id', sql.UniqueIdentifier, req.params.id);
        const result = await r.query(`
            SELECT b.*, u.nombre, u.apellido, v.marca, v.placa
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE b.id=@id
        `);
        if (!result.recordset.length) return res.status(404).send('No encontrado');
        const data = result.recordset[0];
        const upd = new sql.Request();
        upd.input('id', sql.UniqueIdentifier, req.params.id);
        await upd.query(`UPDATE bitacora_comisiones SET estado='DESCARGADO' WHERE id=@id`);
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
        const r = new sql.Request();
        r.input('anio', sql.Int, anio);
        const result = await r.query(`
            SELECT b.fecha_salida, b.hora_salida, b.hora_entrada,
                   CONCAT(u.nombre,' ',u.apellido) AS conductor,
                   v.placa, v.marca, b.departamento, b.seccion,
                   b.descripcion_comision, b.lugares, b.acompanantes,
                   b.kilometraje_salida, b.kilometraje_ingreso, b.total_kilometros
            FROM bitacora_comisiones b
            JOIN usuarios u ON b.usuario_id=u.id JOIN vehiculos v ON b.vehiculo_id=v.id
            WHERE YEAR(b.fecha_salida)=@anio ORDER BY b.fecha_salida ASC
        `);
        if (!result.recordset.length)
            return res.status(400).json({ success: false, message: 'Sin registros para ese año' });
        const csv = new Parser().parse(result.recordset);
        const del = new sql.Request();
        del.input('anio', sql.Int, anio);
        await del.query(`DELETE FROM bitacora_comisiones WHERE YEAR(fecha_salida)=@anio`);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=Respaldo_${anio}.csv`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error: ' + err.message });
    }
});

app.get('/test-db', async (req, res) => {
    try {
        const r = await sql.query('SELECT @@VERSION AS v, GETDATE() AS t');
        res.json({ status: 'OK', datos: r.recordset });
    } catch (err) {
        res.status(500).json({ status: 'Error', detalle: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend activo en el puerto ${PORT}`));