USE urbangrid;

ALTER TABLE users
  ADD COLUMN pincode VARCHAR(10) NULL AFTER address;

CREATE TABLE IF NOT EXISTS citizens (
  id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(40) NULL,
  address TEXT NULL,
  pincode VARCHAR(10) NULL,
  registered_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_citizens_email (email),
  CONSTRAINT fk_citizens_user
    FOREIGN KEY (id) REFERENCES users (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS government_users (
  id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'ministry_officer', 'approver', 'regional_manager') NOT NULL,
  ministry_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_government_users_email (email),
  CONSTRAINT fk_government_users_user
    FOREIGN KEY (id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_government_users_ministry
    FOREIGN KEY (ministry_id) REFERENCES ministries (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ministry_departments (
  id BIGINT UNSIGNED NOT NULL,
  ministry_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_ministry_departments_ministry_id (ministry_id),
  CONSTRAINT fk_ministry_departments_department
    FOREIGN KEY (id) REFERENCES departments (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ministry_departments_ministry
    FOREIGN KEY (ministry_id) REFERENCES ministries (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS regional_managers (
  id BIGINT UNSIGNED NOT NULL,
  government_user_id BIGINT UNSIGNED NOT NULL,
  region_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_regional_managers_government_user_id (government_user_id),
  UNIQUE KEY uq_regional_managers_region_id (region_id),
  CONSTRAINT fk_regional_managers_user
    FOREIGN KEY (government_user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_regional_managers_region
    FOREIGN KEY (region_id) REFERENCES regions (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS complaint_verification (
  id BIGINT UNSIGNED NOT NULL,
  complaint_id BIGINT UNSIGNED NOT NULL,
  verified_by BIGINT UNSIGNED NULL,
  verification_status ENUM('approved', 'rejected') NOT NULL,
  remarks TEXT NULL,
  verified_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_complaint_verification_complaint_id (complaint_id),
  CONSTRAINT fk_complaint_verification_complaint
    FOREIGN KEY (complaint_id) REFERENCES complaints (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_complaint_verification_user
    FOREIGN KEY (verified_by) REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS project_progress (
  id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  progress_percentage INT NULL,
  update_description TEXT NOT NULL,
  image_url VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_project_progress_project_id (project_id),
  CONSTRAINT fk_project_progress_project
    FOREIGN KEY (project_id) REFERENCES projects (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS completion_verification (
  id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  verified_by BIGINT UNSIGNED NULL,
  verification_status ENUM('approved', 'rejected') NOT NULL,
  remarks TEXT NULL,
  verified_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_completion_verification_project_id (project_id),
  CONSTRAINT fk_completion_verification_project
    FOREIGN KEY (project_id) REFERENCES projects (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_completion_verification_user
    FOREIGN KEY (verified_by) REFERENCES users (id)
    ON DELETE SET NULL
);

DELIMITER $$

DROP TRIGGER IF EXISTS users_ai$$
CREATE TRIGGER users_ai AFTER INSERT ON users
FOR EACH ROW
BEGIN
  IF NEW.role = 'citizen' THEN
    INSERT INTO citizens (id, name, email, phone, address, pincode, registered_at)
    VALUES (NEW.id, NEW.name, NEW.email, NEW.phone, NEW.address, NEW.pincode, NEW.created_at)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      email = VALUES(email),
      phone = VALUES(phone),
      address = VALUES(address),
      pincode = VALUES(pincode),
      registered_at = VALUES(registered_at);
  ELSE
    DELETE FROM citizens WHERE id = NEW.id;
  END IF;

  IF NEW.role IN ('admin', 'ministry_officer', 'department_head', 'senior_official', 'regional_manager') THEN
    INSERT INTO government_users (id, name, email, password_hash, role, ministry_id, created_at)
    VALUES (
      NEW.id,
      NEW.name,
      NEW.email,
      NEW.password,
      CASE
        WHEN NEW.role = 'admin' THEN 'admin'
        WHEN NEW.role = 'ministry_officer' THEN 'ministry_officer'
        WHEN NEW.role IN ('department_head', 'senior_official') THEN 'approver'
        ELSE 'regional_manager'
      END,
      NEW.ministry_id,
      NEW.created_at
    )
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      email = VALUES(email),
      password_hash = VALUES(password_hash),
      role = VALUES(role),
      ministry_id = VALUES(ministry_id),
      created_at = VALUES(created_at);
  ELSE
    DELETE FROM government_users WHERE id = NEW.id;
  END IF;

  IF NEW.role = 'regional_manager' AND NEW.region_id IS NOT NULL THEN
    INSERT INTO regional_managers (id, government_user_id, region_id)
    VALUES (NEW.id, NEW.id, NEW.region_id)
    ON DUPLICATE KEY UPDATE
      government_user_id = VALUES(government_user_id),
      region_id = VALUES(region_id);
  ELSE
    DELETE FROM regional_managers WHERE id = NEW.id;
  END IF;
END$$

DROP TRIGGER IF EXISTS users_au$$
CREATE TRIGGER users_au AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  DELETE FROM citizens WHERE id = OLD.id;
  DELETE FROM government_users WHERE id = OLD.id;
  DELETE FROM regional_managers WHERE id = OLD.id;

  IF NEW.role = 'citizen' THEN
    INSERT INTO citizens (id, name, email, phone, address, pincode, registered_at)
    VALUES (NEW.id, NEW.name, NEW.email, NEW.phone, NEW.address, NEW.pincode, NEW.created_at)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      email = VALUES(email),
      phone = VALUES(phone),
      address = VALUES(address),
      pincode = VALUES(pincode),
      registered_at = VALUES(registered_at);
  END IF;

  IF NEW.role IN ('admin', 'ministry_officer', 'department_head', 'senior_official', 'regional_manager') THEN
    INSERT INTO government_users (id, name, email, password_hash, role, ministry_id, created_at)
    VALUES (
      NEW.id,
      NEW.name,
      NEW.email,
      NEW.password,
      CASE
        WHEN NEW.role = 'admin' THEN 'admin'
        WHEN NEW.role = 'ministry_officer' THEN 'ministry_officer'
        WHEN NEW.role IN ('department_head', 'senior_official') THEN 'approver'
        ELSE 'regional_manager'
      END,
      NEW.ministry_id,
      NEW.created_at
    )
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      email = VALUES(email),
      password_hash = VALUES(password_hash),
      role = VALUES(role),
      ministry_id = VALUES(ministry_id),
      created_at = VALUES(created_at);
  END IF;

  IF NEW.role = 'regional_manager' AND NEW.region_id IS NOT NULL THEN
    INSERT INTO regional_managers (id, government_user_id, region_id)
    VALUES (NEW.id, NEW.id, NEW.region_id)
    ON DUPLICATE KEY UPDATE
      government_user_id = VALUES(government_user_id),
      region_id = VALUES(region_id);
  END IF;
END$$

DROP TRIGGER IF EXISTS users_ad$$
CREATE TRIGGER users_ad AFTER DELETE ON users
FOR EACH ROW
BEGIN
  DELETE FROM citizens WHERE id = OLD.id;
  DELETE FROM government_users WHERE id = OLD.id;
  DELETE FROM regional_managers WHERE id = OLD.id;
END$$

DROP TRIGGER IF EXISTS departments_ai$$
CREATE TRIGGER departments_ai AFTER INSERT ON departments
FOR EACH ROW
BEGIN
  INSERT INTO ministry_departments (id, ministry_id, name, description)
  VALUES (
    NEW.id,
    NEW.ministry_id,
    NEW.name,
    JSON_UNQUOTE(JSON_EXTRACT(NEW.responsibilities, '$[0]'))
  )
  ON DUPLICATE KEY UPDATE
    ministry_id = VALUES(ministry_id),
    name = VALUES(name),
    description = VALUES(description);
END$$

DROP TRIGGER IF EXISTS departments_au$$
CREATE TRIGGER departments_au AFTER UPDATE ON departments
FOR EACH ROW
BEGIN
  INSERT INTO ministry_departments (id, ministry_id, name, description)
  VALUES (
    NEW.id,
    NEW.ministry_id,
    NEW.name,
    JSON_UNQUOTE(JSON_EXTRACT(NEW.responsibilities, '$[0]'))
  )
  ON DUPLICATE KEY UPDATE
    ministry_id = VALUES(ministry_id),
    name = VALUES(name),
    description = VALUES(description);
END$$

DROP TRIGGER IF EXISTS departments_ad$$
CREATE TRIGGER departments_ad AFTER DELETE ON departments
FOR EACH ROW
BEGIN
  DELETE FROM ministry_departments WHERE id = OLD.id;
END$$

DROP TRIGGER IF EXISTS complaints_ai$$
CREATE TRIGGER complaints_ai AFTER INSERT ON complaints
FOR EACH ROW
BEGIN
  IF NEW.status IN ('verified', 'rejected') THEN
    INSERT INTO complaint_verification (id, complaint_id, verified_by, verification_status, remarks, verified_at)
    VALUES (
      NEW.id,
      NEW.id,
      NEW.reviewed_by,
      IF(NEW.status = 'verified', 'approved', 'rejected'),
      COALESCE(NEW.review_notes, NEW.rejection_reason),
      NEW.reviewed_at
    )
    ON DUPLICATE KEY UPDATE
      verified_by = VALUES(verified_by),
      verification_status = VALUES(verification_status),
      remarks = VALUES(remarks),
      verified_at = VALUES(verified_at);
  END IF;
END$$

DROP TRIGGER IF EXISTS complaints_au$$
CREATE TRIGGER complaints_au AFTER UPDATE ON complaints
FOR EACH ROW
BEGIN
  IF NEW.status IN ('verified', 'rejected') THEN
    INSERT INTO complaint_verification (id, complaint_id, verified_by, verification_status, remarks, verified_at)
    VALUES (
      NEW.id,
      NEW.id,
      NEW.reviewed_by,
      IF(NEW.status = 'verified', 'approved', 'rejected'),
      COALESCE(NEW.review_notes, NEW.rejection_reason),
      NEW.reviewed_at
    )
    ON DUPLICATE KEY UPDATE
      verified_by = VALUES(verified_by),
      verification_status = VALUES(verification_status),
      remarks = VALUES(remarks),
      verified_at = VALUES(verified_at);
  ELSE
    DELETE FROM complaint_verification WHERE complaint_id = NEW.id;
  END IF;
END$$

DROP TRIGGER IF EXISTS complaints_ad$$
CREATE TRIGGER complaints_ad AFTER DELETE ON complaints
FOR EACH ROW
BEGIN
  DELETE FROM complaint_verification WHERE complaint_id = OLD.id;
END$$

DROP TRIGGER IF EXISTS progress_updates_ai$$
CREATE TRIGGER progress_updates_ai AFTER INSERT ON progress_updates
FOR EACH ROW
BEGIN
  INSERT INTO project_progress (id, project_id, progress_percentage, update_description, image_url, updated_at)
  VALUES (
    NEW.id,
    NEW.project_id,
    NEW.percentage_complete,
    NEW.description,
    JSON_UNQUOTE(JSON_EXTRACT(NEW.images, '$[0].url')),
    NEW.submitted_at
  )
  ON DUPLICATE KEY UPDATE
    project_id = VALUES(project_id),
    progress_percentage = VALUES(progress_percentage),
    update_description = VALUES(update_description),
    image_url = VALUES(image_url),
    updated_at = VALUES(updated_at);
END$$

DROP TRIGGER IF EXISTS progress_updates_au$$
CREATE TRIGGER progress_updates_au AFTER UPDATE ON progress_updates
FOR EACH ROW
BEGIN
  INSERT INTO project_progress (id, project_id, progress_percentage, update_description, image_url, updated_at)
  VALUES (
    NEW.id,
    NEW.project_id,
    NEW.percentage_complete,
    NEW.description,
    JSON_UNQUOTE(JSON_EXTRACT(NEW.images, '$[0].url')),
    NEW.submitted_at
  )
  ON DUPLICATE KEY UPDATE
    project_id = VALUES(project_id),
    progress_percentage = VALUES(progress_percentage),
    update_description = VALUES(update_description),
    image_url = VALUES(image_url),
    updated_at = VALUES(updated_at);
END$$

DROP TRIGGER IF EXISTS progress_updates_ad$$
CREATE TRIGGER progress_updates_ad AFTER DELETE ON progress_updates
FOR EACH ROW
BEGIN
  DELETE FROM project_progress WHERE id = OLD.id;
END$$

DROP TRIGGER IF EXISTS verifications_ai$$
CREATE TRIGGER verifications_ai AFTER INSERT ON verifications
FOR EACH ROW
BEGIN
  IF NEW.verification_type = 'final' THEN
    INSERT INTO completion_verification (id, project_id, verified_by, verification_status, remarks, verified_at)
    VALUES (
      NEW.id,
      NEW.project_id,
      NEW.verified_by,
      IF(NEW.status = 'verified', 'approved', 'rejected'),
      NEW.findings,
      NEW.verified_at
    )
    ON DUPLICATE KEY UPDATE
      project_id = VALUES(project_id),
      verified_by = VALUES(verified_by),
      verification_status = VALUES(verification_status),
      remarks = VALUES(remarks),
      verified_at = VALUES(verified_at);
  END IF;
END$$

DROP TRIGGER IF EXISTS verifications_au$$
CREATE TRIGGER verifications_au AFTER UPDATE ON verifications
FOR EACH ROW
BEGIN
  IF NEW.verification_type = 'final' THEN
    INSERT INTO completion_verification (id, project_id, verified_by, verification_status, remarks, verified_at)
    VALUES (
      NEW.id,
      NEW.project_id,
      NEW.verified_by,
      IF(NEW.status = 'verified', 'approved', 'rejected'),
      NEW.findings,
      NEW.verified_at
    )
    ON DUPLICATE KEY UPDATE
      project_id = VALUES(project_id),
      verified_by = VALUES(verified_by),
      verification_status = VALUES(verification_status),
      remarks = VALUES(remarks),
      verified_at = VALUES(verified_at);
  ELSE
    DELETE FROM completion_verification WHERE id = OLD.id;
  END IF;
END$$

DROP TRIGGER IF EXISTS verifications_ad$$
CREATE TRIGGER verifications_ad AFTER DELETE ON verifications
FOR EACH ROW
BEGIN
  DELETE FROM completion_verification WHERE id = OLD.id;
END$$

DELIMITER ;

INSERT IGNORE INTO citizens (id, name, email, phone, address, pincode, registered_at)
SELECT id, name, email, phone, address, pincode, created_at
FROM users
WHERE role = 'citizen';

INSERT IGNORE INTO government_users (id, name, email, password_hash, role, ministry_id, created_at)
SELECT
  id,
  name,
  email,
  password,
  CASE
    WHEN role = 'admin' THEN 'admin'
    WHEN role = 'ministry_officer' THEN 'ministry_officer'
    WHEN role IN ('department_head', 'senior_official') THEN 'approver'
    ELSE 'regional_manager'
  END,
  ministry_id,
  created_at
FROM users
WHERE role IN ('admin', 'ministry_officer', 'department_head', 'senior_official', 'regional_manager');

INSERT IGNORE INTO ministry_departments (id, ministry_id, name, description)
SELECT id, ministry_id, name, JSON_UNQUOTE(JSON_EXTRACT(responsibilities, '$[0]'))
FROM departments;

INSERT IGNORE INTO regional_managers (id, government_user_id, region_id)
SELECT id, id, region_id
FROM users
WHERE role = 'regional_manager' AND region_id IS NOT NULL;

INSERT IGNORE INTO complaint_verification (id, complaint_id, verified_by, verification_status, remarks, verified_at)
SELECT
  id,
  id,
  reviewed_by,
  IF(status = 'verified', 'approved', 'rejected'),
  COALESCE(review_notes, rejection_reason),
  reviewed_at
FROM complaints
WHERE status IN ('verified', 'rejected');

INSERT IGNORE INTO project_progress (id, project_id, progress_percentage, update_description, image_url, updated_at)
SELECT
  id,
  project_id,
  percentage_complete,
  description,
  JSON_UNQUOTE(JSON_EXTRACT(images, '$[0].url')),
  submitted_at
FROM progress_updates;

INSERT IGNORE INTO completion_verification (id, project_id, verified_by, verification_status, remarks, verified_at)
SELECT
  id,
  project_id,
  verified_by,
  IF(status = 'verified', 'approved', 'rejected'),
  findings,
  verified_at
FROM verifications
WHERE verification_type = 'final';
