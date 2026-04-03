const { query, queryOne, run } = require('./sql');
const { mapAlert } = require('./serializers');

const createAlert = async ({
  sourceType,
  sourceId = null,
  alertLevel = 'warning',
  message,
  status = 'open'
}) => {
  const result = await run(
    `
      INSERT INTO alerts (
        source_type,
        source_id,
        alert_level,
        message,
        status
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [sourceType, sourceId, alertLevel, message, status]
  );

  return queryOne('SELECT * FROM alerts WHERE id = ? LIMIT 1', [result.insertId]);
};

const listAlerts = async ({ status, sourceType, limit = 50, offset = 0 } = {}) => {
  const filters = [];
  const params = [];

  if (status) {
    filters.push('status = ?');
    params.push(status);
  }

  if (sourceType) {
    filters.push('source_type = ?');
    params.push(sourceType);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await query(
    `SELECT * FROM alerts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return rows.map(mapAlert);
};

const resolveAlert = async (id, resolvedBy) => {
  await run(
    `
      UPDATE alerts
      SET status = 'resolved', resolved_at = NOW(), resolved_by = ?
      WHERE id = ?
    `,
    [resolvedBy, id]
  );

  return queryOne('SELECT * FROM alerts WHERE id = ? LIMIT 1', [id]);
};

module.exports = {
  createAlert,
  listAlerts,
  resolveAlert
};
