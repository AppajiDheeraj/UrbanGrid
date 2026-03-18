CREATE DATABASE IF NOT EXISTS urbangrid;
USE urbangrid;

CREATE TABLE IF NOT EXISTS ministries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(80) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ministries_code (code)
);

CREATE TABLE IF NOT EXISTS departments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ministry_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(80) NOT NULL,
  responsibilities JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_departments_ministry_id (ministry_id),
  CONSTRAINT fk_departments_ministry
    FOREIGN KEY (ministry_id) REFERENCES ministries (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM(
    'citizen',
    'admin',
    'ministry_officer',
    'department_head',
    'senior_official',
    'contractor',
    'regional_manager'
  ) NOT NULL DEFAULT 'citizen',
  ministry_id BIGINT UNSIGNED NULL,
  department_id BIGINT UNSIGNED NULL,
  region_id BIGINT UNSIGNED NULL,
  phone VARCHAR(40) NULL,
  address VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_email_verified TINYINT(1) NOT NULL DEFAULT 0,
  email_verification_token VARCHAR(255) NULL,
  email_verification_expires DATETIME NULL,
  password_reset_token VARCHAR(255) NULL,
  password_reset_expires DATETIME NULL,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  lock_until DATETIME NULL,
  last_login DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_ministry_id (ministry_id),
  KEY idx_users_department_id (department_id),
  CONSTRAINT fk_users_ministry
    FOREIGN KEY (ministry_id) REFERENCES ministries (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_users_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS regions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  pin_codes JSON NOT NULL,
  manager_id BIGINT UNSIGNED NULL,
  department_id BIGINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_regions_manager_id (manager_id),
  KEY idx_regions_department_id (department_id),
  CONSTRAINT fk_regions_manager
    FOREIGN KEY (manager_id) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_regions_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS contractors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  company_name VARCHAR(190) NOT NULL,
  registration_number VARCHAR(120) NOT NULL,
  gst_number VARCHAR(120) NULL,
  address VARCHAR(255) NULL,
  phone VARCHAR(40) NULL,
  specializations JSON NULL,
  past_projects INT NOT NULL DEFAULT 0,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  documents JSON NULL,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_contractors_user_id (user_id),
  UNIQUE KEY uq_contractors_registration_number (registration_number),
  CONSTRAINT fk_contractors_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_login_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  email VARCHAR(190) NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  was_successful TINYINT(1) NOT NULL DEFAULT 0,
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_login_attempts_user_id (user_id),
  CONSTRAINT fk_user_login_attempts_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL
);

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
);

