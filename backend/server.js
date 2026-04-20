const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { ensureColumn, run } = require('./utils/sql');
const { seedGovernmentAccounts } = require('./utils/seedGovernmentAccounts');
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
  await ensureColumn('users', 'address', 'address VARCHAR(255) NULL', 'AFTER phone');
  await ensureColumn('users', 'pincode', 'pincode VARCHAR(10) NULL', 'AFTER address');
  await ensureColumn('tenders', 'complaint_id', 'complaint_id BIGINT UNSIGNED NULL', 'AFTER tender_type');
  await ensureColumn('tenders', 'winning_bid_id', 'winning_bid_id BIGINT UNSIGNED NULL', 'AFTER status');
  await ensureColumn('tenders', 'published_at', 'published_at DATETIME NULL', 'AFTER submitted_at');
  await ensureColumn('tenders', 'start_date', 'start_date DATE NULL', 'AFTER estimated_budget');
  await ensureColumn('tenders', 'expected_end_date', 'expected_end_date DATE NULL', 'AFTER start_date');
  await ensureColumn('projects', 'complaint_id', 'complaint_id BIGINT UNSIGNED NULL', 'AFTER bid_id');
  await ensureColumn('bids', 'proposal', 'proposal TEXT NULL', 'AFTER duration_days');
  await ensureColumn('complaints', 'ministry_id', 'ministry_id BIGINT UNSIGNED NULL', 'AFTER location_id');
  await ensureColumn('complaints', 'department_id', 'department_id BIGINT UNSIGNED NULL', 'AFTER ministry_id');
  await ensureColumn('complaints', 'reviewed_by', 'reviewed_by BIGINT UNSIGNED NULL', 'AFTER verified_by');
  await ensureColumn('complaints', 'reviewed_at', 'reviewed_at DATETIME NULL', 'AFTER verified_at');
  await ensureColumn('complaints', 'review_notes', 'review_notes TEXT NULL', 'AFTER reviewed_at');
  await ensureColumn('complaints', 'rejection_reason', 'rejection_reason TEXT NULL', 'AFTER review_notes');
  await ensureColumn('complaints', 'project_id', 'project_id BIGINT UNSIGNED NULL', 'AFTER department_id');
  await ensureColumn('projects', 'progress_last_updated_by', 'progress_last_updated_by BIGINT UNSIGNED NULL', 'AFTER progress_last_updated');
  await run(`
    ALTER TABLE complaints
    MODIFY COLUMN status ENUM(
      'submitted',
      'verified',
      'tender_created',
      'rejected',
      'in_progress',
      'pending_admin_verification',
      'resolved',
      'closed'
    ) NOT NULL DEFAULT 'submitted'
  `);
  await run(`
    ALTER TABLE projects
    MODIFY COLUMN status ENUM(
      'assigned',
      'in_progress',
      'on_hold',
      'pending_admin_verification',
      'completed',
      'cancelled'
    ) NOT NULL DEFAULT 'assigned'
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS city_reports (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      generated_by BIGINT UNSIGNED NULL,
      report_type VARCHAR(100) NOT NULL,
      generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      report_data JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_city_reports_generated_by (generated_by),
      KEY idx_city_reports_generated_at (generated_at),
      CONSTRAINT fk_city_reports_generated_by
        FOREIGN KEY (generated_by) REFERENCES users (id)
        ON DELETE SET NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS user_login_attempts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NULL,
      email VARCHAR(190) NOT NULL,
      ip_address VARCHAR(45) NULL,
      user_agent TEXT NULL,
      was_successful TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_user_login_attempts_user_id (user_id),
      KEY idx_user_login_attempts_email (email),
      KEY idx_user_login_attempts_created_at (created_at),
      CONSTRAINT fk_user_login_attempts_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE SET NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      theme ENUM('light', 'dark', 'system') NOT NULL DEFAULT 'system',
      language VARCHAR(10) NOT NULL DEFAULT 'en',
      email_notifications TINYINT(1) NOT NULL DEFAULT 1,
      sms_notifications TINYINT(1) NOT NULL DEFAULT 0,
      push_notifications TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_settings_user_id (user_id),
      CONSTRAINT fk_user_settings_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
    )
  `);
  await seedGovernmentAccounts();

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
app.use('/api/complaints', require('./routes/complaints'));
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
