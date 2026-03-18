USE urbangrid;

SET @default_password_hash = '$2a$12$qL7dyhjhJRJntR54VYnp8.SVNrRR7FlFILG758Oc.Z0SxC/dlhESC';

INSERT INTO ministries (name, code, description)
VALUES
  ('Urban Development', 'URBAN_DEV', 'Urban planning and civic works'),
  ('Transport', 'TRANSPORT', 'Road and mobility infrastructure'),
  ('Water Supply', 'WATER_SUPPLY', 'Water distribution and maintenance')
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

INSERT INTO departments (ministry_id, name, code, responsibilities)
SELECT m.id, 'Public Works Department', 'PWD', JSON_ARRAY('road_damage', 'drainage')
FROM ministries m
WHERE m.code = 'TRANSPORT'
ON DUPLICATE KEY UPDATE
  responsibilities = VALUES(responsibilities);

INSERT INTO departments (ministry_id, name, code, responsibilities)
SELECT m.id, 'Utility Response Unit', 'UTIL_RESP', JSON_ARRAY('water_leakage', 'streetlight_failure')
FROM ministries m
WHERE m.code = 'URBAN_DEV'
ON DUPLICATE KEY UPDATE
  responsibilities = VALUES(responsibilities);

INSERT INTO users (name, email, password, role, is_active, is_email_verified)
VALUES
  ('System Admin', 'admin@urbangrid.local', @default_password_hash, 'admin', 1, 1),
  ('Ministry Officer', 'officer@urbangrid.local', @default_password_hash, 'ministry_officer', 1, 1),
  ('Department Head', 'depthead@urbangrid.local', @default_password_hash, 'department_head', 1, 1),
  ('Senior Official', 'senior@urbangrid.local', @default_password_hash, 'senior_official', 1, 1),
  ('Regional Manager', 'region@urbangrid.local', @default_password_hash, 'regional_manager', 1, 1),
  ('Resident User', 'resident@urbangrid.local', @default_password_hash, 'citizen', 1, 1),
  ('Contractor User', 'contractor@urbangrid.local', @default_password_hash, 'contractor', 1, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  is_active = VALUES(is_active),
  is_email_verified = VALUES(is_email_verified);

SET @urban_ministry_id = (SELECT id FROM ministries WHERE code = 'URBAN_DEV' LIMIT 1);
SET @transport_department_id = (
  SELECT d.id
  FROM departments d
  INNER JOIN ministries m ON m.id = d.ministry_id
  WHERE d.code = 'PWD' AND m.code = 'TRANSPORT'
  LIMIT 1
);
SET @utility_department_id = (
  SELECT d.id
  FROM departments d
  INNER JOIN ministries m ON m.id = d.ministry_id
  WHERE d.code = 'UTIL_RESP' AND m.code = 'URBAN_DEV'
  LIMIT 1
);
SET @regional_manager_user_id = (SELECT id FROM users WHERE email = 'region@urbangrid.local' LIMIT 1);

INSERT INTO regions (name, pin_codes, manager_id, department_id)
VALUES (
  'Central Zone',
  JSON_ARRAY('560001', '560002', '560003'),
  @regional_manager_user_id,
  @utility_department_id
)
ON DUPLICATE KEY UPDATE
  manager_id = VALUES(manager_id),
  department_id = VALUES(department_id),
  pin_codes = VALUES(pin_codes);

SET @region_id = (SELECT id FROM regions WHERE name = 'Central Zone' LIMIT 1);
SET @contractor_user_id = (SELECT id FROM users WHERE email = 'contractor@urbangrid.local' LIMIT 1);

UPDATE users
SET ministry_id = @urban_ministry_id,
    department_id = @utility_department_id
WHERE email IN ('officer@urbangrid.local', 'depthead@urbangrid.local', 'senior@urbangrid.local');

UPDATE users
SET region_id = @region_id
WHERE email = 'region@urbangrid.local';

INSERT INTO contractors (
  user_id,
  company_name,
  registration_number,
  gst_number,
  specializations,
  is_verified,
  is_active
)
VALUES (
  @contractor_user_id,
  'MetroInfra Constructions',
  'REG-URBANGRID-0001',
  '29ABCDE1234F1Z5',
  JSON_ARRAY('road_repair', 'drainage', 'general'),
  1,
  1
)
ON DUPLICATE KEY UPDATE
  company_name = VALUES(company_name),
  gst_number = VALUES(gst_number),
  specializations = VALUES(specializations),
  is_verified = VALUES(is_verified),
  is_active = VALUES(is_active);

INSERT INTO user_settings (user_id, theme, language, email_notifications, sms_notifications, push_notifications)
SELECT u.id, 'system', 'en', 1, 0, 1
FROM users u
ON DUPLICATE KEY UPDATE
  theme = VALUES(theme),
  language = VALUES(language),
  email_notifications = VALUES(email_notifications),
  sms_notifications = VALUES(sms_notifications),
  push_notifications = VALUES(push_notifications);
