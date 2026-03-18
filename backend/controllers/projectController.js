const generateId = require('../utils/generateId');
const { query, queryOne, run, withTransaction } = require('../utils/sql');
const {
  mapProject,
  mapProgress,
  mapVerification,
  mapContractor,
  mapSimpleUser
} = require('../utils/serializers');

const getRegionalManager = async (regionId) => {
  if (!regionId) {
    return null;
  }

  return queryOne(
    `
      SELECT id
      FROM users
      WHERE region_id = ? AND role = 'regional_manager'
      ORDER BY id ASC
      LIMIT 1
    `,
    [regionId]
  );
};

const projectsSelect = `
  SELECT
    p.*,
    t.id AS tender_ref_id,
    t.tender_id AS tender_ref_tender_id,
    t.title AS tender_ref_title,
    c.id AS complaint_ref_id,
    c.title AS complaint_ref_title,
    c.category AS complaint_ref_category,
    c.address AS complaint_ref_address,
    contractor.id AS contractor_ref_id,
    contractor.user_id AS contractor_ref_user_id,
    contractor.company_name AS contractor_ref_company_name,
    contractor.registration_number AS contractor_ref_registration_number,
    contractor.gst_number AS contractor_ref_gst_number,
    contractor.address AS contractor_ref_address,
    contractor.phone AS contractor_ref_phone,
    contractor.specializations AS contractor_ref_specializations,
    contractor.past_projects AS contractor_ref_past_projects,
    contractor.rating AS contractor_ref_rating,
    contractor.documents AS contractor_ref_documents,
    contractor.is_verified AS contractor_ref_is_verified,
    contractor.is_active AS contractor_ref_is_active,
    contractor.created_at AS contractor_ref_created_at,
    contractor.updated_at AS contractor_ref_updated_at,
    rm.id AS regional_manager_user_id,
    rm.name AS regional_manager_user_name,
    rm.email AS regional_manager_user_email,
    rm.role AS regional_manager_user_role,
    rm.phone AS regional_manager_user_phone,
    rm.address AS regional_manager_user_address,
    rm.is_active AS regional_manager_user_is_active,
    rm.is_email_verified AS regional_manager_user_is_email_verified,
    rm.created_at AS regional_manager_user_created_at,
    rm.updated_at AS regional_manager_user_updated_at,
    au.id AS assigned_by_user_id,
    au.name AS assigned_by_user_name,
    au.email AS assigned_by_user_email,
    au.role AS assigned_by_user_role,
    au.phone AS assigned_by_user_phone,
    au.address AS assigned_by_user_address,
    au.is_active AS assigned_by_user_is_active,
    au.is_email_verified AS assigned_by_user_is_email_verified,
    au.created_at AS assigned_by_user_created_at,
    au.updated_at AS assigned_by_user_updated_at
  FROM projects p
  LEFT JOIN tenders t ON t.id = p.tender_id
  LEFT JOIN complaints c ON c.id = p.complaint_id
  LEFT JOIN contractors contractor ON contractor.id = p.contractor_id
  LEFT JOIN users rm ON rm.id = p.regional_manager_id
  LEFT JOIN users au ON au.id = p.assigned_by
`;

const mapProjectRow = (row) =>
  mapProject(row, {
    tender: row.tender_ref_id
      ? {
          _id: row.tender_ref_id,
          id: row.tender_ref_id,
          tenderId: row.tender_ref_tender_id,
          title: row.tender_ref_title
        }
      : null,
    complaint: row.complaint_ref_id
      ? {
          _id: row.complaint_ref_id,
          id: row.complaint_ref_id,
          title: row.complaint_ref_title,
          category: row.complaint_ref_category,
          address: row.complaint_ref_address
        }
      : null,
    contractor: mapContractor(row, 'contractor_ref_'),
    regionalManager: mapSimpleUser(row, 'regional_manager_user_'),
    assignedBy: mapSimpleUser(row, 'assigned_by_user_')
  });

