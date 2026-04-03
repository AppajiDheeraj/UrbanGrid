const { queryOne } = require('./sql');
const {
  mapSimpleUser,
  mapMinistry,
  mapDepartment,
  mapRegion,
  mapContractor
} = require('./serializers');

const getAuthUserById = async (id) => {
  const row = await queryOne(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.password,
        u.role,
        u.ministry_id,
        u.department_id,
        u.region_id,
        u.phone,
        u.address,
        u.pincode,
        u.ward_no,
        u.is_active,
        u.is_email_verified,
        u.failed_login_attempts,
        u.lock_until,
        u.last_login,
        c.id AS contractor_profile_id
      FROM users u
      LEFT JOIN contractors c ON c.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `,
    [id]
  );

  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    ministry: row.ministry_id,
    department: row.department_id,
    region: row.region_id,
    contractorProfile: row.contractor_profile_id,
    phone: row.phone ?? null,
    address: row.address ?? null,
    pincode: row.pincode ?? null,
    wardNo: row.ward_no ?? null,
    isActive: Boolean(row.is_active),
    isEmailVerified: Boolean(row.is_email_verified),
    failedLoginAttempts: row.failed_login_attempts ?? 0,
    lockUntil: row.lock_until ?? null,
    lastLogin: row.last_login ?? null
  };
};

const getUserProfileById = async (id) => {
  const row = await queryOne(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.phone,
        u.address,
        u.pincode,
        u.ward_no,
        u.is_active,
        u.is_email_verified,
        u.created_at,
        u.updated_at,
        m.id AS ministry_id,
        m.name AS ministry_name,
        m.code AS ministry_code,
        m.description AS ministry_description,
        m.is_active AS ministry_is_active,
        m.created_at AS ministry_created_at,
        m.updated_at AS ministry_updated_at,
        d.id AS department_id,
        d.name AS department_name,
        d.code AS department_code,
        d.responsibilities AS department_responsibilities,
        d.is_active AS department_is_active,
        d.ministry_id AS department_ministry_id,
        d.created_at AS department_created_at,
        d.updated_at AS department_updated_at,
        r.id AS region_id,
        r.name AS region_name,
        r.pin_codes AS region_pin_codes,
        r.manager_id AS region_manager_id,
        r.department_id AS region_department_id,
        r.is_active AS region_is_active,
        r.created_at AS region_created_at,
        r.updated_at AS region_updated_at,
        c.id AS contractor_id,
        c.user_id AS contractor_user_id,
        c.company_name AS contractor_company_name,
        c.registration_number AS contractor_registration_number,
        c.gst_number AS contractor_gst_number,
        c.address AS contractor_address,
        c.phone AS contractor_phone,
        c.specializations AS contractor_specializations,
        c.past_projects AS contractor_past_projects,
        c.rating AS contractor_rating,
        c.documents AS contractor_documents,
        c.is_verified AS contractor_is_verified,
        c.is_active AS contractor_is_active,
        c.created_at AS contractor_created_at,
        c.updated_at AS contractor_updated_at
      FROM users u
      LEFT JOIN ministries m ON m.id = u.ministry_id
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN regions r ON r.id = u.region_id
      LEFT JOIN contractors c ON c.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `,
    [id]
  );

  if (!row) {
    return null;
  }

  const user = mapSimpleUser(row);

  return {
    ...user,
    ministry: mapMinistry(row, 'ministry_'),
    department: mapDepartment(row, 'department_'),
    region: mapRegion(row, 'region_'),
    contractorProfile: mapContractor(row, 'contractor_')
  };
};

module.exports = {
  getAuthUserById,
  getUserProfileById
};
