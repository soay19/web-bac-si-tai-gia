const mysql = require('mysql2/promise');

const isDbDisabled = String(process.env.MYSQL_DISABLED || 'false').toLowerCase() === 'true';

const pool = isDbDisabled
  ? null
  : mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'that_clinic',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

async function initDb() {
  if (isDbDisabled || !pool) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      state_key VARCHAR(120) PRIMARY KEY,
      state_value JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

module.exports = {
  pool,
  initDb,
  isDbDisabled
};
