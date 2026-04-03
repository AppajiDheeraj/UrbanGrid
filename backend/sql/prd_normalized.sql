USE urbangrid;

-- ============================================================================
-- URBANGRID - ZERO REDUNDANCY NORMALIZED SCHEMA
-- ============================================================================
-- Eliminates ALL redundancy:
-- ✅ Single users table (NO citizens, government_users, contractors duplicates)
-- ✅ Single verifications table (NO complaint_verification, completion_verification duplication)
-- ✅ NO mirror tables (regional_managers, ministry_departments, project_progress, user_login_attempts)
-- ✅ Clean M:M relationships
-- ============================================================================

-- ============================================================================
-- CORE REFERENCE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS regions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  pm_codes JSON NULL,
  address VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_regions_name (name)
);

CREATE TABLE IF NOT EXISTS ministries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  code VARCHAR(40) NULL UNIQUE,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_ministries_name (name),
  KEY idx_ministries_code (code)
);

CREATE TABLE IF NOT EXISTS departments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ministry_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(40) NULL,
  description TEXT NULL,
  responsibilities JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  KEY idx_departments_ministry_id (ministry_id),
  KEY idx_departments_name (name),
  CONSTRAINT fk_departments_ministry FOREIGN KEY (ministry_id) REFERENCES ministries (id) ON DELETE CASCADE
);

-- ============================================================================
-- UNIFIED USERS TABLE - SINGLE SOURCE OF TRUTH
-- ============================================================================
-- Replaces: users, citizens, government_users, contractors
-- Single table with role-based fields
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  
  -- Identity fields (ALL roles)
  name VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(40) NULL,
  address TEXT NULL,
  pincode VARCHAR(10) NULL,
  ward_no VARCHAR(20) NULL,
  
  -- Authentication (ALL roles except citizens)
  password_hash VARCHAR(255) NULL,
  
  -- Role & permissions (SINGLE role per user)
  role ENUM('citizen', 'contractor', 'admin', 'ministry_officer', 'department_head', 'senior_official', 'regional_manager') NOT NULL,
  
  -- Government-specific fields (for roles: ministry_officer, department_head, senior_official, admin, regional_manager)
  ministry_id BIGINT UNSIGNED NULL,
  region_id BIGINT UNSIGNED NULL,
  
  -- Contractor-specific fields (for role: contractor)
  company_name VARCHAR(190) NULL,
  registration_number VARCHAR(40) NULL,
  contractor_rating DECIMAL(3, 2) NULL DEFAULT 0.00,
  total_projects INT DEFAULT 0,
  completed_projects INT DEFAULT 0,
  
  -- Account status & timestamps
  last_login DATETIME NULL,
  failed_login_attempts INT DEFAULT 0,
  account_locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_ministry_id (ministry_id),
  KEY idx_users_region_id (region_id),
  KEY idx_users_created_at (created_at),
  
  CONSTRAINT fk_users_ministry FOREIGN KEY (ministry_id) REFERENCES ministries (id) ON DELETE SET NULL,
  CONSTRAINT fk_users_region FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE SET NULL
);

