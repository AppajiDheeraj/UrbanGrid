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

const categoryToMinistryMap = {
  road_damage: 'urban development',
  water_leakage: 'urban development',
  streetlight_failure: 'urban development',
  garbage: 'urban development',
  drainage: 'urban development'
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
  level: row.level ?? row.approval_level,
  approver: mapSimpleUser(row, 'approver_'),
  status: row.status ?? row.approval_status,
  comments: row.comments ?? row.remarks,
  actionAt: row.action_at ?? row.approved_at,
  createdAt: row.created_at
});

const tenderSelect = `
  SELECT
    t.*,
    c.id AS complaint_ref_id,
    c.issue_title AS complaint_ref_title,
    c.category AS complaint_ref_category,
    loc.address AS complaint_ref_address,
    loc.pincode AS complaint_ref_pin_code,
    c.status AS complaint_ref_status,
    tender_loc.address AS location_address,
    tender_loc.pincode AS location_pin_code,
    tender_loc.region_id AS location_region_id,
    tender_loc.ward_no AS location_ward_no,
    d.id AS department_ref_id,
    d.name AS department_ref_name,
    d.code AS department_ref_code,
    d.responsibilities AS department_ref_responsibilities,
    d.ministry_id AS department_ref_ministry_id,
    NULL AS department_ref_is_active,
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
    NULL AS created_by_user_is_active,
    NULL AS created_by_user_is_email_verified,
    u.created_at AS created_by_user_created_at,
    u.updated_at AS created_by_user_updated_at
  FROM tenders t
  LEFT JOIN complaints c ON c.id = t.complaint_id
  LEFT JOIN locations loc ON loc.id = c.location_id
  LEFT JOIN locations tender_loc ON tender_loc.id = COALESCE(t.location_id, c.location_id)
  LEFT JOIN departments d ON d.id = t.department_id
  LEFT JOIN ministries m ON m.id = t.ministry_id
  LEFT JOIN users u ON u.id = t.created_by
`;

const resolveMinistryId = async ({ requestedMinistryId, category, fallbackMinistryId }) => {
  if (requestedMinistryId) {
    return requestedMinistryId;
  }

  if (fallbackMinistryId) {
    return fallbackMinistryId;
  }

  if (category) {
    const ministryName = categoryToMinistryMap[category] || 'urban development';
    const ministry = await queryOne(
      'SELECT id FROM ministries WHERE LOWER(name) LIKE ? LIMIT 1',
      [`%${ministryName}%`]
    );

    if (ministry?.id) {
      return ministry.id;
    }
  }

  const firstMinistry = await queryOne('SELECT id FROM ministries ORDER BY id ASC LIMIT 1');
  return firstMinistry?.id || null;
};

