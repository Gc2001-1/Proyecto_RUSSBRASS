const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.on('connect', () => {
    console.log('✅ Conectado exitosamente a PostgreSQL');
});

pool.on('error', (err) => {
    console.error('❌ Error de conexión en PostgreSQL:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    // Cliente dedicado para transacciones: BEGIN/COMMIT/ROLLBACK deben ir en la misma conexión.
    // Quien lo pida debe llamar a client.release() al terminar.
    getClient: () => pool.connect(),
    pool,
};
