const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDirectory = path.join(__dirname, '..', 'logs');

if (!fs.existsSync(logsDirectory)) {
  fs.mkdirSync(logsDirectory, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'urbangrid-api' },
  transports: [
    new winston.transports.File({ filename: path.join(logsDirectory, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDirectory, 'combined.log') }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'urbangrid-audit' },
  transports: [
    new winston.transports.File({ filename: path.join(logsDirectory, 'audit.log') })
  ],
});

if (process.env.NODE_ENV !== 'production') {
  auditLogger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const logAudit = (action, userId, details = {}) => {
  auditLogger.info({
    action,
    userId,
    timestamp: new Date().toISOString(),
    ip: details.ip,
    userAgent: details.userAgent,
    ...details
  });
};

module.exports = { logger, auditLogger, logAudit };