const resolveLocationId = async ({ wardNo, area, pinCode }) => {
  const normalizedWard = String(wardNo || '').trim();

  if (!normalizedWard) {
    return null;
  }

  const existingLocation = await queryOne(
    `
      SELECT id
      FROM locations
      WHERE ward_no = ?
      ORDER BY id ASC
      LIMIT 1
    `,
    [normalizedWard]
  );

  if (existingLocation?.id) {
    return existingLocation.id;
  }

  let region = await queryOne('SELECT id FROM regions ORDER BY id ASC LIMIT 1');

  if (!region) {
    const regionResult = await run(
      `
        INSERT INTO regions (name, code)
        VALUES (?, ?)
      `,
      ['Unassigned Region', 'UNASSIGNED']
    );
    region = { id: regionResult.insertId };
  }

  const locationResult = await run(
    `
      INSERT INTO locations (
        region_id,
        ward_no,
        address,
        pincode
      )
      VALUES (?, ?, ?, ?)
    `,
    [region.id, normalizedWard, area || `Ward ${normalizedWard}`, pinCode || '000000']
  );

  return locationResult.insertId;
};

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
               NULL AS department_ref_is_active, d.created_at AS department_ref_created_at,
               d.updated_at AS department_ref_updated_at,
               COALESCE(vote_stats.vote_count, 0) AS vote_count,
               COALESCE(vote_stats.vote_average, 0) AS vote_average
        FROM complaints c
        LEFT JOIN users citizen ON citizen.id = c.citizen_id
        LEFT JOIN departments d ON d.id = c.department_id
        LEFT JOIN (
          SELECT complaint_id, COUNT(*) AS vote_count, AVG(vote_value) AS vote_average
          FROM complaint_votes
          GROUP BY complaint_id
        ) vote_stats ON vote_stats.complaint_id = c.id
        WHERE COALESCE(c.ministry_id, c.routed_to_ministry_id) = ?
      `;

      if (req.query.status) {
        sql += ' AND c.status = ?';
        params.push(req.query.status);
      }

      sql += ' ORDER BY COALESCE(vote_stats.vote_average, 0) DESC, COALESCE(vote_stats.vote_count, 0) DESC, c.created_at DESC';
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
      const {
        complaintId,
        title,
        description,
        estimatedBudget,
        startDate,
        endDate,
        biddingDeadline,
        category,
        wardNo,
        area,
        pinCode,
        ministryId,
        departmentId
      } = req.body;

      if (!title || !estimatedBudget) {
        return res.status(400).json({ message: 'Tender title and estimated budget are required' });
      }

      const normalizedBudget = Number(estimatedBudget);
      const normalizedDescription = description == null || description === '' ? null : String(description);

      if (!Number.isFinite(normalizedBudget) || normalizedBudget <= 0) {
        return res.status(400).json({ message: 'Estimated budget must be a positive number' });
      }

      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ message: 'Tender start date must be before the end date' });
      }

      if (biddingDeadline && endDate && new Date(biddingDeadline) > new Date(endDate)) {
        return res.status(400).json({ message: 'Bidding deadline cannot be after the tender end date' });
      }
      let complaint = null;
      let resolvedComplaintId = complaintId || null;
      let resolvedCategory = category || null;
      let resolvedLocationId = null;
      let resolvedDepartmentId = departmentId || null;
      let resolvedMinistryId = null;
      let tenderType = 'master';

      if (resolvedComplaintId) {
        complaint = await queryOne('SELECT * FROM complaints WHERE id = ? LIMIT 1', [resolvedComplaintId]);

        if (!complaint) {
          return res.status(404).json({ message: 'Complaint not found' });
        }

        const complaintMinistryId = complaint.ministry_id || complaint.routed_to_ministry_id;

        if (req.user.role !== 'admin' && (!complaintMinistryId || String(complaintMinistryId) !== String(req.user.ministry))) {
          return res.status(403).json({ message: 'Not authorized for this complaint' });
        }

        if (complaint.project_id) {
          return res.status(409).json({ message: 'This complaint is already linked to an active project' });
        }

        if (!['verified', 'tender_created'].includes(String(complaint.status || '').toLowerCase())) {
          return res.status(400).json({ message: 'Only verified complaints can be turned into tenders' });
        }

        const existingTender = await queryOne(
          'SELECT id, status FROM tenders WHERE complaint_id = ? LIMIT 1',
          [resolvedComplaintId]
        );

        if (existingTender) {
          return res.status(409).json({
            message: 'A tender has already been created for this complaint',
            tenderId: existingTender.id,
            status: existingTender.status
          });
        }

        resolvedCategory = complaint.category || resolvedCategory;
        resolvedLocationId = complaint.location_id || null;
        resolvedDepartmentId = resolvedDepartmentId || complaint.department_id || null;
        resolvedMinistryId = await resolveMinistryId({
          requestedMinistryId: ministryId,
          category: resolvedCategory,
          fallbackMinistryId: complaintMinistryId || req.user.ministry
        });
        tenderType = 'complaint';
      } else {
        if (!resolvedCategory || !wardNo) {
          return res.status(400).json({ message: 'Category and ward number are required for a government-created tender' });
        }

        resolvedLocationId = await resolveLocationId({ wardNo, area, pinCode });
        resolvedMinistryId = await resolveMinistryId({
          requestedMinistryId: ministryId,
          category: resolvedCategory,
          fallbackMinistryId: req.user.ministry
        });

        if (!resolvedMinistryId) {
          return res.status(400).json({ message: 'A ministry is required before creating a tender' });
        }

        const existingMasterTender = await queryOne(
          `
            SELECT id, status
            FROM tenders
            WHERE complaint_id IS NULL
              AND location_id = ?
              AND category = ?
              AND status IN ('draft', 'pending_approval', 'approved', 'published', 'bidding_closed')
            LIMIT 1
          `,
          [resolvedLocationId, resolvedCategory]
        );

        if (existingMasterTender) {
          return res.status(409).json({
            message: 'A tender already exists for this work type and ward',
            tenderId: existingMasterTender.id,
            status: existingMasterTender.status
          });
        }
      }

      const tenderId = await withTransaction(async (tx) => {
        const tenderResult = await tx.run(
          `
            INSERT INTO tenders (
              tender_type,
              complaint_id,
              ministry_id,
              department_id,
              location_id,
              name,
              description,
              category,
              estimated_budget,
              status,
              tender_end_date,
              submitted_at,
              start_date,
              expected_end_date,
              created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)
          `,
          [
            tenderType,
            resolvedComplaintId,
            resolvedMinistryId,
            req.user.role === 'admin' ? resolvedDepartmentId : (req.user.department || resolvedDepartmentId),
            resolvedLocationId,
            title,
            normalizedDescription,
            resolvedCategory || null,
            normalizedBudget,
            'approved',
            biddingDeadline || endDate || null,
            startDate || null,
            endDate || null,
            req.user.id
          ]
        );

        await tx.run(
          `
            INSERT INTO tender_approvals (
              tender_id,
              approval_level,
              approval_role,
              approver_id,
              approval_status,
              remarks,
              approved_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [tenderResult.insertId, 1, req.user.role, req.user.id, 'approved', 'Created by officer', new Date()]
        );

        if (resolvedComplaintId) {
          await tx.run(
            `
              UPDATE complaints
              SET
                status = 'tender_created',
                ministry_id = COALESCE(ministry_id, ?),
                department_id = COALESCE(department_id, ?),
                contractor_notified_at = COALESCE(contractor_notified_at, NOW()),
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [resolvedMinistryId, req.user.role === 'admin' ? resolvedDepartmentId : (req.user.department || resolvedDepartmentId), resolvedComplaintId]
          );
        }

        return tenderResult.insertId;
      });

      await logAlert({
        sourceType: 'tender',
        sourceId: tenderId,
        alertLevel: 'warning',
        message: resolvedComplaintId
          ? `Tender ${tenderId} was created for complaint ${resolvedComplaintId}.`
          : `Master tender ${tenderId} was created for ${resolvedCategory || 'the selected category'}.`
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
      const params = [];
      let sql = tenderSelect;

      if (req.user.role !== 'admin') {
        sql += ' WHERE t.ministry_id = ?';
        params.push(req.user.ministry);
      } else {
        sql += ' WHERE 1 = 1';
      }

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

      if (!tenderRow || (req.user.role !== 'admin' && String(tenderRow.ministry_id) !== String(req.user.ministry))) {
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
            NULL AS approver_is_active,
            NULL AS approver_is_email_verified,
            u.created_at AS approver_created_at,
            u.updated_at AS approver_updated_at
          FROM tender_approvals ta
          LEFT JOIN users u ON u.id = ta.approver_id
          WHERE ta.tender_id = ?
          ORDER BY ta.approval_level ASC, ta.id ASC
        `,
        [req.params.id]
      );

      const bidRows = await query(
        `
          SELECT
            b.*,
            c.id AS contractor_ref_id,
            c.id AS contractor_ref_user_id,
            c.company_name AS contractor_ref_company_name,
            c.registration_number AS contractor_ref_registration_number,
            NULL AS contractor_ref_gst_number,
            c.address AS contractor_ref_address,
            c.phone AS contractor_ref_phone,
            NULL AS contractor_ref_specializations,
            c.total_projects AS contractor_ref_past_projects,
            c.contractor_rating AS contractor_ref_rating,
            NULL AS contractor_ref_documents,
            NULL AS contractor_ref_is_verified,
            NULL AS contractor_ref_is_active,
            c.created_at AS contractor_ref_created_at,
            c.updated_at AS contractor_ref_updated_at
          FROM bids b
          LEFT JOIN users c ON c.id = b.contractor_id
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

      if (!tender || (req.user.role !== 'admin' && String(tender.ministry_id) !== String(req.user.ministry))) {
        return res.status(404).json({ message: 'Tender not found' });
      }

      if (!['approved', 'published'].includes(tender.status)) {
        return res.status(400).json({ message: 'Tender must be approved before publishing' });
      }

      await run(
        `
          UPDATE tenders
          SET status = 'published', published_at = NOW(), submitted_at = COALESCE(submitted_at, NOW())
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

      if (!tender || (req.user.role !== 'admin' && String(tender.ministry_id) !== String(req.user.ministry))) {
        return res.status(404).json({ message: 'Tender not found' });
      }

      const rows = await query(
        `
          SELECT
            b.*,
            c.id AS contractor_ref_id,
            c.id AS contractor_ref_user_id,
            c.company_name AS contractor_ref_company_name,
            c.registration_number AS contractor_ref_registration_number,
            NULL AS contractor_ref_gst_number,
            c.address AS contractor_ref_address,
            c.phone AS contractor_ref_phone,
            NULL AS contractor_ref_specializations,
            c.total_projects AS contractor_ref_past_projects,
            c.contractor_rating AS contractor_ref_rating,
            NULL AS contractor_ref_documents,
            NULL AS contractor_ref_is_verified,
            NULL AS contractor_ref_is_active,
            c.created_at AS contractor_ref_created_at,
            c.updated_at AS contractor_ref_updated_at
          FROM bids b
          LEFT JOIN users c ON c.id = b.contractor_id
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

      if (!tender || (req.user.role !== 'admin' && String(tender.ministry_id) !== String(req.user.ministry))) {
        return res.status(404).json({ message: 'Tender not found' });
      }

      if (String(tender.status || '').toLowerCase() !== 'published') {
        return res.status(400).json({ message: 'Only published tenders can have a winning bid selected' });
      }

      if (tender.winning_bid_id) {
        return res.status(409).json({ message: 'A winning bid has already been selected for this tender' });
      }

      const bid = await queryOne('SELECT * FROM bids WHERE id = ? LIMIT 1', [bidId]);

      if (!bid || String(bid.tender_id) !== String(tenderId)) {
        return res.status(404).json({ message: 'Bid not found' });
      }

      await withTransaction(async (tx) => {
        const complaint = tender.complaint_id
          ? await tx.queryOne(
              `
                SELECT c.*, loc.region_id AS location_region_id
                FROM complaints c
                LEFT JOIN locations loc ON loc.id = c.location_id
                WHERE c.id = ?
                LIMIT 1
              `,
              [tender.complaint_id]
            )
          : null;
        const tenderLocation = tender.location_id
          ? await tx.queryOne('SELECT id, region_id FROM locations WHERE id = ? LIMIT 1', [tender.location_id])
          : null;
        const fallbackRegion = await tx.queryOne('SELECT id FROM regions ORDER BY id LIMIT 1');
        const regionId = complaint?.location_region_id || tenderLocation?.region_id || fallbackRegion?.id;

        if (!regionId) {
          throw new Error('A region is required before assigning a project');
        }

        await tx.run(
          'UPDATE tenders SET winning_bid_id = ?, status = ? WHERE id = ?',
          [bidId, 'bidding_closed', tenderId]
        );

        await tx.run('UPDATE bids SET status = ? WHERE id = ?', ['selected', bidId]);
        await tx.run(
          'UPDATE bids SET status = ? WHERE tender_id = ? AND id <> ?',
          ['rejected', tenderId, bidId]
        );

        const existingProject = await tx.queryOne(
          'SELECT id FROM projects WHERE tender_id = ? LIMIT 1',
          [tenderId]
        );

        if (!existingProject) {
          await tx.run(
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
                created_by
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              tenderId,
              bidId,
              tender.complaint_id || null,
              tender.ministry_id,
              regionId,
              tender.location_id || complaint?.location_id || null,
              bid.contractor_id,
              tender.name || `Tender ${tenderId}`,
              tender.description || null,
              tender.category || complaint?.category || null,
              bid.amount || tender.estimated_budget || null,
              bid.proposed_start_date || null,
              bid.proposed_end_date || tender.tender_end_date || null,
              'assigned',
              req.user.id
            ]
          );
        }

        if (tender.complaint_id) {
          await tx.run(
            `
              UPDATE complaints
              SET status = 'in_progress',
                  contractor_notified_at = COALESCE(contractor_notified_at, NOW()),
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [tender.complaint_id]
          );
        }
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
