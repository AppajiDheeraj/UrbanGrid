const generateId = require('../utils/generateId');
const { query, queryOne, run } = require('../utils/sql');
const {
  mapMinistry,
  mapDepartment,
  mapSimpleUser,
  mapComplaint,
  mapTender
} = require('../utils/serializers');

const mapTenderLite = (row) => {
  if (!row.tender_ref_id) {
    return null;
  }

  return {
    _id: row.tender_ref_id,
    id: row.tender_ref_id,
    tenderId: row.tender_ref_tender_id,
    status: row.tender_ref_status
  };
};

const citizenController = {
  submitComplaint: async (req, res) => {
    try {
      const { title, description, category, address, pinCode, latitude, longitude } = req.body;

      if (!title || !description || !category || !address || !pinCode) {
        return res.status(400).json({ message: 'All required fields must be provided' });
      }

      if (title.length > 200) {
        return res.status(400).json({ message: 'Title cannot exceed 200 characters' });
      }

      if (description.length > 2000) {
        return res.status(400).json({ message: 'Description cannot exceed 2000 characters' });
      }

      const duplicateComplaint = await queryOne(
        `
          SELECT id
          FROM complaints
          WHERE citizen_id = ?
            AND LOWER(title) LIKE ?
            AND pin_code = ?
            AND submitted_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
          LIMIT 1
        `,
        [req.user.id, `%${title.toLowerCase().trim()}%`, pinCode.trim()]
      );

      if (duplicateComplaint) {
        return res.status(400).json({
          message: 'A similar complaint has already been submitted in the last 24 hours. Please check your existing complaints.'
        });
      }

      const region = await queryOne(
        `
          SELECT id
          FROM regions
          WHERE JSON_SEARCH(pin_codes, 'one', ?) IS NOT NULL
          LIMIT 1
        `,
        [pinCode.trim()]
      );

      const complaintPublicId = generateId('CMP');
      const result = await run(
        `
          INSERT INTO complaints (
            complaint_id,
            citizen_id,
            title,
            description,
            category,
            images,
            address,
            pin_code,
            region_id,
            latitude,
            longitude
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          complaintPublicId,
          req.user.id,
          title.trim(),
          description.trim(),
          category,
          JSON.stringify(req.files ? req.files.map(file => ({ url: `/uploads/${file.filename}` })) : []),
          address.trim(),
          pinCode.trim(),
          region?.id || null,
          latitude ? parseFloat(latitude) : null,
          longitude ? parseFloat(longitude) : null
        ]
      );

      const complaint = await queryOne(
        `
          SELECT id, complaint_id, title, status, submitted_at
          FROM complaints
          WHERE id = ?
          LIMIT 1
        `,
        [result.insertId]
      );

      res.status(201).json({
        message: 'Complaint submitted successfully',
        complaint: {
          id: complaint.id,
          _id: complaint.id,
          complaintId: complaint.complaint_id,
          title: complaint.title,
          status: complaint.status,
          submittedAt: complaint.submitted_at
        }
      });
    } catch (error) {
      console.error('Complaint submission error:', error);
      res.status(500).json({ message: 'Failed to submit complaint. Please try again.' });
    }
  },

  getMyComplaints: async (req, res) => {
    try {
      const rows = await query(
        `
          SELECT
            c.*,
            m.id AS ministry_ref_id,
            m.name AS ministry_ref_name,
            m.code AS ministry_ref_code,
            d.id AS department_ref_id,
            d.name AS department_ref_name,
            d.code AS department_ref_code,
            d.responsibilities AS department_ref_responsibilities,
            d.ministry_id AS department_ref_ministry_id,
            d.is_active AS department_ref_is_active,
            d.created_at AS department_ref_created_at,
            d.updated_at AS department_ref_updated_at,
            t.id AS tender_ref_id,
            t.tender_id AS tender_ref_tender_id,
            t.status AS tender_ref_status
          FROM complaints c
          LEFT JOIN ministries m ON m.id = c.ministry_id
          LEFT JOIN departments d ON d.id = c.department_id
          LEFT JOIN tenders t ON t.complaint_id = c.id
          WHERE c.citizen_id = ?
          ORDER BY c.created_at DESC
        `,
        [req.user.id]
      );

      const complaints = rows.map(row =>
        mapComplaint(row, {
          ministry: mapMinistry(row, 'ministry_ref_'),
          department: mapDepartment(row, 'department_ref_'),
          tender: mapTenderLite(row)
        })
      );

      res.json({ complaints });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getComplaint: async (req, res) => {
    try {
      const row = await queryOne(
        `
          SELECT
            c.*,
            m.id AS ministry_ref_id,
            m.name AS ministry_ref_name,
            m.code AS ministry_ref_code,
            d.id AS department_ref_id,
            d.name AS department_ref_name,
            d.code AS department_ref_code,
            d.responsibilities AS department_ref_responsibilities,
            d.ministry_id AS department_ref_ministry_id,
            d.is_active AS department_ref_is_active,
            d.created_at AS department_ref_created_at,
            d.updated_at AS department_ref_updated_at,
            u.id AS reviewed_by_user_id,
            u.name AS reviewed_by_user_name,
            u.email AS reviewed_by_user_email,
            u.role AS reviewed_by_user_role,
            u.phone AS reviewed_by_user_phone,
            u.address AS reviewed_by_user_address,
            u.is_active AS reviewed_by_user_is_active,
            u.is_email_verified AS reviewed_by_user_is_email_verified,
            u.created_at AS reviewed_by_user_created_at,
            u.updated_at AS reviewed_by_user_updated_at
          FROM complaints c
          LEFT JOIN ministries m ON m.id = c.ministry_id
          LEFT JOIN departments d ON d.id = c.department_id
          LEFT JOIN users u ON u.id = c.reviewed_by
          WHERE c.id = ? AND c.citizen_id = ?
          LIMIT 1
        `,
        [req.params.id, req.user.id]
      );

      if (!row) {
        return res.status(404).json({ message: 'Complaint not found' });
      }

      const tenderRow = await queryOne('SELECT * FROM tenders WHERE complaint_id = ? LIMIT 1', [row.id]);

      const complaint = mapComplaint(row, {
        ministry: mapMinistry(row, 'ministry_ref_'),
        department: mapDepartment(row, 'department_ref_'),
        reviewedBy: mapSimpleUser(row, 'reviewed_by_user_'),
        tender: tenderRow ? mapTender(tenderRow) : null
      });

      res.json({ complaint });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  trackStatus: async (req, res) => {
    try {
      const row = await queryOne(
        `
          SELECT
            c.id,
            c.complaint_id,
            c.status,
            c.submitted_at,
            c.reviewed_at,
            t.id AS tender_id,
            t.tender_id AS tender_public_id,
            t.status AS tender_status
          FROM complaints c
          LEFT JOIN tenders t ON t.complaint_id = c.id
          WHERE c.id = ? AND c.citizen_id = ?
          LIMIT 1
        `,
        [req.params.id, req.user.id]
      );

      if (!row) {
        return res.status(404).json({ message: 'Complaint not found' });
      }

      res.json({
        complaintId: row.complaint_id,
        status: row.status,
        submittedAt: row.submitted_at,
        reviewedAt: row.reviewed_at,
        tender: row.tender_id
          ? {
              _id: row.tender_id,
              id: row.tender_id,
              tenderId: row.tender_public_id,
              status: row.tender_status
            }
          : null
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = citizenController;
