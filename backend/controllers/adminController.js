const { query, queryOne, run } = require('../utils/sql');
const {
  mapSimpleUser,
  mapMinistry,
  mapDepartment,
  mapComplaint
} = require('../utils/serializers');

const categoryToMinistryMap = {
  road_damage: 'transport',
  water_leakage: 'water supply',
  streetlight_failure: 'urban development',
  garbage: 'waste management',
  drainage: 'public works'
};

const complaintSelect = `
  SELECT
    c.*,
    citizen.id AS citizen_id,
    citizen.name AS citizen_name,
    citizen.email AS citizen_email,
    citizen.role AS citizen_role,
    citizen.phone AS citizen_phone,
    citizen.address AS citizen_address,
    citizen.is_active AS citizen_is_active,
    citizen.is_email_verified AS citizen_is_email_verified,
    citizen.created_at AS citizen_created_at,
    citizen.updated_at AS citizen_updated_at,
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
    d.updated_at AS department_ref_updated_at
  FROM complaints c
  LEFT JOIN users citizen ON citizen.id = c.citizen_id
  LEFT JOIN ministries m ON m.id = c.ministry_id
  LEFT JOIN departments d ON d.id = c.department_id
`;

const mapComplaintRow = (row) =>
  mapComplaint(row, {
    citizen: mapSimpleUser(row, 'citizen_'),
    ministry: mapMinistry(row, 'ministry_ref_'),
    department: mapDepartment(row, 'department_ref_')
  });

const adminController = {
  getPendingComplaints: async (req, res) => {
    try {
      const rows = await query(
        `${complaintSelect} WHERE c.status = 'submitted' ORDER BY c.submitted_at ASC`
      );

      res.json({ complaints: rows.map(mapComplaintRow) });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getAllComplaints: async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
      const offset = (page - 1) * limit;
      const filters = [];
      const params = [];

      if (req.query.status) {
        filters.push('c.status = ?');
        params.push(req.query.status);
      }

      const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      const rows = await query(
        `${complaintSelect} ${whereClause} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const countRow = await queryOne(
        `SELECT COUNT(*) AS total FROM complaints c ${whereClause}`,
        params
      );

      res.json({
        complaints: rows.map(mapComplaintRow),
        totalPages: Math.ceil((countRow?.total || 0) / limit),
        currentPage: page,
        total: countRow?.total || 0
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  verifyComplaint: async (req, res) => {
    try {
      const { id } = req.params;
      const { ministryId, departmentId, notes } = req.body;

      const complaint = await queryOne('SELECT * FROM complaints WHERE id = ? LIMIT 1', [id]);

      if (!complaint) {
        return res.status(404).json({ message: 'Complaint not found' });
      }

      let resolvedMinistryId = ministryId || null;
      let resolvedDepartmentId = departmentId || null;

      if (!resolvedMinistryId && complaint.category) {
        const ministryName = categoryToMinistryMap[complaint.category] || 'urban development';
        const ministry = await queryOne(
          'SELECT id FROM ministries WHERE LOWER(name) LIKE ? LIMIT 1',
          [`%${ministryName}%`]
        );
        resolvedMinistryId = ministry?.id || null;
      }

      await run(
        `
          UPDATE complaints
          SET
            status = 'verified',
            ministry_id = ?,
            department_id = ?,
            reviewed_by = ?,
            reviewed_at = NOW(),
            review_notes = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [resolvedMinistryId, resolvedDepartmentId, req.user.id, notes || null, id]
      );

      const updated = await queryOne('SELECT * FROM complaints WHERE id = ? LIMIT 1', [id]);

      res.json({
        message: 'Complaint verified and routed to ministry',
        complaint: mapComplaint(updated)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  rejectComplaint: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const complaint = await queryOne('SELECT id FROM complaints WHERE id = ? LIMIT 1', [id]);

      if (!complaint) {
        return res.status(404).json({ message: 'Complaint not found' });
      }

      await run(
        `
          UPDATE complaints
          SET
            status = 'rejected',
            reviewed_by = ?,
            reviewed_at = NOW(),
            rejection_reason = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [req.user.id, reason || null, id]
      );

      const updated = await queryOne('SELECT * FROM complaints WHERE id = ? LIMIT 1', [id]);

      res.json({
        message: 'Complaint rejected',
        complaint: mapComplaint(updated)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  routeComplaint: async (req, res) => {
    try {
      const { id } = req.params;
      const { ministryId, departmentId } = req.body;

      const complaint = await queryOne('SELECT id FROM complaints WHERE id = ? LIMIT 1', [id]);

      if (!complaint) {
        return res.status(404).json({ message: 'Complaint not found' });
      }

      await run(
        `
          UPDATE complaints
          SET ministry_id = ?, department_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [ministryId || null, departmentId || null, id]
      );

      const updated = await queryOne('SELECT * FROM complaints WHERE id = ? LIMIT 1', [id]);

      res.json({
        message: 'Complaint routed successfully',
        complaint: mapComplaint(updated)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getDashboardStats: async (req, res) => {
    try {
      const statsRow = await queryOne(
        `
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) AS verified,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS inProgress,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
          FROM complaints
        `
      );

      const recentRows = await query(
        `${complaintSelect} ORDER BY c.created_at DESC LIMIT 5`
      );

      res.json({
        stats: {
          total: statsRow?.total || 0,
          pending: statsRow?.pending || 0,
          verified: statsRow?.verified || 0,
          inProgress: statsRow?.inProgress || 0,
          completed: statsRow?.completed || 0,
          rejected: statsRow?.rejected || 0
        },
        recentComplaints: recentRows.map(mapComplaintRow)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = adminController;
