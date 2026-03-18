const { query, queryOne, run, withTransaction } = require('../utils/sql');
const { mapTender, mapMinistry, mapSimpleUser } = require('../utils/serializers');

const approvalController = {
  submitForApproval: async (req, res) => {
    try {
      const { id } = req.params;

      const tender = await queryOne('SELECT * FROM tenders WHERE id = ? LIMIT 1', [id]);

      if (!tender) {
        return res.status(404).json({ message: 'Tender not found' });
      }

      let approvalLevel = 2;
      if (req.user.role === 'senior_official') {
        approvalLevel = 3;
      }

      const approverRole = approvalLevel === 2 ? 'department_head' : 'senior_official';
      const approver = await queryOne(
        `
          SELECT id
          FROM users
          WHERE ministry_id = ? AND role = ? AND is_active = 1
          ORDER BY id ASC
          LIMIT 1
        `,
        [tender.ministry_id, approverRole]
      );

      await withTransaction(async (tx) => {
        await tx.run('UPDATE tenders SET status = ? WHERE id = ?', ['pending_approval', id]);
        await tx.run(
          `
            INSERT INTO tender_approvals (tender_id, level, approver_id, status)
            VALUES (?, ?, ?, ?)
          `,
          [id, approvalLevel, approver?.id || null, 'pending']
        );
      });

      const updated = await queryOne('SELECT * FROM tenders WHERE id = ? LIMIT 1', [id]);

      res.json({
        message: 'Tender submitted for approval',
        tender: mapTender(updated)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getPendingApprovals: async (req, res) => {
    try {
      const rows = await query(
        `
          SELECT
            t.*,
            c.id AS complaint_ref_id,
            c.title AS complaint_ref_title,
            c.category AS complaint_ref_category,
            m.id AS ministry_ref_id,
            m.name AS ministry_ref_name,
            m.code AS ministry_ref_code,
            u.id AS created_by_user_id,
            u.name AS created_by_user_name,
            u.email AS created_by_user_email,
            u.role AS created_by_user_role
          FROM tender_approvals ta
          INNER JOIN tenders t ON t.id = ta.tender_id
          LEFT JOIN complaints c ON c.id = t.complaint_id
          LEFT JOIN ministries m ON m.id = t.ministry_id
          LEFT JOIN users u ON u.id = t.created_by
          WHERE ta.status = 'pending' AND ta.approver_id = ?
          ORDER BY t.created_at DESC
        `,
        [req.user.id]
      );

      const tenders = rows.map(row =>
        mapTender(row, {
          complaint: row.complaint_ref_id
            ? {
                _id: row.complaint_ref_id,
                id: row.complaint_ref_id,
                title: row.complaint_ref_title,
                category: row.complaint_ref_category
              }
            : null,
          ministry: mapMinistry(row, 'ministry_ref_'),
          createdBy: mapSimpleUser(row, 'created_by_user_')
        })
      );

      res.json({ tenders });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  approveTender: async (req, res) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;

      const approvalEntry = await queryOne(
        `
          SELECT *
          FROM tender_approvals
          WHERE tender_id = ? AND approver_id = ? AND status = 'pending'
          LIMIT 1
        `,
        [id, req.user.id]
      );

      if (!approvalEntry) {
        return res.status(403).json({ message: 'Not authorized to approve this tender' });
      }

      await withTransaction(async (tx) => {
        await tx.run(
          `
            UPDATE tender_approvals
            SET status = 'approved', comments = ?, action_at = NOW()
            WHERE id = ?
          `,
          [comments || null, approvalEntry.id]
        );

        const pendingRow = await tx.queryOne(
          'SELECT COUNT(*) AS total FROM tender_approvals WHERE tender_id = ? AND status = ?',
          [id, 'pending']
        );
        const rejectedRow = await tx.queryOne(
          'SELECT COUNT(*) AS total FROM tender_approvals WHERE tender_id = ? AND status = ?',
          [id, 'rejected']
        );

        if ((pendingRow?.total || 0) === 0 && (rejectedRow?.total || 0) === 0) {
          await tx.run('UPDATE tenders SET status = ? WHERE id = ?', ['approved', id]);
        }
      });

      const tender = await queryOne('SELECT * FROM tenders WHERE id = ? LIMIT 1', [id]);

      res.json({
        message: 'Tender approved',
        tender: mapTender(tender)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  rejectTender: async (req, res) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;

      const approvalEntry = await queryOne(
        `
          SELECT *
          FROM tender_approvals
          WHERE tender_id = ? AND approver_id = ? AND status = 'pending'
          LIMIT 1
        `,
        [id, req.user.id]
      );

      if (!approvalEntry) {
        return res.status(403).json({ message: 'Not authorized to reject this tender' });
      }

      await withTransaction(async (tx) => {
        await tx.run(
          `
            UPDATE tender_approvals
            SET status = 'rejected', comments = ?, action_at = NOW()
            WHERE id = ?
          `,
          [comments || null, approvalEntry.id]
        );

        await tx.run('UPDATE tenders SET status = ? WHERE id = ?', ['rejected', id]);
      });

      const tender = await queryOne('SELECT * FROM tenders WHERE id = ? LIMIT 1', [id]);

      res.json({
        message: 'Tender rejected',
        tender: mapTender(tender)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getApprovalHistory: async (req, res) => {
    try {
      const rows = await query(
        `
          SELECT
            t.*,
            ta.id AS approval_id,
            ta.level AS approval_level,
            ta.status AS approval_status,
            ta.comments AS approval_comments,
            ta.action_at AS approval_action_at,
            ta.created_at AS approval_created_at,
            c.id AS complaint_ref_id,
            c.title AS complaint_ref_title,
            m.id AS ministry_ref_id,
            m.name AS ministry_ref_name,
            m.code AS ministry_ref_code
          FROM tender_approvals ta
          INNER JOIN tenders t ON t.id = ta.tender_id
          LEFT JOIN complaints c ON c.id = t.complaint_id
          LEFT JOIN ministries m ON m.id = t.ministry_id
          WHERE ta.approver_id = ?
          ORDER BY t.created_at DESC
        `,
        [req.user.id]
      );

      const tenders = rows.map(row =>
        mapTender(row, {
          complaint: row.complaint_ref_id
            ? {
                _id: row.complaint_ref_id,
                id: row.complaint_ref_id,
                title: row.complaint_ref_title
              }
            : null,
          ministry: mapMinistry(row, 'ministry_ref_'),
          approvalChain: [
            {
              _id: row.approval_id,
              id: row.approval_id,
              level: row.approval_level,
              approver: req.user.id,
              status: row.approval_status,
              comments: row.approval_comments,
              actionAt: row.approval_action_at,
              createdAt: row.approval_created_at
            }
          ]
        })
      );

      res.json({ tenders });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = approvalController;
