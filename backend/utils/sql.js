const connectDB = require('../config/db');

const query = async (sql, params = []) => {
  const pool = connectDB.getPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
};

const queryOne = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows[0] || null;
};

const run = async (sql, params = []) => {
  const pool = connectDB.getPool();
  const [result] = await pool.execute(sql, params);
  return result;
};

const withTransaction = async (callback) => {
  const pool = connectDB.getPool();
  const connection = await pool.getConnection();

  const tx = {
    query: async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows;
    },
    queryOne: async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows[0] || null;
    },
    run: async (sql, params = []) => {
      const [result] = await connection.execute(sql, params);
      return result;
    }
  };

  try {
    await connection.beginTransaction();
    const result = await callback(tx);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const parseJsonArray = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const parseJsonObject = (value, fallback = null) => {
  if (!value) {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

module.exports = {
  query,
  queryOne,
  run,
  withTransaction,
  parseJsonArray,
  parseJsonObject
};