-- ============================================================================
-- PROJECT & TENDER MANAGEMENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tender_type VARCHAR(40) NOT NULL,
  ministry_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NULL,
  location_address TEXT NULL,
  estimated_budget DECIMAL(12, 2) NOT NULL,
  
  documents JSON NULL,
  status ENUM('draft', 'pending_approval', 'approved', 'published', 'bidding_closed', 'cancelled') NOT NULL DEFAULT 'draft',
  
  tender_end_date DATE NULL,
  submitted_at DATETIME NULL,
  reviewed_at DATETIME NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  KEY idx_tenders_ministry_id (ministry_id),
  KEY idx_tenders_department_id (department_id),
  KEY idx_tenders_status (status),
  KEY idx_tenders_created_by (created_by),
  
  CONSTRAINT fk_tenders_ministry FOREIGN KEY (ministry_id) REFERENCES ministries (id) ON DELETE CASCADE,
  CONSTRAINT fk_tenders_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL,
  CONSTRAINT fk_tenders_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_tenders_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bids (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tender_id BIGINT UNSIGNED NOT NULL,
  contractor_id BIGINT UNSIGNED NOT NULL,
  
  amount DECIMAL(12, 2) NOT NULL,
  proposed_start_date DATE NULL,
  proposed_end_date DATE NULL,
  duration_days INT NOT NULL,
  
  documents JSON NULL,
  status ENUM('submitted', 'under_review', 'approved', 'rejected', 'selected', 'cancelled') NOT NULL DEFAULT 'submitted',
  
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  
  KEY idx_bids_tender_id (tender_id),
  KEY idx_bids_contractor_id (contractor_id),
  KEY idx_bids_status (status),
  
  CONSTRAINT fk_bids_tender FOREIGN KEY (tender_id) REFERENCES tenders (id) ON DELETE CASCADE,
  CONSTRAINT fk_bids_contractor FOREIGN KEY (contractor_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_bids_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tender_id BIGINT UNSIGNED NULL,
  bid_id BIGINT UNSIGNED NULL,
  
  ministry_id BIGINT UNSIGNED NOT NULL,
  region_id BIGINT UNSIGNED NOT NULL,
  contractor_id BIGINT UNSIGNED NOT NULL,
  
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NULL,
  location_address TEXT NULL,
  
  estimated_budget DECIMAL(12, 2) NULL,
  actual_budget DECIMAL(12, 2) NULL,
  progress_percentage INT DEFAULT 0,
  
  start_date DATE NULL,
  expected_end_date DATE NULL,
  actual_end_date DATE NULL,
  
  status ENUM('assigned', 'in_progress', 'on_hold', 'completed', 'cancelled') NOT NULL DEFAULT 'assigned',
  
  milestones JSON NULL,
  
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  KEY idx_projects_ministry_id (ministry_id),
  KEY idx_projects_region_id (region_id),
  KEY idx_projects_contractor_id (contractor_id),
  KEY idx_projects_status (status),
  KEY idx_projects_tender_id (tender_id),
  
  CONSTRAINT fk_projects_ministry FOREIGN KEY (ministry_id) REFERENCES ministries (id) ON DELETE CASCADE,
  CONSTRAINT fk_projects_region FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE CASCADE,
  CONSTRAINT fk_projects_contractor FOREIGN KEY (contractor_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_projects_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS progress_updates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id BIGINT UNSIGNED NOT NULL,
  
  percentage_complete INT NULL,
  description TEXT NOT NULL,
  images JSON NULL,
  
  submitted_by BIGINT UNSIGNED NOT NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_progress_updates_project_id (project_id),
  KEY idx_progress_updates_submitted_by (submitted_by),
  
  CONSTRAINT fk_progress_updates_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_updates_submitted_by FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE CASCADE
);

-- ============================================================================
-- CITIZEN COMPLAINTS & COMMUNITY ENGAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS complaints (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  citizen_id BIGINT UNSIGNED NOT NULL,
  
  issue_title VARCHAR(255) NOT NULL,
  issue_description TEXT NOT NULL,
  category VARCHAR(100) NULL,
  location_address TEXT NULL,
  ward_no VARCHAR(20) NULL,
  
  images JSON NULL,
  
  status ENUM('submitted', 'verified', 'rejected', 'in_progress', 'resolved') NOT NULL DEFAULT 'submitted',
  
  verified_by BIGINT UNSIGNED NULL,
  verified_at DATETIME NULL,
  
  routed_to_ministry_id BIGINT UNSIGNED NULL,
  routed_at DATETIME NULL,
  
  official_viewed_at DATETIME NULL,
  contractor_notified_at DATETIME NULL,
  work_completed_at DATETIME NULL,
  
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  KEY idx_complaints_citizen_id (citizen_id),
  KEY idx_complaints_status (status),
  KEY idx_complaints_ward_no (ward_no),
  KEY idx_complaints_verified_by (verified_by),
  KEY idx_complaints_routed_to_ministry (routed_to_ministry_id),
  
  CONSTRAINT fk_complaints_citizen FOREIGN KEY (citizen_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_complaints_verified_by FOREIGN KEY (verified_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_complaints_routed_ministry FOREIGN KEY (routed_to_ministry_id) REFERENCES ministries (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS complaint_votes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  complaint_id BIGINT UNSIGNED NOT NULL,
  voter_user_id BIGINT UNSIGNED NOT NULL,
  
  vote_value TINYINT UNSIGNED NOT NULL,
  ward_no VARCHAR(20) NOT NULL,
  
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uq_complaint_votes_complaint_voter (complaint_id, voter_user_id),
  KEY idx_complaint_votes_complaint_id (complaint_id),
  KEY idx_complaint_votes_voter_user_id (voter_user_id),
  
  CONSTRAINT fk_complaint_votes_complaint FOREIGN KEY (complaint_id) REFERENCES complaints (id) ON DELETE CASCADE,
  CONSTRAINT fk_complaint_votes_voter FOREIGN KEY (voter_user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ============================================================================
-- SINGLE UNIFIED VERIFICATION TABLE (NO DUPLICATION)
-- ============================================================================
-- Replaces: verifications, complaint_verification, completion_verification
-- Uses polymorphic pattern: entity_type + entity_id
CREATE TABLE IF NOT EXISTS verifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  
  -- Polymorphic relationship
  entity_type ENUM('complaint', 'project', 'progress_update', 'bid') NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  
  -- Verification type & status
  verification_type ENUM('initial', 'intermediate', 'final') NOT NULL,
  status ENUM('approved', 'rejected') NOT NULL,
  
  -- Verification details
  verified_by BIGINT UNSIGNED NOT NULL,
  verified_at DATETIME NOT NULL,
  
  findings TEXT NULL,
  remarks TEXT NULL,
  
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uq_verifications_entity_type (entity_type, entity_id, verification_type),
  KEY idx_verifications_verified_by (verified_by),
  KEY idx_verifications_entity (entity_type, entity_id),
  KEY idx_verifications_status (status),
  
  CONSTRAINT fk_verifications_verified_by FOREIGN KEY (verified_by) REFERENCES users (id) ON DELETE RESTRICT
);

-- ============================================================================
-- APPROVAL WORKFLOW (MULTI-LEVEL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tender_approvals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tender_id BIGINT UNSIGNED NOT NULL,
  
  approval_level INT NOT NULL,
  approval_role VARCHAR(50) NOT NULL,
  
  approver_id BIGINT UNSIGNED NULL,
  approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  
  approved_at DATETIME NULL,
  remarks TEXT NULL,
  
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_tender_approvals_tender_id (tender_id),
  KEY idx_tender_approvals_approver_id (approver_id),
  
  CONSTRAINT fk_tender_approvals_tender FOREIGN KEY (tender_id) REFERENCES tenders (id) ON DELETE CASCADE,
  CONSTRAINT fk_tender_approvals_approver FOREIGN KEY (approver_id) REFERENCES users (id) ON DELETE SET NULL
);

-- ============================================================================
-- AUDIT & ALERTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  
  action VARCHAR(100) NOT NULL,
  changes JSON NULL,
  
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_audit_logs_user_id (user_id),
  KEY idx_audit_logs_entity (entity_type, entity_id),
  KEY idx_audit_logs_created_at (created_at),
  
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  
  alert_type VARCHAR(100) NOT NULL,
  severity ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  
  resolved_at DATETIME NULL,
  resolved_by BIGINT UNSIGNED NULL,
  
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_alerts_entity (entity_type, entity_id),
  KEY idx_alerts_severity (severity),
  
  CONSTRAINT fk_alerts_resolved_by FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL
);

-- ============================================================================
-- TRIGGERS - AUTO UPDATE DERIVED DATA
-- ============================================================================

DELIMITER $$

-- Auto-update project progress percentage when progress_update is added/updated
DROP TRIGGER IF EXISTS progress_updates_ai$$
CREATE TRIGGER progress_updates_ai AFTER INSERT ON progress_updates
FOR EACH ROW
BEGIN
  UPDATE projects 
  SET progress_percentage = COALESCE(NEW.percentage_complete, progress_percentage),
      updated_at = NOW()
  WHERE id = NEW.project_id;
END$$

DROP TRIGGER IF EXISTS progress_updates_au$$
CREATE TRIGGER progress_updates_au AFTER UPDATE ON progress_updates
FOR EACH ROW
BEGIN
  UPDATE projects 
  SET progress_percentage = COALESCE(NEW.percentage_complete, progress_percentage),
      updated_at = NOW()
  WHERE id = NEW.project_id;
END$$

DELIMITER ;

-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================
/*
REMOVED REDUNDANT TABLES (OLD SCHEMA):
❌ citizens - merged into users (role='citizen')
❌ government_users - merged into users (role IN admin, ministry_officer, etc)
❌ contractors - merged into users (role='contractor')
❌ user_settings - add fields to users if needed
❌ regional_managers - manage via users.region_id for regional_manager role
❌ ministry_departments - removed, department has ministry_id directly
❌ complaint_verification - merged into unified verifications table
❌ completion_verification - merged into unified verifications table
❌ project_progress - removed, synced to projects.progress_percentage via trigger
❌ user_login_attempts - can use audit_logs for tracking

NEW UNIFIED TABLES:
✅ users (single source: citizens + government_users + contractors)
✅ verifications (single source: complaint_verification + completion_verification + verifications)
✅ All other tables cleaned of duplicates

BENEFITS:
✓ 40% fewer tables
✓ Zero user data duplication
✓ Zero verification duplication
✓ Simpler queries (no complex JOINs to get user info)
✓ Easier to maintain
✓ Better performance for lookups
*/
