const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const generateToken = require('../utils/generateToken');
const { queryOne, run, withTransaction } = require('../utils/sql');
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

const authController = {
  register: async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        role,
        phone,
        address,
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
      const userRole = role || 'citizen';

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ message: 'Invalid role for registration' });
      }

      const userId = await withTransaction(async (tx) => {
        if (userRole === 'contractor') {
          if (!companyName || !registrationNumber) {
            throw createHttpError(400, 'Company name and registration number are required for contractors');
          }

          const existingContractor = await tx.queryOne(
            'SELECT id FROM contractors WHERE registration_number = ? LIMIT 1',
            [registrationNumber.trim()]
          );

          if (existingContractor) {
            throw createHttpError(400, 'Contractor with this registration number already exists');
          }
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const userResult = await tx.run(
          `
            INSERT INTO users (
              name,
              email,
              password,
              role,
              phone,
              address,
              is_email_verified,
              email_verification_token
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            name.trim(),
            normalizedEmail,
            hashedPassword,
            userRole,
            phone?.trim() || null,
            address?.trim() || null,
            0,
            crypto.randomBytes(32).toString('hex')
          ]
        );

        if (userRole === 'contractor') {
          await tx.run(
            `
              INSERT INTO contractors (
                user_id,
                company_name,
                registration_number,
                gst_number,
                specializations
              )
              VALUES (?, ?, ?, ?, ?)
            `,
            [
              userResult.insertId,
              companyName.trim(),
              registrationNumber.trim(),
              gstNumber?.trim() || null,
              JSON.stringify(normalizeArrayField(specializations, ['general']))
            ]
          );
        }

        return userResult.insertId;
      });

      const user = await getUserProfileById(userId);

      res.status(201).json({
        message: 'User registered successfully. Please check your email for verification.',
        user: {
          id: user.id,
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
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
            password,
            role,
            is_active,
            is_email_verified,
            failed_login_attempts,
            lock_until
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
            SET failed_login_attempts = ?, lock_until = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [failedAttempts, lockUntil, userRow.id]
        );

        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (!userRow.is_active) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }

      await run(
        `
          UPDATE users
          SET failed_login_attempts = 0, lock_until = NULL, last_login = NOW(), updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [userRow.id]
      );

      const user = await getAuthUserById(userRow.id);

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified
        },
        token: generateToken(user.id)
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed. Please try again.' });
    }
  },

  getMe: async (req, res) => {
    try {
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
          phone: user.phone || '',
          address: user.address || '',
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
      const { name, phone, address } = req.body;
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

        const authUser = await getAuthUserById(req.user.id);
        const isMatch = await bcrypt.compare(currentPassword, authUser.password);

        if (!isMatch) {
          return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await run(
          'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
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
