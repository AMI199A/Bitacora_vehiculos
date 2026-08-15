require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
});

const hash = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex');

async function createAdmin() {
    try {
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const nombre = 'Admin';
        const apellido = 'Sistema';
        const rol = 'admin';

        // Intentar eliminar si ya existe para evitar errores en pruebas
        await pool.query('DELETE FROM usuarios WHERE nombre=$1 AND apellido=$2', [nombre, apellido]);

        const result = await pool.query(`
            INSERT INTO usuarios (nombre, apellido, password_hash, rol, codigo_aceptacion, primer_ingreso)
            VALUES ($1, $2, $3, $4, $5, true)
            RETURNING id, nombre, apellido, rol, codigo_aceptacion, primer_ingreso
        `, [nombre, apellido, hash(codigo), rol, codigo]);

        console.log('✅ Usuario Administrador creado exitosamente.');
        console.log('--- DATOS DEL USUARIO ---');
        console.log(`Nombre: ${result.rows[0].nombre}`);
        console.log(`Apellido: ${result.rows[0].apellido}`);
        console.log(`Rol: ${result.rows[0].rol}`);
        console.log(`CÓDIGO DE PRIMER INGRESO: ${result.rows[0].codigo_aceptacion}`);
        console.log('-------------------------');
    } catch (err) {
        console.error('❌ Error creando administrador:', err);
    } finally {
        pool.end();
    }
}

createAdmin();
