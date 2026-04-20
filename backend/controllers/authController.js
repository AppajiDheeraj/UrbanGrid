const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const generateToken = require('../utils/generateToken');
const { queryOne, run, withTransaction, ensureColumn, tableHasColumn } = require('../utils/sql');
const { getAuthUserById, getUserProfileById } = require('../utils/userQueries');

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeArrayField = (value, fallback = []) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  return fallback;
};

const ensureProfileSchema = async () => {
  await ensureColumn('users', 'address', 'address VARCHAR(255) NULL', 'AFTER phone');
  await ensureColumn('users', 'pincode', 'pincode VARCHAR(10) NULL', 'AFTER address');
};

const ensureUserSettingsSchema = async () => {
  const exists = await tableHasColumn('user_settings', 'user_id');

  if (exists) {
    return;
  }

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
};

const authController = {
  register: async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        role,
        officialRole,
        phone,
        address,
        pincode,
        wardNo,
        ministryId,
        departmentId,
        regionId,
        companyName,
        registrationNumber,
        gstNumber,
        specializations
      } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
      }

      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password)) {
        return res.status(400).json({
          message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);

      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const allowedRoles = ['citizen', 'contractor'];
      const normalizedRole = String(role || '').trim().toLowerCase();
      const userRole = normalizedRole || 'citizen';

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ message: 'Only resident and contractor registration is available publicly' });
      }

      const normalizedWardNo = wardNo ? String(wardNo).trim() : null;
      const normalizedCompanyName = companyName ? companyName.trim() : null;
      const normalizedRegistrationNumber = registrationNumber ? registrationNumber.trim() : null;
      const normalizedGstNumber = gstNumber ? gstNumber.trim() : null;
      const normalizedSpecializations = JSON.stringify(normalizeArrayField(specializations, ['general']));

      const userId = await withTransaction(async (tx) => {
        if (userRole === 'contractor') {
          if (!normalizedCompanyName || !normalizedRegistrationNumber) {
            throw createHttpError(400, 'Company name and registration number are required for contractors');
          }

          const existingContractor = await tx.queryOne(
            'SELECT id FROM users WHERE registration_number = ? LIMIT 1',
            [normalizedRegistrationNumber]
          );

          if (existingContractor) {
            throw createHttpError(400, 'Contractor with this registration number already exists');
          }
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        let locationId = null;
        const normalizedAddress = address?.trim() || null;
        const normalizedPincode = pincode?.trim() || null;

        if (normalizedAddress && normalizedPincode && normalizedWardNo) {
          const existingLocation = await tx.queryOne(
            `
              SELECT id, region_id
              FROM locations
              WHERE ward_no = ? AND pincode = ? LIMIT 1
            `,
            [normalizedWardNo, normalizedPincode]
          );

          if (existingLocation) {
            locationId = existingLocation.id;
          } else {
            const regionRow = regionId
              ? await tx.queryOne('SELECT id FROM regions WHERE id = ? LIMIT 1', [Number(regionId)])
              : await tx.queryOne(
                  `
                    SELECT region_id AS id
                    FROM locations
                    WHERE pincode = ?
                    LIMIT 1
                  `,
                  [normalizedPincode]
                );

            if (regionRow?.id) {
              const locationResult = await tx.run(
                `
                  INSERT INTO locations (
                    region_id,
                    ward_no,
                    address,
                    pincode
                  )
                  VALUES (?, ?, ?, ?)
                `,
                [
                  regionRow.id,
                  normalizedWardNo,
                  normalizedAddress,
                  normalizedPincode
                ]
              );

              locationId = locationResult.insertId;
            }
          }
        }

        const userResult = await tx.run(
          `
            INSERT INTO users (
              name,
              email,
              password_hash,
              role,
              location_id,
              ministry_id,
              region_id,
              phone,
              address,
              pincode,
              ward_no,
              company_name,
              registration_number,
              contractor_rating,
              total_projects,
              completed_projects
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            name.trim(),
            normalizedEmail,
            hashedPassword,
            userRole,
            locationId,
            ministryId ? Number(ministryId) : null,
            regionId ? Number(regionId) : null,
            phone?.trim() || null,
            normalizedAddress,
            normalizedPincode,
            normalizedWardNo,
            userRole === 'contractor' ? normalizedCompanyName : null,
            userRole === 'contractor' ? normalizedRegistrationNumber : null,
            userRole === 'contractor' ? 0 : null,
            userRole === 'contractor' ? 0 : null,
            userRole === 'contractor' ? 0 : null
          ]
        );

        return userResult.insertId;
      });

      await ensureProfileSchema();
      const user = await getUserProfileById(userId);

      res.status(201).json({
        message: 'User registered successfully. Please check your email for verification.',
          user: {
            id: user.id,
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            wardNo: user.wardNo || null,
            isEmailVerified: user.isEmailVerified
          },
        token: generateToken(user.id)
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(error.statusCode || 500).json({
        message: error.statusCode ? error.message : 'Registration failed. Please try again.'
      });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const userRow = await queryOne(
        `
          SELECT
            id,
            name,
            email,
            password_hash AS password,
            role,
            NULL AS is_active,
            NULL AS is_email_verified,
            failed_login_attempts,
            account_locked_until AS lock_until
          FROM users
          WHERE email = ?
          LIMIT 1
        `,
        [normalizedEmail]
      );

      if (!userRow) {
        await run(
          `
            INSERT INTO user_login_attempts (email, ip_address, user_agent, was_successful)
            VALUES (?, ?, ?, ?)
          `,
          [normalizedEmail, req.ip, req.get('User-Agent') || null, 0]
        );
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (userRow.lock_until && new Date(userRow.lock_until) > new Date()) {
        return res.status(423).json({ message: 'Account temporarily locked due to multiple failed attempts' });
      }

      const isMatch = await bcrypt.compare(password, userRow.password);

      await run(
        `
          INSERT INTO user_login_attempts (user_id, email, ip_address, user_agent, was_successful)
          VALUES (?, ?, ?, ?, ?)
        `,
        [userRow.id, userRow.email, req.ip, req.get('User-Agent') || null, isMatch ? 1 : 0]
      );

      if (!isMatch) {
        const failedAttempts = (userRow.failed_login_attempts || 0) + 1;
        const lockUntil = failedAttempts >= 5
          ? new Date(Date.now() + 30 * 60 * 1000)
          : null;

        await run(
          `
            UPDATE users
            SET failed_login_attempts = ?, account_locked_until = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [failedAttempts, lockUntil, userRow.id]
        );

        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (userRow.is_active != null && !Boolean(userRow.is_active)) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }

      await run(
        `
          UPDATE users
          SET failed_login_attempts = 0, account_locked_until = NULL, last_login = NOW(), updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [userRow.id]
      );

      await ensureProfileSchema();
      const user = await getAuthUserById(userRow.id);

      res.json({
        message: 'Login successful',
          user: {
            id: user.id,
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            wardNo: user.wardNo || null,
            isEmailVerified: user.isEmailVerified
          },
        token: generateToken(user.id)
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed. Please try again.' });
    }
  },

  logout: async (req, res) => {
    res.json({ message: 'Logout successful' });
  },

  refresh: async (req, res) => {
    try {
      await ensureProfileSchema();
      const user = await getAuthUserById(req.user.id);

      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'User not authorized' });
      }

      res.json({
        message: 'Token refreshed',
        token: generateToken(user.id),
        user: {
          id: user.id,
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getMe: async (req, res) => {
    try {
      await ensureProfileSchema();
      const user = await getUserProfileById(req.user.id);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ user });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getProfile: async (req, res) => {
    try {
      await ensureProfileSchema();
      const user = await getUserProfileById(req.user.id);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        profile: {
          id: user.id,
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          wardNo: user.wardNo || '',
          phone: user.phone || '',
          address: user.address || '',
          pincode: user.pincode || '',
          ministry: user.ministry,
          department: user.department,
          region: user.region,
          contractorProfile: user.contractorProfile
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  updateProfile: async (req, res) => {
    try {
      await ensureProfileSchema();

      const { name, phone, address, pincode, wardNo } = req.body;
      const updates = [];
      const params = [];

      if (typeof name === 'string' && name.trim()) {
        updates.push('name = ?');
        params.push(name.trim());
      }

      if (typeof phone === 'string') {
        updates.push('phone = ?');
        params.push(phone.trim() || null);
      }

      if (typeof address === 'string') {
        updates.push('address = ?');
        params.push(address.trim() || null);
      }

      if (typeof pincode === 'string') {
        updates.push('pincode = ?');
        params.push(pincode.trim() || null);
      }

      if (typeof wardNo === 'string') {
        updates.push('ward_no = ?');
        params.push(wardNo.trim() || null);
      }

      if (!updates.length) {
        return res.status(400).json({ message: 'No valid profile fields provided' });
      }

      await run(
        `
          UPDATE users
          SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [...params, req.user.id]
      );

      const user = await getUserProfileById(req.user.id);
      res.json({ message: 'Profile updated successfully', profile: user });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getSettings: async (req, res) => {
    try {
      await ensureUserSettingsSchema();

      const existing = await queryOne(
        `
          SELECT theme, language, email_notifications, sms_notifications, push_notifications
          FROM user_settings
          WHERE user_id = ?
          LIMIT 1
        `,
        [req.user.id]
      );

      if (!existing) {
        await run(
          `
            INSERT INTO user_settings (
              user_id, theme, language, email_notifications, sms_notifications, push_notifications
            ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          [req.user.id, 'system', 'en', 1, 0, 1]
        );
      }

      const settings = await queryOne(
        `
          SELECT theme, language, email_notifications, sms_notifications, push_notifications
          FROM user_settings
          WHERE user_id = ?
          LIMIT 1
        `,
        [req.user.id]
      );

      res.json({
        settings: {
          theme: settings?.theme || 'system',
          language: settings?.language || 'en',
          emailNotifications: Boolean(settings?.email_notifications ?? 1),
          smsNotifications: Boolean(settings?.sms_notifications ?? 0),
          pushNotifications: Boolean(settings?.push_notifications ?? 1)
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  updateSettings: async (req, res) => {
    try {
      await ensureUserSettingsSchema();

      const {
        theme,
        language,
        emailNotifications,
        smsNotifications,
        pushNotifications,
        currentPassword,
        newPassword
      } = req.body;

      const normalizedTheme = ['light', 'dark', 'system'].includes(theme) ? theme : 'system';
      const normalizedLanguage = typeof language === 'string' && language.trim() ? language.trim().slice(0, 10) : 'en';

      await run(
        `
          INSERT INTO user_settings (
            user_id, theme, language, email_notifications, sms_notifications, push_notifications
          )
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            theme = VALUES(theme),
            language = VALUES(language),
            email_notifications = VALUES(email_notifications),
            sms_notifications = VALUES(sms_notifications),
            push_notifications = VALUES(push_notifications),
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          req.user.id,
          normalizedTheme,
          normalizedLanguage,
          emailNotifications ? 1 : 0,
          smsNotifications ? 1 : 0,
          pushNotifications ? 1 : 0
        ]
      );

      if (newPassword || currentPassword) {
        if (!currentPassword || !newPassword) {
          return res.status(400).json({ message: 'Both currentPassword and newPassword are required to change password' });
        }

        if (newPassword.length < 8) {
          return res.status(400).json({ message: 'Password must be at least 8 characters long' });
        }

        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(newPassword)) {
          return res.status(400).json({
            message: 'New password must contain uppercase, lowercase, number, and special character'
          });
        }

        await ensureProfileSchema();
        const authUser = await getAuthUserById(req.user.id);
        const isMatch = await bcrypt.compare(currentPassword, authUser.password);

        if (!isMatch) {
          return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await run(
          'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [hashedPassword, req.user.id]
        );
      }

      const settings = await queryOne(
        `
          SELECT theme, language, email_notifications, sms_notifications, push_notifications
          FROM user_settings
          WHERE user_id = ?
          LIMIT 1
        `,
        [req.user.id]
      );

      res.json({
        message: 'Settings updated successfully',
        settings: {
          theme: settings?.theme || 'system',
          language: settings?.language || 'en',
          emailNotifications: Boolean(settings?.email_notifications ?? 1),
          smsNotifications: Boolean(settings?.sms_notifications ?? 0),
          pushNotifications: Boolean(settings?.push_notifications ?? 1)
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = authController;
