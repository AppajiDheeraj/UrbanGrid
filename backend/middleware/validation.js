const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});

const validateInput = (req, res, next) => {
  const trimStrings = (value) => {
    if (Array.isArray(value)) {
      return value.map(trimStrings);
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [key, trimStrings(nestedValue)])
      );
    }

    return typeof value === 'string' ? value.trim() : value;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = trimStrings(req.body);
  }

  next();
};

const sanitizeInput = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeInput);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, sanitizeInput(nestedValue)])
    );
  }

  if (typeof value !== 'string') {
    return value;
  }

  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
};

const sanitizeRequest = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeInput(req.body);
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeInput(req.params);
  }

  next();
};

const validatePinCode = (req, res, next) => {
  const { pinCode } = req.body || {};
  if (pinCode && (!/^\d{6}$/.test(pinCode))) {
    return res.status(400).json({ message: 'Invalid pin code format' });
  }
  next();
};

const validateCoordinates = (req, res, next) => {
  const { latitude, longitude } = req.body || {};
  if (latitude && (isNaN(latitude) || latitude < -90 || latitude > 90)) {
    return res.status(400).json({ message: 'Invalid latitude' });
  }
  if (longitude && (isNaN(longitude) || longitude < -180 || longitude > 180)) {
    return res.status(400).json({ message: 'Invalid longitude' });
  }
  next();
};

const validateBudget = (req, res, next) => {
  const { estimatedBudget, amount } = req.body;
  const budget = estimatedBudget || amount;
  if (budget && (isNaN(budget) || budget <= 0 || budget > 100000000)) {
    return res.status(400).json({ message: 'Invalid budget amount' });
  }
  next();
};

module.exports = {
  apiLimiter,
  authLimiter,
  validateInput,
  sanitizeRequest,
  validatePinCode,
  validateCoordinates,
  validateBudget,
  security: [
    helmet(),
    hpp(),
  ]
};
