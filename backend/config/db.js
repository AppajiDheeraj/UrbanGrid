const mysql = require('mysql2/promise');

let pool;

const createPool = () =>
  mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT, 10) || 10,
    queueLimit: 0
  });

const connectDB = async () => {
  if (!pool) {
    pool = createPool();
  }

  const connection = await pool.getConnection();

  try {
    await connection.query('SELECT 1');
    console.log(
      `MySQL Connected: ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT || 3306}/${process.env.MYSQL_DATABASE}`
    );
  } finally {
    connection.release();
  }

  return pool;
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database pool has not been initialized');
  }

  return pool;
};

module.exports = connectDB;
module.exports.getPool = getPool;
