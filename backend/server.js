const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { security, apiLimiter, authLimiter, validateInput, sanitizeRequest } = require('./middleware/validation');

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'];
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} environment variable is required`);
    process.exit(1);
  }
});

const app = express();

const startServer = async () => {
  await connectDB();

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Security middleware
app.use(security);

// Rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input validation
app.use(validateInput);
app.use(sanitizeRequest);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'UrbanGrid API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/citizen', require('./routes/citizen'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/ministry', require('./routes/ministry'));
app.use('/api/approvals', require('./routes/approval'));
app.use('/api/contractor', require('./routes/contractor'));
app.use('/api/projects', require('./routes/project'));
app.use('/api/region', require('./routes/region'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File size too large' });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ message: 'Too many files uploaded' });
  }
  
  // Validation errors
  if (err.message.includes('Invalid') || err.message.includes('required')) {
    return res.status(400).json({ message: err.message });
  }
  
  // Default error
  res.status(err.status || 500).json({ 
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
