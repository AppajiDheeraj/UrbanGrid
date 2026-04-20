const { query, queryOne, run, withTransaction } = require('../utils/sql');
const { createAlert } = require('../utils/alerts');
const {
  mapProject,
  mapProgress,
  mapVerification,
  mapContractor,
  mapSimpleUser
} = require('../utils/serializers');

const logAlert = async (payload) => {
  try {
    await createAlert(payload);
  } catch (error) {
    console.error('Failed to create alert:', error.message);
  }
};

const normalizeMilestones = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
};

const projectsSelect = `
  SELECT
    p.*,
    t.id AS tender_ref_id,
    t.id AS tender_ref_tender_id,
    t.name AS tender_ref_title,
    c.id AS complaint_ref_id,
    c.issue_title AS complaint_ref_title,
    c.category AS complaint_ref_category,
    loc.address AS complaint_ref_address,
    contractor.id AS contractor_ref_id,
    contractor.id AS contractor_ref_user_id,
    contractor.company_name AS contractor_ref_company_name,
    contractor.registration_number AS contractor_ref_registration_number,
    NULL AS contractor_ref_gst_number,
    contractor.address AS contractor_ref_address,
    contractor.phone AS contractor_ref_phone,
    NULL AS contractor_ref_specializations,
    contractor.total_projects AS contractor_ref_past_projects,
    contractor.contractor_rating AS contractor_ref_rating,
    NULL AS contractor_ref_documents,
    NULL AS contractor_ref_is_verified,
    NULL AS contractor_ref_is_active,
    contractor.created_at AS contractor_ref_created_at,
    contractor.updated_at AS contractor_ref_updated_at,
    rm.id AS regional_manager_user_id,
    rm.name AS regional_manager_user_name,
    rm.email AS regional_manager_user_email,
    rm.role AS regional_manager_user_role,
    rm.phone AS regional_manager_user_phone,
    rm.address AS regional_manager_user_address,
    NULL AS regional_manager_user_is_active,
    NULL AS regional_manager_user_is_email_verified,
    rm.created_at AS regional_manager_user_created_at,
    rm.updated_at AS regional_manager_user_updated_at,
    au.id AS assigned_by_user_id,
    au.name AS assigned_by_user_name,
    au.email AS assigned_by_user_email,
    au.role AS assigned_by_user_role,
    au.phone AS assigned_by_user_phone,
    au.address AS assigned_by_user_address,
    NULL AS assigned_by_user_is_active,
    NULL AS assigned_by_user_is_email_verified,
    au.created_at AS assigned_by_user_created_at,
    au.updated_at AS assigned_by_user_updated_at
  FROM projects p
  LEFT JOIN tenders t ON t.id = p.tender_id
  LEFT JOIN complaints c ON c.id = p.complaint_id
  LEFT JOIN locations loc ON loc.id = c.location_id
  LEFT JOIN users contractor ON contractor.id = p.contractor_id
  LEFT JOIN users rm ON rm.region_id = p.region_id AND rm.role = 'regional_manager'
  LEFT JOIN users au ON au.id = p.created_by
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
      const safeLimit = Number(limit);
      const safeOffset = Number(offset);
      const rows = await query(
        `${projectsSelect} ${whereClause} ORDER BY p.created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        params
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
      const { milestones } = req.body;

      const tender = await queryOne('SELECT * FROM tenders WHERE id = ? LIMIT 1', [tenderId]);

      if (!tender) {
        return res.status(404).json({ message: 'Tender not found' });
      }

      const bid = await queryOne('SELECT * FROM bids WHERE id = ? LIMIT 1', [bidId]);

      if (!bid || String(bid.tender_id) !== String(tenderId)) {
        return res.status(404).json({ message: 'Bid not found' });
      }

      const complaint = tender.complaint_id
        ? await queryOne(
            `
              SELECT c.*, loc.region_id
              FROM complaints c
              LEFT JOIN locations loc ON loc.id = c.location_id
              WHERE c.id = ?
              LIMIT 1
            `,
            [tender.complaint_id]
          )
        : null;

      const projectId = await withTransaction(async (tx) => {
        const existingProject = await tx.queryOne(
          'SELECT id FROM projects WHERE tender_id = ? LIMIT 1',
          [tenderId]
        );

        if (existingProject) {
          return existingProject.id;
        }

        const projectResult = await tx.run(
          `
            INSERT INTO projects (
              tender_id,
              bid_id,
              complaint_id,
              ministry_id,
              region_id,
              location_id,
              contractor_id,
              name,
              description,
              category,
              estimated_budget,
              start_date,
              expected_end_date,
              status,
              milestones,
              created_by
          )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            tenderId,
            bidId,
            tender.complaint_id,
            tender.ministry_id,
            complaint?.region_id || req.user.region || null,
            tender.location_id || complaint?.location_id || null,
            bid.contractor_id,
            tender.name,
            tender.description,
            tender.category || complaint?.category || null,
            bid.amount,
            bid.proposed_start_date || null,
            bid.proposed_end_date || null,
            'assigned',
            JSON.stringify(normalizeMilestones(milestones)),
            req.user.id
          ]
        );

        await tx.run(
          'UPDATE tenders SET winning_bid_id = ?, status = ? WHERE id = ?',
          [bidId, 'bidding_closed', tenderId]
        );
        await tx.run(
          'UPDATE bids SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
          ['selected', req.user.id, bidId]
        );
        await tx.run(
          'UPDATE bids SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE tender_id = ? AND id <> ?',
          ['rejected', req.user.id, tenderId, bidId]
        );
        await tx.run(
          'UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['in_progress', tender.complaint_id]
        );
        await tx.run(
          `
            UPDATE complaints
            SET contractor_notified_at = COALESCE(contractor_notified_at, NOW()),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [tender.complaint_id]
        );

        return projectResult.insertId;
      });

      await logAlert({
        sourceType: 'project',
        sourceId: projectId,
        alertLevel: 'warning',
        message: `Project ${projectId} has been assigned to a contractor.`
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
            NULL AS submitted_by_user_is_active,
            NULL AS submitted_by_user_is_email_verified,
            submitted.created_at AS submitted_by_user_created_at,
            submitted.updated_at AS submitted_by_user_updated_at,
            reviewed.id AS reviewed_by_user_id,
            reviewed.name AS reviewed_by_user_name,
            reviewed.email AS reviewed_by_user_email,
            reviewed.role AS reviewed_by_user_role,
            reviewed.phone AS reviewed_by_user_phone,
            reviewed.address AS reviewed_by_user_address,
            NULL AS reviewed_by_user_is_active,
            NULL AS reviewed_by_user_is_email_verified,
            reviewed.created_at AS reviewed_by_user_created_at,
            reviewed.updated_at AS reviewed_by_user_updated_at
          FROM progress_updates pu
          LEFT JOIN users submitted ON submitted.id = pu.submitted_by
          LEFT JOIN users reviewed ON 1 = 0
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

      if (!['approve', 'needs_rework'].includes(recommendation)) {
        return res.status(400).json({ message: 'A valid verification recommendation is required' });
      }

      if (String(project.status || '').toLowerCase() !== 'pending_admin_verification') {
        return res.status(400).json({ message: 'Only projects submitted for admin verification can be reviewed' });
      }

      const verificationId = await withTransaction(async (tx) => {
        const verificationResult = await tx.run(
          `
            INSERT INTO verifications (
              entity_type,
              entity_id,
              verification_type,
              status,
              verified_by,
              verified_at,
              findings,
              remarks
            )
            VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)
          `,
          [
            'project',
            id,
            'final',
            recommendation === 'approve'
              ? 'approved'
              : recommendation === 'needs_rework'
                ? 'rejected'
                : 'rejected',
            req.user.id,
            findings || null,
            JSON.stringify({
              issues: Array.isArray(issues) ? issues : issues ? [issues] : [],
              images: req.files ? req.files.map(file => ({ url: `/uploads/${file.filename}` })) : [],
              rating: rating || null,
              recommendation: recommendation || null
            })
          ]
        );

        if (recommendation === 'approve') {
          await tx.run(
            'UPDATE projects SET status = ?, actual_end_date = COALESCE(actual_end_date, CURDATE()), progress_percentage = 100, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['completed', id]
          );
          await tx.run(
            `
              UPDATE complaints
              SET
                status = ?,
                work_completed_at = COALESCE(work_completed_at, NOW()),
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            ['resolved', project.complaint_id]
          );
          await tx.run(
            `
              UPDATE users
              SET
                total_projects = CASE WHEN total_projects < 1 THEN 1 ELSE total_projects END,
                completed_projects = completed_projects + 1,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [project.contractor_id]
          );
        } else if (recommendation === 'needs_rework') {
          await tx.run(
            'UPDATE projects SET status = ?, actual_end_date = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['in_progress', id]
          );
          if (project.complaint_id) {
            await tx.run(
              `
                UPDATE complaints
                SET
                  status = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `,
              ['in_progress', project.complaint_id]
            );
          }
        }

        return verificationResult.insertId;
      });

      const verification = await queryOne(
        `
          SELECT
            v.*,
            ? AS project_id,
            ? AS complaint_id
          FROM verifications v
          WHERE v.id = ?
          LIMIT 1
        `,
        [id, project.complaint_id, verificationId]
      );

      await logAlert({
        sourceType: 'project',
        sourceId: id,
        alertLevel: recommendation === 'approve' ? 'warning' : 'critical',
        message: `Project ${id} completion was ${recommendation || 'reviewed'}.`
      });

      res.json({
        message: 'Verification completed',
        verification: mapVerification(verification)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getMilestones: async (req, res) => {
    try {
      const project = await queryOne('SELECT id, milestones FROM projects WHERE id = ? LIMIT 1', [req.params.id]);

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      res.json({
        projectId: project.id,
        milestones: normalizeMilestones(project.milestones)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  updateMilestones: async (req, res) => {
    try {
      const { id } = req.params;
      const { milestones } = req.body;
      const normalizedMilestones = normalizeMilestones(milestones);

      if (!Array.isArray(milestones) && !(typeof milestones === 'string' && milestones.trim())) {
        return res.status(400).json({ message: 'Milestones must be an array' });
      }

      if (typeof milestones === 'string' && milestones.trim() && normalizedMilestones.length === 0) {
        return res.status(400).json({ message: 'Milestones must be valid JSON' });
      }

      const project = await queryOne('SELECT id FROM projects WHERE id = ? LIMIT 1', [id]);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      await run(
        `
          UPDATE projects
          SET milestones = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [JSON.stringify(normalizedMilestones), id]
      );

      const updated = await queryOne('SELECT id, milestones FROM projects WHERE id = ? LIMIT 1', [id]);
      res.json({
        message: 'Milestones updated successfully',
        projectId: updated.id,
        milestones: normalizeMilestones(updated.milestones)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = projectController;
