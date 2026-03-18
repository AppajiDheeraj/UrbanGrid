const { logAudit } = require('../utils/logger');

const auditMiddleware = (action) => {
  return (req, res, next) => {
    // Log after response is sent
    res.on('finish', () => {
      logAudit(action, req.user?.id, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
      });
    });
    next();
  };
};

module.exports = auditMiddleware;
