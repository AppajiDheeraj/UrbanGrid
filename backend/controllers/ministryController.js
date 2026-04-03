const generateId = require('../utils/generateId');
const { query, queryOne, run, withTransaction } = require('../utils/sql');
const { createAlert } = require('../utils/alerts');
const {
  mapComplaint,
  mapTender,
  mapBid,
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

const mapComplaintLite = (row) => {
  if (!row.complaint_ref_id) {
    return null;
  }

  return {
    _id: row.complaint_ref_id,
    id: row.complaint_ref_id,
    title: row.complaint_ref_title,
    category: row.complaint_ref_category,
    address: row.complaint_ref_address,
    pinCode: row.complaint_ref_pin_code,
    status: row.complaint_ref_status
  };
};

const mapApprovalRow = (row) => ({
  _id: row.id,
  id: row.id,
  level: row.level,
  approver: mapSimpleUser(row, 'approver_'),
  status: row.status,
  comments: row.comments,
  actionAt: row.action_at,
  createdAt: row.created_at
});

const tenderSelect = `
  SELECT
    t.*,
    c.id AS complaint_ref_id,
    c.title AS complaint_ref_title,
    c.category AS complaint_ref_category,
    c.address AS complaint_ref_address,
    c.pin_code AS complaint_ref_pin_code,
    c.status AS complaint_ref_status,
    d.id AS department_ref_id,
    d.name AS department_ref_name,
    d.code AS department_ref_code,
    d.responsibilities AS department_ref_responsibilities,
    d.ministry_id AS department_ref_ministry_id,
    d.is_active AS department_ref_is_active,
    d.created_at AS department_ref_created_at,
    d.updated_at AS department_ref_updated_at,
    m.id AS ministry_ref_id,
    m.name AS ministry_ref_name,
    m.code AS ministry_ref_code,
    u.id AS created_by_user_id,
    u.name AS created_by_user_name,
    u.email AS created_by_user_email,
    u.role AS created_by_user_role,
    u.phone AS created_by_user_phone,
    u.address AS created_by_user_address,
    u.is_active AS created_by_user_is_active,
    u.is_email_verified AS created_by_user_is_email_verified,
    u.created_at AS created_by_user_created_at,
    u.updated_at AS created_by_user_updated_at
  FROM tenders t
  LEFT JOIN complaints c ON c.id = t.complaint_id
  LEFT JOIN departments d ON d.id = t.department_id
  LEFT JOIN ministries m ON m.id = t.ministry_id
  LEFT JOIN users u ON u.id = t.created_by
`;

const mapTenderRow = (row, extra = {}) =>
  mapTender(row, {
    complaint: extra.complaint ?? mapComplaintLite(row),
    department: extra.department ?? mapDepartment(row, 'department_ref_'),
    ministry: extra.ministry ?? mapMinistry(row, 'ministry_ref_'),
    createdBy: extra.createdBy ?? mapSimpleUser(row, 'created_by_user_'),
    approvalChain: extra.approvalChain,
    bids: extra.bids,
    winningBid: extra.winningBid,
    project: extra.project
  });

const ministryController = {
  getComplaints: async (req, res) => {
    try {
      const params = [req.user.ministry];
      let sql = `
        SELECT c.*, citizen.id AS citizen_id, citizen.name AS citizen_name, citizen.email AS citizen_email,
               d.id AS department_ref_id, d.name AS department_ref_name, d.code AS department_ref_code,
               d.responsibilities AS department_ref_responsibilities, d.ministry_id AS department_ref_ministry_id,
               d.is_active AS department_ref_is_active, d.created_at AS department_ref_created_at,
               d.updated_at AS department_ref_updated_at
        FROM complaints c
        LEFT JOIN users citizen ON citizen.id = c.citizen_id
        LEFT JOIN departments d ON d.id = c.department_id
        WHERE c.ministry_id = ?
      `;

      if (req.query.status) {
        sql += ' AND c.status = ?';
        params.push(req.query.status);
      }

      sql += ' ORDER BY c.created_at DESC';
      const rows = await query(sql, params);

      res.json({
        complaints: rows.map(row =>
          mapComplaint(row, {
            citizen: mapSimpleUser(row, 'citizen_'),
            department: mapDepartment(row, 'department_ref_')
          })
        )
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  createTender: async (req, res) => {
    try {
      const { complaintId, title, description, estimatedBudget, startDate, endDate, biddingDeadline } = req.body;

      const complaint = await queryOne('SELECT * FROM complaints WHERE id = ? LIMIT 1', [complaintId]);

      if (!complaint) {
        return res.status(404).json({ message: 'Complaint not found' });
      }

      if (!complaint.ministry_id || String(complaint.ministry_id) !== String(req.user.ministry)) {
        return res.status(403).json({ message: 'Not authorized for this complaint' });
      }

      const tenderId = await withTransaction(async (tx) => {
        const tenderResult = await tx.run(
          `
            INSERT INTO tenders (
              tender_id,
              complaint_id,
              ministry_id,
              department_id,
              title,
              description,
              location_address,
              location_pin_code,
              location_region_id,
              estimated_budget,
              start_date,
              end_date,
              created_by,
              bidding_deadline
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            generateId('TND'),
            complaintId,
            req.user.ministry,
            req.user.department || complaint.department_id,
            title,
            description,
            complaint.address,
            complaint.pin_code,
            complaint.region_id,
            estimatedBudget,
            startDate || null,
            endDate || null,
            req.user.id,
            biddingDeadline || null
          ]
        );

        await tx.run(
          `
            INSERT INTO tender_approvals (tender_id, level, approver_id, status, comments, action_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [tenderResult.insertId, 1, req.user.id, 'approved', 'Created by officer', new Date()]
        );

        await tx.run(
          `
            UPDATE complaints
            SET
              status = 'tender_created',
              contractor_notified_at = COALESCE(contractor_notified_at, NOW()),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [complaintId]
        );

        return tenderResult.insertId;
      });

      await logAlert({
        sourceType: 'tender',
        sourceId: tenderId,
        alertLevel: 'warning',
        message: `Tender ${tenderId} was created for complaint ${complaintId}.`
      });

      const tenderRow = await queryOne(`${tenderSelect} WHERE t.id = ? LIMIT 1`, [tenderId]);

      res.status(201).json({
        message: 'Tender created successfully',
        tender: mapTenderRow(tenderRow)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getTenders: async (req, res) => {
    try {
      const params = [req.user.ministry];
      let sql = `${tenderSelect} WHERE t.ministry_id = ?`;

      if (req.query.status) {
        sql += ' AND t.status = ?';
        params.push(req.query.status);
      }

      sql += ' ORDER BY t.created_at DESC';
      const rows = await query(sql, params);

      res.json({ tenders: rows.map(row => mapTenderRow(row)) });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getTender: async (req, res) => {
    try {
      const tenderRow = await queryOne(`${tenderSelect} WHERE t.id = ? LIMIT 1`, [req.params.id]);

      if (!tenderRow || String(tenderRow.ministry_id) !== String(req.user.ministry)) {
        return res.status(404).json({ message: 'Tender not found' });
      }

      const approvalRows = await query(
        `
          SELECT
            ta.*,
            u.id AS approver_id,
            u.name AS approver_name,
            u.email AS approver_email,
            u.role AS approver_role,
            u.phone AS approver_phone,
            u.address AS approver_address,
            u.is_active AS approver_is_active,
            u.is_email_verified AS approver_is_email_verified,
            u.created_at AS approver_created_at,
            u.updated_at AS approver_updated_at
          FROM tender_approvals ta
          LEFT JOIN users u ON u.id = ta.approver_id
          WHERE ta.tender_id = ?
          ORDER BY ta.level ASC, ta.id ASC
        `,
        [req.params.id]
      );

      const bidRows = await query(
        `
          SELECT
            b.*,
            c.id AS contractor_ref_id,
            c.user_id AS contractor_ref_user_id,
            c.company_name AS contractor_ref_company_name,
            c.registration_number AS contractor_ref_registration_number,
            c.gst_number AS contractor_ref_gst_number,
            c.address AS contractor_ref_address,
            c.phone AS contractor_ref_phone,
            c.specializations AS contractor_ref_specializations,
            c.past_projects AS contractor_ref_past_projects,
            c.rating AS contractor_ref_rating,
            c.documents AS contractor_ref_documents,
            c.is_verified AS contractor_ref_is_verified,
            c.is_active AS contractor_ref_is_active,
            c.created_at AS contractor_ref_created_at,
            c.updated_at AS contractor_ref_updated_at
          FROM bids b
          LEFT JOIN contractors c ON c.id = b.contractor_id
          WHERE b.tender_id = ?
          ORDER BY b.amount ASC
        `,
        [req.params.id]
      );

      const winningBidRow = tenderRow.winning_bid_id
        ? await queryOne('SELECT * FROM bids WHERE id = ? LIMIT 1', [tenderRow.winning_bid_id])
        : null;

      res.json({
        tender: mapTenderRow(tenderRow, {
          approvalChain: approvalRows.map(mapApprovalRow),
          bids: bidRows.map(row => mapBid(row, { contractor: mapContractor(row, 'contractor_ref_') })),
          winningBid: winningBidRow ? mapBid(winningBidRow) : null
        })
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  publishTender: async (req, res) => {
    try {
      const { id } = req.params;

      const tender = await queryOne('SELECT * FROM tenders WHERE id = ? LIMIT 1', [id]);

      if (!tender || String(tender.ministry_id) !== String(req.user.ministry)) {
        return res.status(404).json({ message: 'Tender not found' });
      }

      if (tender.status !== 'approved') {
        return res.status(400).json({ message: 'Tender must be approved before publishing' });
      }

      await run(
        `
          UPDATE tenders
          SET status = 'published', published_at = NOW()
          WHERE id = ?
        `,
        [id]
      );

      await logAlert({
        sourceType: 'tender',
        sourceId: id,
        alertLevel: 'warning',
        message: `Tender ${id} was published for bidding.`
      });

      const updated = await queryOne('SELECT * FROM tenders WHERE id = ? LIMIT 1', [id]);

      res.json({
        message: 'Tender published successfully',
        tender: mapTender(updated)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getBids: async (req, res) => {
    try {
      const { tenderId } = req.params;

      const tender = await queryOne('SELECT id, ministry_id FROM tenders WHERE id = ? LIMIT 1', [tenderId]);

      if (!tender || String(tender.ministry_id) !== String(req.user.ministry)) {
        return res.status(404).json({ message: 'Tender not found' });
      }

      const rows = await query(
        `
          SELECT
            b.*,
            c.id AS contractor_ref_id,
            c.user_id AS contractor_ref_user_id,
            c.company_name AS contractor_ref_company_name,
            c.registration_number AS contractor_ref_registration_number,
            c.gst_number AS contractor_ref_gst_number,
            c.address AS contractor_ref_address,
            c.phone AS contractor_ref_phone,
            c.specializations AS contractor_ref_specializations,
            c.past_projects AS contractor_ref_past_projects,
            c.rating AS contractor_ref_rating,
            c.documents AS contractor_ref_documents,
            c.is_verified AS contractor_ref_is_verified,
            c.is_active AS contractor_ref_is_active,
            c.created_at AS contractor_ref_created_at,
            c.updated_at AS contractor_ref_updated_at
          FROM bids b
          LEFT JOIN contractors c ON c.id = b.contractor_id
          WHERE b.tender_id = ?
          ORDER BY b.amount ASC
        `,
        [tenderId]
      );

      res.json({
        bids: rows.map(row => mapBid(row, { contractor: mapContractor(row, 'contractor_ref_') }))
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  selectBid: async (req, res) => {
    try {
      const { tenderId, bidId } = req.params;

      const tender = await queryOne('SELECT * FROM tenders WHERE id = ? LIMIT 1', [tenderId]);

      if (!tender || String(tender.ministry_id) !== String(req.user.ministry)) {
        return res.status(404).json({ message: 'Tender not found' });
      }

      const bid = await queryOne('SELECT * FROM bids WHERE id = ? LIMIT 1', [bidId]);

      if (!bid || String(bid.tender_id) !== String(tenderId)) {
        return res.status(404).json({ message: 'Bid not found' });
      }

      await withTransaction(async (tx) => {
        await tx.run(
          'UPDATE tenders SET winning_bid_id = ?, status = ? WHERE id = ?',
          [bidId, 'assigned', tenderId]
        );

        await tx.run('UPDATE bids SET status = ? WHERE id = ?', ['accepted', bidId]);
        await tx.run(
          'UPDATE bids SET status = ? WHERE tender_id = ? AND id <> ?',
          ['rejected', tenderId, bidId]
        );
      });

      await logAlert({
        sourceType: 'tender',
        sourceId: tenderId,
        alertLevel: 'warning',
        message: `Winning bid ${bidId} was selected for tender ${tenderId}.`
      });

      const updated = await queryOne('SELECT * FROM tenders WHERE id = ? LIMIT 1', [tenderId]);

      res.json({
        message: 'Bid selected successfully',
        tender: mapTender(updated)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = ministryController;
