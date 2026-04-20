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
        entity_type,
        entity_id,
        alert_type,
        severity,
        message
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [sourceType, sourceId || 0, status, alertLevel, message]
  );

  return queryOne(
    `
      SELECT
        id,
        entity_type AS source_type,
        entity_id AS source_id,
        severity AS alert_level,
        message,
        CASE WHEN resolved_at IS NULL THEN 'open' ELSE 'resolved' END AS status,
        resolved_at,
        resolved_by,
        created_at
      FROM alerts
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );
};

const listAlerts = async ({ status, sourceType, limit = 50, offset = 0 } = {}) => {
  const filters = [];
  const params = [];

  if (status) {
    filters.push(status === 'resolved' ? 'resolved_at IS NOT NULL' : 'resolved_at IS NULL');
  }

  if (sourceType) {
    filters.push('entity_type = ?');
    params.push(sourceType);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const safeLimit = Number(limit);
  const safeOffset = Number(offset);
  const rows = await query(
    `
      SELECT
        id,
        entity_type AS source_type,
        entity_id AS source_id,
        severity AS alert_level,
        message,
        CASE WHEN resolved_at IS NULL THEN 'open' ELSE 'resolved' END AS status,
        resolved_at,
        resolved_by,
        created_at
      FROM alerts
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `,
    params
  );

  return rows.map(mapAlert);
};

const resolveAlert = async (id, resolvedBy) => {
  await run(
    `
      UPDATE alerts
      SET resolved_at = NOW(), resolved_by = ?
      WHERE id = ?
    `,
    [resolvedBy, id]
  );

  return queryOne(
    `
      SELECT
        id,
        entity_type AS source_type,
        entity_id AS source_id,
        severity AS alert_level,
        message,
        CASE WHEN resolved_at IS NULL THEN 'open' ELSE 'resolved' END AS status,
        resolved_at,
        resolved_by,
        created_at
      FROM alerts
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
};

module.exports = {
  createAlert,
  listAlerts,
  resolveAlert
};
