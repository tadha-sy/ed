const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'temanbelajar',
  waitForConnections: true,
  connectionLimit: 10,
  ssl: process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false
});

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Database MySQL terhubung');
    conn.release();
  } catch (err) {
    console.error('❌ Koneksi database gagal:', err.message);
  }
})();

module.exports = pool;
