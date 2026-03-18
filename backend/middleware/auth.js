const jwt = require('jsonwebtoken');
const { getAuthUserById } = require('../utils/userQueries');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      
      // Ensure JWT_SECRET is set
      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET environment variable is not set');
        return res.status(500).json({ message: 'Server configuration error' });
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if token is expired
      if (decoded.exp < Date.now() / 1000) {
        return res.status(401).json({ message: 'Token expired' });
      }
      
      req.user = await getAuthUserById(decoded.id);
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      if (!req.user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }
      
      next();
    } catch (error) {
      console.error('Auth error:', error.message);
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      }
      res.status(401).json({ message: 'Authentication failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Role ${req.user.role} is not authorized to access this resource` 
      });
    }
    next();
  };
};

const preventSelfApproval = (req, res, next) => {
  if (req.user.role === 'contractor' && req.body.contractorId === req.user.contractorProfile?.toString()) {
    return res.status(403).json({ message: 'Cannot approve your own bid' });
  }
  
  if (req.user.role === 'ministry_officer' && String(req.body.createdBy) === String(req.user.id)) {
    return res.status(403).json({ message: 'Cannot approve your own tender' });
  }
  
  next();
};

module.exports = { protect, authorize, preventSelfApproval };
