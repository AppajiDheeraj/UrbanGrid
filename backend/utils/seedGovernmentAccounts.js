const bcrypt = require('bcryptjs');
const { queryOne, run } = require('./sql');

const DEFAULT_PASSWORD = 'UrbanGrid@123';

const governmentAccounts = [
  {
    name: 'UrbanGrid Core Admin',
    email: 'admin@urbangrid.local',
    role: 'admin'
  },
  {
    name: 'Urban Development Officer',
    email: 'ministry@urbangrid.local',
    role: 'ministry_officer',
    ministryCode: 'URBAN_DEV',
    departmentCode: 'INFRA'
  },
  {
    name: 'Infrastructure Department Head',
    email: 'department@urbangrid.local',
    role: 'department_head',
    ministryCode: 'URBAN_DEV',
    departmentCode: 'INFRA'
  },
  {
    name: 'Senior Approval Official',
    email: 'senior@urbangrid.local',
    role: 'senior_official',
    ministryCode: 'URBAN_DEV',
    departmentCode: 'INFRA'
  },
  {
    name: 'Central Region Manager',
    email: 'region@urbangrid.local',
    role: 'regional_manager',
    regionCode: 'CENTRAL'
  }
];

const getOrCreateMinistry = async () => {
  await run(
    `
      INSERT INTO ministries (name, code, description)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description)
    `,
    ['Urban Development Ministry', 'URBAN_DEV', 'Handles civic infrastructure and urban services.']
  );

  return queryOne('SELECT id FROM ministries WHERE code = ? LIMIT 1', ['URBAN_DEV']);
};

const getOrCreateDepartment = async (ministryId) => {
  const existing = await queryOne(
    'SELECT id FROM departments WHERE ministry_id = ? AND code = ? LIMIT 1',
    [ministryId, 'INFRA']
  );

  if (existing) {
    return existing;
  }

  const result = await run(
    `
      INSERT INTO departments (ministry_id, name, code, description, responsibilities)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      ministryId,
      'Infrastructure Department',
      'INFRA',
      'Reviews infrastructure complaints, tenders, and projects.',
      JSON.stringify(['complaint_review', 'tender_management', 'project_monitoring'])
    ]
  );

  return { id: result.insertId };
};

const getOrCreateRegion = async () => {
  const firstExisting = await queryOne('SELECT id, code, name FROM regions ORDER BY id ASC LIMIT 1');

  if (firstExisting) {
    return firstExisting;
  }

  await run(
    `
      INSERT INTO regions (name, code)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `,
    ['Central Region', 'CENTRAL']
  );

  return queryOne('SELECT id FROM regions WHERE code = ? LIMIT 1', ['CENTRAL']);
};

const seedGovernmentAccounts = async () => {
  const ministry = await getOrCreateMinistry();
  const department = await getOrCreateDepartment(ministry.id);
  const region = await getOrCreateRegion();
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  for (const account of governmentAccounts) {
    const ministryId = account.ministryCode ? ministry.id : null;
    const regionId = account.regionCode ? region.id : null;
    const existing = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [account.email]);

    if (existing) {
      await run(
        `
          UPDATE users
          SET
            name = ?,
            password_hash = ?,
            role = ?,
            ministry_id = ?,
            region_id = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [account.name, passwordHash, account.role, ministryId, regionId, existing.id]
      );
      continue;
    }

    await run(
      `
        INSERT INTO users (
          name,
          email,
          password_hash,
          role,
          ministry_id,
          region_id,
          ward_no
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        account.name,
        account.email,
        passwordHash,
        account.role,
        ministryId,
        regionId,
        account.role === 'regional_manager' ? '15' : null
      ]
    );
  }

  return {
    accounts: governmentAccounts.map(account => ({
      name: account.name,
      email: account.email,
      role: account.role,
      password: DEFAULT_PASSWORD
    })),
    departmentId: department.id,
    ministryId: ministry.id,
    regionId: region.id
  };
};

module.exports = {
  seedGovernmentAccounts,
  governmentAccounts,
  DEFAULT_PASSWORD
};
