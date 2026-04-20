const { query, queryOne, run, withTransaction } = require('../utils/sql');
const { createAlert } = require('../utils/alerts');
const {
  mapComplaint,
  mapTender,
  mapBid,
  mapProject,
  mapProgress,
  mapContractor,
  mapDepartment,
  mapMinistry,
  mapSimpleUser
} = require('../utils/serializers');

const logAlert = async (payload) => {
  try {
    await createAlert(payload);
  } catch (error) {
    console.error('Failed to create alert:', error.message);
  }
};

const contractorController = {
  getAvailableTenders: async (req, res) => {
    try {
      const rows = await query(
        `
          SELECT
            t.*,
            m.id AS ministry_ref_id,
            m.name AS ministry_ref_name,
            m.code AS ministry_ref_code,
            d.id AS department_ref_id,
            d.name AS department_ref_name,
            d.code AS department_ref_code,
            d.responsibilities AS department_ref_responsibilities,
            d.ministry_id AS department_ref_ministry_id,
            NULL AS department_ref_is_active,
            d.created_at AS department_ref_created_at,
            d.updated_at AS department_ref_updated_at,
            c.id AS complaint_ref_id,
            c.issue_title AS complaint_ref_title,
            c.category AS complaint_ref_category,
            loc.address AS location_address,
            loc.pincode AS location_pin_code,
            loc.region_id AS location_region_id,
            loc.ward_no AS location_ward_no
          FROM tenders t
          LEFT JOIN ministries m ON m.id = t.ministry_id
          LEFT JOIN departments d ON d.id = t.department_id
          LEFT JOIN complaints c ON c.id = t.complaint_id
          LEFT JOIN locations loc ON loc.id = t.location_id
          WHERE t.status = 'published'
            AND (t.tender_end_date IS NULL OR t.tender_end_date > CURDATE())
          ORDER BY COALESCE(t.submitted_at, t.created_at) DESC
        `
      );

      const tenders = rows.map(row =>
        mapTender(row, {
          ministry: mapMinistry(row, 'ministry_ref_'),
          department: mapDepartment(row, 'department_ref_'),
          complaint: row.complaint_ref_id
            ? {
                _id: row.complaint_ref_id,
                id: row.complaint_ref_id,
                title: row.complaint_ref_title,
                category: row.complaint_ref_category
              }
            : null
        })
      );

      res.json({ tenders });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  submitBid: async (req, res) => {
    try {
      const { tenderId } = req.params;
      const { amount, proposedStartDate, proposedEndDate, durationDays, proposal } = req.body;

      const tender = await queryOne('SELECT * FROM tenders WHERE id = ? LIMIT 1', [tenderId]);

      if (!tender || tender.status !== 'published') {
        return res.status(404).json({ message: 'Tender not available for bidding' });
      }

      const biddingDeadline = tender.bidding_deadline || tender.tender_end_date;

      if (biddingDeadline && new Date() > new Date(biddingDeadline)) {
        return res.status(400).json({ message: 'Bidding deadline has passed' });
      }

      if (!req.user.contractorProfile) {
        return res.status(403).json({ message: 'Only contractors can submit bids' });
      }

      const normalizedAmount = Number(amount);
      const normalizedDuration = durationDays == null || durationDays === ''
        ? null
        : Number.parseInt(durationDays, 10);

      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        return res.status(400).json({ message: 'Bid amount must be a positive number' });
      }

      if (normalizedDuration != null && (!Number.isInteger(normalizedDuration) || normalizedDuration <= 0)) {
        return res.status(400).json({ message: 'Timeline days must be a positive whole number' });
      }

      if (proposedStartDate && proposedEndDate && new Date(proposedStartDate) > new Date(proposedEndDate)) {
        return res.status(400).json({ message: 'Proposed start date must be before the end date' });
      }

      const existingBid = await queryOne(
        `
          SELECT id
          FROM bids
          WHERE tender_id = ? AND contractor_id = ?
          LIMIT 1
        `,
        [tenderId, req.user.contractorProfile]
      );

      if (existingBid) {
        return res.status(400).json({ message: 'You have already bid on this tender' });
      }

      const result = await run(
        `
          INSERT INTO bids (
            tender_id,
            contractor_id,
            amount,
            proposed_start_date,
            proposed_end_date,
            duration_days,
            proposal,
            documents
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          tenderId,
          req.user.contractorProfile,
          normalizedAmount,
          proposedStartDate || null,
          proposedEndDate || null,
          normalizedDuration,
          proposal || null,
          JSON.stringify(req.files ? req.files.map(file => ({ name: file.originalname, url: `/uploads/${file.filename}` })) : [])
        ]
      );

      const bid = await queryOne('SELECT * FROM bids WHERE id = ? LIMIT 1', [result.insertId]);

      res.status(201).json({
        message: 'Bid submitted successfully',
        bid: mapBid(bid)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getMyBids: async (req, res) => {
    try {
      const rows = await query(
        `
          SELECT
            b.*,
            t.id AS tender_ref_id,
            t.id AS tender_ref_tender_id,
            t.name AS tender_ref_title,
            m.id AS tender_ministry_id,
            m.name AS tender_ministry_name,
            m.code AS tender_ministry_code,
            c.id AS complaint_ref_id,
            c.issue_title AS complaint_ref_title,
            c.category AS complaint_ref_category
          FROM bids b
          LEFT JOIN tenders t ON t.id = b.tender_id
          LEFT JOIN ministries m ON m.id = t.ministry_id
          LEFT JOIN complaints c ON c.id = t.complaint_id
          WHERE b.contractor_id = ?
          ORDER BY b.submitted_at DESC
        `,
        [req.user.contractorProfile]
      );

      const bids = rows.map(row =>
        mapBid(row, {
          tender: row.tender_ref_id
            ? {
                _id: row.tender_ref_id,
                id: row.tender_ref_id,
                tenderId: row.tender_ref_tender_id,
                title: row.tender_ref_title,
                ministry: row.tender_ministry_id
                  ? {
                      _id: row.tender_ministry_id,
                      id: row.tender_ministry_id,
                      name: row.tender_ministry_name,
                      code: row.tender_ministry_code
                    }
                  : null,
                complaint: row.complaint_ref_id
                  ? {
                      _id: row.complaint_ref_id,
                      id: row.complaint_ref_id,
                      title: row.complaint_ref_title,
                      category: row.complaint_ref_category
                    }
                  : null
              }
            : null
        })
      );

      res.json({ bids });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getBid: async (req, res) => {
    try {
      const row = await queryOne(
        `
          SELECT
            b.*,
            t.id AS tender_ref_id,
            t.id AS tender_ref_tender_id,
            t.name AS tender_ref_title
          FROM bids b
          LEFT JOIN tenders t ON t.id = b.tender_id
          WHERE b.id = ? AND b.contractor_id = ?
          LIMIT 1
        `,
        [req.params.id, req.user.contractorProfile]
      );

      if (!row) {
        return res.status(404).json({ message: 'Bid not found' });
      }

      res.json({
        bid: mapBid(row, {
          tender: row.tender_ref_id
            ? {
                _id: row.tender_ref_id,
                id: row.tender_ref_id,
                tenderId: row.tender_ref_tender_id,
                title: row.tender_ref_title
              }
            : null
        })
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getMyProjects: async (req, res) => {
    try {
      const rows = await query(
        `
          SELECT
            p.*,
            t.id AS tender_ref_id,
            t.id AS tender_ref_tender_id,
            t.name AS tender_ref_title,
            c.id AS complaint_ref_id,
            c.issue_title AS complaint_ref_title,
            loc.address AS complaint_ref_address,
            NULL AS regional_manager_user_id,
            NULL AS regional_manager_user_name,
            NULL AS regional_manager_user_email,
            NULL AS regional_manager_user_role,
            NULL AS regional_manager_user_phone,
            NULL AS regional_manager_user_address,
            NULL AS regional_manager_user_is_active,
            NULL AS regional_manager_user_is_email_verified,
            NULL AS regional_manager_user_created_at,
            NULL AS regional_manager_user_updated_at
          FROM projects p
          LEFT JOIN tenders t ON t.id = p.tender_id
          LEFT JOIN complaints c ON c.id = p.complaint_id
          LEFT JOIN locations loc ON loc.id = c.location_id
          WHERE p.contractor_id = ?
          ORDER BY p.created_at DESC
        `,
        [req.user.contractorProfile]
      );

      const projects = rows.map(row =>
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
                address: row.complaint_ref_address
              }
            : null,
          regionalManager: mapSimpleUser(row, 'regional_manager_user_')
        })
      );

      res.json({ projects });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getAssignedComplaints: async (req, res) => {
    try {
      const rows = await query(
        `
          SELECT
            c.id AS complaint_id,
            c.citizen_id,
            c.location_id,
            c.ministry_id,
            c.department_id,
            c.project_id,
            c.issue_title,
            c.issue_description,
            c.category,
            c.images,
            c.status,
            c.official_viewed_at,
            c.contractor_notified_at,
            c.work_completed_at,
            c.created_at,
            c.updated_at,
            loc.address,
            loc.pincode AS pin_code,
            loc.ward_no,
            p.id AS project_ref_id,
            p.name AS project_ref_name,
            p.status AS project_ref_status
          FROM complaints c
          INNER JOIN projects p ON p.id = c.project_id
          LEFT JOIN locations loc ON loc.id = c.location_id
          WHERE p.contractor_id = ?
          ORDER BY c.created_at DESC
        `,
        [req.user.contractorProfile]
      );

      res.json({
        complaints: rows.map((row) =>
          mapComplaint(row, {
            project: row.project_ref_id
              ? {
                  _id: row.project_ref_id,
                  id: row.project_ref_id,
                  title: row.project_ref_name,
                  status: row.project_ref_status
                }
              : null
          })
        )
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  updateProgress: async (req, res) => {
    try {
      const { projectId } = req.params;
      const { title, description, percentageComplete, updateType } = req.body;

      const project = await queryOne(
        'SELECT * FROM projects WHERE id = ? AND contractor_id = ? LIMIT 1',
        [projectId, req.user.contractorProfile]
      );

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      if (['pending_admin_verification', 'completed'].includes(String(project.status || '').toLowerCase())) {
        return res.status(400).json({ message: 'This project is waiting for admin action and cannot receive more progress updates right now' });
      }

      const parsedPercentage = Number(percentageComplete ?? 0);
      const safePercentage = Number.isFinite(parsedPercentage)
        ? Math.max(0, Math.min(parsedPercentage, 99))
        : 0;

      const progressId = await withTransaction(async (tx) => {
        const progressResult = await tx.run(
          `
            INSERT INTO progress_updates (
              project_id,
              percentage_complete,
              description,
              images,
              submitted_by
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          [
            projectId,
            percentageComplete || null,
            [title || updateType || 'Progress Update', description].filter(Boolean).join(': '),
            JSON.stringify(req.files ? req.files.map(file => ({ url: `/uploads/${file.filename}` })) : []),
            req.user.id
          ]
        );

        await tx.run(
          `
            UPDATE projects
            SET
              progress_percentage = ?,
              progress_last_updated = NOW(),
              progress_last_updated_by = ?,
              status = CASE
                WHEN status = 'assigned' THEN 'in_progress'
                ELSE status
              END,
              start_date = CASE WHEN status = 'assigned' AND start_date IS NULL THEN CURDATE() ELSE start_date END,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [safePercentage, req.user.id, projectId]
        );

        return progressResult.insertId;
      });

      const progress = await queryOne(
        `
          SELECT
            pu.*,
            ? AS title,
            ? AS update_type
          FROM progress_updates pu
          WHERE pu.id = ?
          LIMIT 1
        `,
        [title || 'Progress Update', updateType || 'progress', progressId]
      );

      await logAlert({
        sourceType: 'progress',
        sourceId: progressId,
        alertLevel: 'warning',
        message: `Project ${projectId} progress was updated to ${safePercentage}%.`
      });

      res.status(201).json({
        message: 'Progress updated successfully',
        progress: mapProgress(progress)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  markComplete: async (req, res) => {
    try {
      const { projectId } = req.params;
      const { completionNotes } = req.body;

      const project = await queryOne(
        'SELECT * FROM projects WHERE id = ? AND contractor_id = ? LIMIT 1',
        [projectId, req.user.contractorProfile]
      );

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      if (String(project.status || '').toLowerCase() === 'pending_admin_verification') {
        return res.status(400).json({ message: 'Completion has already been submitted for admin verification' });
      }

      if (String(project.status || '').toLowerCase() === 'completed') {
        return res.status(400).json({ message: 'Project is already completed' });
      }

      await withTransaction(async (tx) => {
        await tx.run(
          `
            UPDATE projects
            SET
              status = 'pending_admin_verification',
              progress_percentage = 100,
              progress_last_updated = NOW(),
              progress_last_updated_by = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [req.user.id, projectId]
        );

        await tx.run(
          `
            INSERT INTO progress_updates (
              project_id,
              percentage_complete,
              description,
              images,
              submitted_by
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          [
            projectId,
            100,
            `Project Completed: ${completionNotes || 'Project has been completed'}`,
            JSON.stringify(req.files ? req.files.map(file => ({ url: `/uploads/${file.filename}` })) : []),
            req.user.id
          ]
        );

        await tx.run(
          `
            UPDATE complaints
            SET
              status = 'pending_admin_verification',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [project.complaint_id]
        );
      });

      await logAlert({
        sourceType: 'project',
        sourceId: projectId,
        alertLevel: 'warning',
        message: `Project ${projectId} completion was submitted by the contractor and is waiting for admin verification.`
      });

      const updatedProject = await queryOne('SELECT * FROM projects WHERE id = ? LIMIT 1', [projectId]);

      res.json({
        message: 'Completion submitted for admin verification',
        project: mapProject(updatedProject)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = contractorController;
