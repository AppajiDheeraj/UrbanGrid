const { query, queryOne, run, withTransaction } = require('../utils/sql');
const {
  mapTender,
  mapBid,
  mapProject,
  mapProgress,
  mapContractor,
  mapDepartment,
  mapMinistry,
  mapSimpleUser
} = require('../utils/serializers');

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
            d.is_active AS department_ref_is_active,
            d.created_at AS department_ref_created_at,
            d.updated_at AS department_ref_updated_at,
            c.id AS complaint_ref_id,
            c.title AS complaint_ref_title,
            c.category AS complaint_ref_category
          FROM tenders t
          LEFT JOIN ministries m ON m.id = t.ministry_id
          LEFT JOIN departments d ON d.id = t.department_id
          LEFT JOIN complaints c ON c.id = t.complaint_id
          WHERE t.status = 'published'
            AND (t.bidding_deadline IS NULL OR t.bidding_deadline > NOW())
          ORDER BY t.published_at DESC
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

      if (tender.bidding_deadline && new Date() > new Date(tender.bidding_deadline)) {
        return res.status(400).json({ message: 'Bidding deadline has passed' });
      }

      if (!req.user.contractorProfile) {
        return res.status(403).json({ message: 'Only contractors can submit bids' });
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
          amount,
          proposedStartDate || null,
          proposedEndDate || null,
          durationDays || null,
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
            t.tender_id AS tender_ref_tender_id,
            t.title AS tender_ref_title,
            m.id AS tender_ministry_id,
            m.name AS tender_ministry_name,
            m.code AS tender_ministry_code,
            c.id AS complaint_ref_id,
            c.title AS complaint_ref_title,
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
            t.tender_id AS tender_ref_tender_id,
            t.title AS tender_ref_title
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
            t.tender_id AS tender_ref_tender_id,
            t.title AS tender_ref_title,
            c.id AS complaint_ref_id,
            c.title AS complaint_ref_title,
            c.address AS complaint_ref_address,
            rm.id AS regional_manager_user_id,
            rm.name AS regional_manager_user_name,
            rm.email AS regional_manager_user_email,
            rm.role AS regional_manager_user_role,
            rm.phone AS regional_manager_user_phone,
            rm.address AS regional_manager_user_address,
            rm.is_active AS regional_manager_user_is_active,
            rm.is_email_verified AS regional_manager_user_is_email_verified,
            rm.created_at AS regional_manager_user_created_at,
            rm.updated_at AS regional_manager_user_updated_at
          FROM projects p
          LEFT JOIN tenders t ON t.id = p.tender_id
          LEFT JOIN complaints c ON c.id = p.complaint_id
          LEFT JOIN users rm ON rm.id = p.regional_manager_id
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

      const progressId = await withTransaction(async (tx) => {
        const progressResult = await tx.run(
          `
            INSERT INTO progress_updates (
              project_id,
              update_type,
              title,
              description,
              percentage_complete,
              images,
              submitted_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            projectId,
            updateType || 'weekly',
            title,
            description,
            percentageComplete || null,
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
              status = CASE WHEN status = 'not_started' THEN 'in_progress' ELSE status END,
              start_date = CASE WHEN status = 'not_started' AND start_date IS NULL THEN CURDATE() ELSE start_date END,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [percentageComplete || 0, req.user.id, projectId]
        );

        return progressResult.insertId;
      });

      const progress = await queryOne('SELECT * FROM progress_updates WHERE id = ? LIMIT 1', [progressId]);

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

      await withTransaction(async (tx) => {
        await tx.run(
          `
            UPDATE projects
            SET
              status = 'completed',
              actual_end_date = CURDATE(),
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
              update_type,
              title,
              description,
              percentage_complete,
              images,
              submitted_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            projectId,
            'completion',
            'Project Completed',
            completionNotes || 'Project has been completed',
            100,
            JSON.stringify(req.files ? req.files.map(file => ({ url: `/uploads/${file.filename}` })) : []),
            req.user.id
          ]
        );

        await tx.run(
          `
            UPDATE complaints
            SET status = 'completed', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [project.complaint_id]
        );
      });

      const updatedProject = await queryOne('SELECT * FROM projects WHERE id = ? LIMIT 1', [projectId]);

      res.json({
        message: 'Project marked as completed',
        project: mapProject(updatedProject)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = contractorController;