CREATE TABLE IF NOT EXISTS complaints (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  complaint_id VARCHAR(40) NOT NULL,
  citizen_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category ENUM(
    'road_damage',
    'water_leakage',
    'streetlight_failure',
    'garbage',
    'drainage',
    'others'
  ) NOT NULL,
  images JSON NULL,
  address VARCHAR(255) NOT NULL,
  pin_code VARCHAR(10) NOT NULL,
  region_id BIGINT UNSIGNED NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  status ENUM(
    'submitted',
    'under_review',
    'verified',
    'rejected',
    'tender_created',
    'in_progress',
    'completed',
    'closed'
  ) NOT NULL DEFAULT 'submitted',
  ministry_id BIGINT UNSIGNED NULL,
  department_id BIGINT UNSIGNED NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  review_notes TEXT NULL,
  rejection_reason TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_complaints_complaint_id (complaint_id),
  KEY idx_complaints_citizen_id (citizen_id),
  KEY idx_complaints_status (status),
  KEY idx_complaints_ministry_id (ministry_id),
  KEY idx_complaints_department_id (department_id),
  KEY idx_complaints_region_id (region_id),
  CONSTRAINT fk_complaints_citizen
    FOREIGN KEY (citizen_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_complaints_region
    FOREIGN KEY (region_id) REFERENCES regions (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_complaints_ministry
    FOREIGN KEY (ministry_id) REFERENCES ministries (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_complaints_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_complaints_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tender_id VARCHAR(40) NOT NULL,
  complaint_id BIGINT UNSIGNED NOT NULL,
  ministry_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  location_address VARCHAR(255) NULL,
  location_pin_code VARCHAR(10) NULL,
  location_region_id BIGINT UNSIGNED NULL,
  estimated_budget DECIMAL(12,2) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  status ENUM(
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'published',
    'bidding_closed',
    'assigned',
    'in_progress',
    'completed',
    'cancelled'
  ) NOT NULL DEFAULT 'draft',
  winning_bid_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME NULL,
  bidding_deadline DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenders_tender_id (tender_id),
  UNIQUE KEY uq_tenders_complaint_id (complaint_id),
  KEY idx_tenders_ministry_id (ministry_id),
  KEY idx_tenders_department_id (department_id),
  CONSTRAINT fk_tenders_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tenders_ministry
    FOREIGN KEY (ministry_id) REFERENCES ministries (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_tenders_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_tenders_location_region
    FOREIGN KEY (location_region_id) REFERENCES regions (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_tenders_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS tender_approvals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tender_id BIGINT UNSIGNED NOT NULL,
  level INT NOT NULL,
  approver_id BIGINT UNSIGNED NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  comments TEXT NULL,
  action_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tender_approvals_tender_id (tender_id),
  KEY idx_tender_approvals_approver_id (approver_id),
  CONSTRAINT fk_tender_approvals_tender
    FOREIGN KEY (tender_id) REFERENCES tenders (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tender_approvals_approver
    FOREIGN KEY (approver_id) REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bids (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tender_id BIGINT UNSIGNED NOT NULL,
  contractor_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  proposed_start_date DATE NULL,
  proposed_end_date DATE NULL,
  duration_days INT NULL,
  proposal TEXT NULL,
  documents JSON NULL,
  status ENUM('submitted', 'under_review', 'shortlisted', 'accepted', 'rejected') NOT NULL DEFAULT 'submitted',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  review_notes TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bids_tender_contractor (tender_id, contractor_id),
  KEY idx_bids_contractor_id (contractor_id),
  CONSTRAINT fk_bids_tender
    FOREIGN KEY (tender_id) REFERENCES tenders (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_bids_contractor
    FOREIGN KEY (contractor_id) REFERENCES contractors (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_bids_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id VARCHAR(40) NOT NULL,
  tender_id BIGINT UNSIGNED NOT NULL,
  complaint_id BIGINT UNSIGNED NOT NULL,
  contractor_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  status ENUM('not_started', 'in_progress', 'on_hold', 'completed', 'verified', 'closed') NOT NULL DEFAULT 'not_started',
  start_date DATE NULL,
  proposed_end_date DATE NULL,
  actual_end_date DATE NULL,
  allocated_budget DECIMAL(12,2) NULL,
  actual_budget DECIMAL(12,2) NULL,
  assigned_by BIGINT UNSIGNED NULL,
  assigned_at DATETIME NULL,
  regional_manager_id BIGINT UNSIGNED NULL,
  milestones JSON NULL,
  progress_percentage INT NOT NULL DEFAULT 0,
  progress_last_updated DATETIME NULL,
  progress_last_updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_projects_project_id (project_id),
  UNIQUE KEY uq_projects_tender_id (tender_id),
  KEY idx_projects_contractors_id (contractor_id),
  KEY idx_projects_regional_manager_id (regional_manager_id),
  CONSTRAINT fk_projects_tender
    FOREIGN KEY (tender_id) REFERENCES tenders (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_projects_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_projects_contractor
    FOREIGN KEY (contractor_id) REFERENCES contractors (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_projects_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_projects_regional_manager
    FOREIGN KEY (regional_manager_id) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_projects_progress_last_updated_by
    FOREIGN KEY (progress_last_updated_by) REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS progress_updates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  update_type ENUM('milestone', 'daily', 'weekly', 'issue', 'completion') NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  percentage_complete INT NULL,
  images JSON NULL,
  submitted_by BIGINT UNSIGNED NOT NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by BIGINT UNSIGNED NULL,
  review_notes TEXT NULL,
  is_approved TINYINT(1) NULL,
  PRIMARY KEY (id),
  KEY idx_progress_updates_project_id (project_id),
  KEY idx_progress_updates_submitted_by (submitted_by),
  CONSTRAINT fk_progress_updates_project
    FOREIGN KEY (project_id) REFERENCES projects (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_progress_updates_submitted_by
    FOREIGN KEY (submitted_by) REFERENCES users (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_progress_updates_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS verifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NOT NULL,
  complaint_id BIGINT UNSIGNED NOT NULL,
  verification_type ENUM('mid_term', 'final', 'quality_check') NOT NULL,
  status ENUM('pending', 'in_progress', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
  verified_by BIGINT UNSIGNED NULL,
  verified_at DATETIME NULL,
  findings TEXT NULL,
  issues JSON NULL,
  images JSON NULL,
  rating INT NULL,
  recommendation ENUM('approve', 'reject', 'needs_rework') NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_verifications_project_id (project_id),
  CONSTRAINT fk_verifications_project
    FOREIGN KEY (project_id) REFERENCES projects (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_verifications_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_verifications_verified_by
    FOREIGN KEY (verified_by) REFERENCES users (id)
    ON DELETE SET NULL
);