const projectController = {
  getProjects: async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
      const offset = (page - 1) * limit;
      const filters = [];
      const params = [];

      if (req.query.status) {
        filters.push('p.status = ?');
        params.push(req.query.status);
      }

      const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      const rows = await query(
        `${projectsSelect} ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      const countRow = await queryOne(
        `SELECT COUNT(*) AS total FROM projects p ${whereClause}`,
        params
      );

      res.json({
        projects: rows.map(mapProjectRow),
        totalPages: Math.ceil((countRow?.total || 0) / limit),
        currentPage: page,
        total: countRow?.total || 0
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getProject: async (req, res) => {
    try {
      const row = await queryOne(`${projectsSelect} WHERE p.id = ? LIMIT 1`, [req.params.id]);

      if (!row) {
        return res.status(404).json({ message: 'Project not found' });
      }

      res.json({ project: mapProjectRow(row) });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  assignContractor: async (req, res) => {
    try {
      const { tenderId, bidId } = req.params;

      const tender = await queryOne('SELECT * FROM tenders WHERE id = ? LIMIT 1', [tenderId]);

      if (!tender) {
        return res.status(404).json({ message: 'Tender not found' });
      }

      const bid = await queryOne('SELECT * FROM bids WHERE id = ? LIMIT 1', [bidId]);

      if (!bid || String(bid.tender_id) !== String(tenderId)) {
        return res.status(404).json({ message: 'Bid not found' });
      }

      const complaint = await queryOne('SELECT * FROM complaints WHERE id = ? LIMIT 1', [tender.complaint_id]);
      const regionalManager = await getRegionalManager(complaint?.region_id);

      const projectId = await withTransaction(async (tx) => {
        const projectResult = await tx.run(
          `
            INSERT INTO projects (
              project_id,
              tender_id,
              complaint_id,
              contractor_id,
              title,
              description,
              allocated_budget,
              start_date,
              proposed_end_date,
              assigned_by,
              assigned_at,
              regional_manager_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
          `,
          [
            generateId('PRJ'),
            tenderId,
            tender.complaint_id,
            bid.contractor_id,
            tender.title,
            tender.description,
            bid.amount,
            bid.proposed_start_date || null,
            bid.proposed_end_date || null,
            req.user.id,
            regionalManager?.id || null
          ]
        );

        await tx.run(
          'UPDATE tenders SET winning_bid_id = ?, status = ? WHERE id = ?',
          [bidId, 'assigned', tenderId]
        );
        await tx.run('UPDATE bids SET status = ? WHERE id = ?', ['accepted', bidId]);
        await tx.run('UPDATE bids SET status = ? WHERE tender_id = ? AND id <> ?', ['rejected', tenderId, bidId]);
        await tx.run(
          'UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['in_progress', tender.complaint_id]
        );

        return projectResult.insertId;
      });

      const projectRow = await queryOne(`${projectsSelect} WHERE p.id = ? LIMIT 1`, [projectId]);

      res.status(201).json({
        message: 'Project assigned successfully',
        project: mapProjectRow(projectRow)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getProgressHistory: async (req, res) => {
    try {
      const rows = await query(
        `
          SELECT
            pu.*,
            submitted.id AS submitted_by_user_id,
            submitted.name AS submitted_by_user_name,
            submitted.email AS submitted_by_user_email,
            submitted.role AS submitted_by_user_role,
            submitted.phone AS submitted_by_user_phone,
            submitted.address AS submitted_by_user_address,
            submitted.is_active AS submitted_by_user_is_active,
            submitted.is_email_verified AS submitted_by_user_is_email_verified,
            submitted.created_at AS submitted_by_user_created_at,
            submitted.updated_at AS submitted_by_user_updated_at,
            reviewed.id AS reviewed_by_user_id,
            reviewed.name AS reviewed_by_user_name,
            reviewed.email AS reviewed_by_user_email,
            reviewed.role AS reviewed_by_user_role,
            reviewed.phone AS reviewed_by_user_phone,
            reviewed.address AS reviewed_by_user_address,
            reviewed.is_active AS reviewed_by_user_is_active,
            reviewed.is_email_verified AS reviewed_by_user_is_email_verified,
            reviewed.created_at AS reviewed_by_user_created_at,
            reviewed.updated_at AS reviewed_by_user_updated_at
          FROM progress_updates pu
          LEFT JOIN users submitted ON submitted.id = pu.submitted_by
          LEFT JOIN users reviewed ON reviewed.id = pu.reviewed_by
          WHERE pu.project_id = ?
          ORDER BY pu.submitted_at DESC
        `,
        [req.params.id]
      );

      res.json({
        progress: rows.map(row =>
          mapProgress(row, {
            submittedBy: mapSimpleUser(row, 'submitted_by_user_'),
            reviewedBy: mapSimpleUser(row, 'reviewed_by_user_')
          })
        )
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  verifyCompletion: async (req, res) => {
    try {
      const { id } = req.params;
      const { findings, issues, rating, recommendation } = req.body;

      const project = await queryOne('SELECT * FROM projects WHERE id = ? LIMIT 1', [id]);

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      const verificationId = await withTransaction(async (tx) => {
        const verificationResult = await tx.run(
          `
            INSERT INTO verifications (
              project_id,
              complaint_id,
              verification_type,
              status,
              verified_by,
              verified_at,
              findings,
              issues,
              images,
              rating,
              recommendation
            )
            VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
          `,
          [
            id,
            project.complaint_id,
            'final',
            recommendation === 'approve'
              ? 'verified'
              : recommendation === 'needs_rework'
                ? 'in_progress'
                : 'rejected',
            req.user.id,
            findings || null,
            JSON.stringify(Array.isArray(issues) ? issues : issues ? [issues] : []),
            JSON.stringify(req.files ? req.files.map(file => ({ url: `/uploads/${file.filename}` })) : []),
            rating || null,
            recommendation || null
          ]
        );

        if (recommendation === 'approve') {
          await tx.run('UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['verified', id]);
          await tx.run(
            'UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['closed', project.complaint_id]
          );
        } else if (recommendation === 'needs_rework') {
          await tx.run('UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['in_progress', id]);
        }

        return verificationResult.insertId;
      });

      const verification = await queryOne('SELECT * FROM verifications WHERE id = ? LIMIT 1', [verificationId]);

      res.json({
        message: 'Verification completed',
        verification: mapVerification(verification)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = projectController;
