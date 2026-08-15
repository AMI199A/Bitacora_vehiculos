require('dotenv').config();
const sql = require('mssql');
const dbConfig = {
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER, database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true }
};
sql.connect(dbConfig).then(async () => {
    try {
        await sql.query(`ALTER TABLE usuarios DROP CONSTRAINT CK__usuarios__rol__4D94879B`);
        console.log('Old constraint dropped');
    } catch(e) { console.log('Error dropping:', e.message); }

    try {
        await sql.query(`ALTER TABLE usuarios ADD CONSTRAINT CK_usuarios_rol CHECK (rol IN ('admin', 'analista', 'conductor', 'usuario'))`);
        console.log('New constraint added');
    } catch(e) { console.log('Error adding:', e.message); }

    process.exit(0);
}).catch(console.error);
