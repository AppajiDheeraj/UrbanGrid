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

const mapComplaintVoteSummary = (row) => ({
  totalVotes: Number(row.vote_count || 0),
  averageVote: row.vote_average == null ? 0 : Number(row.vote_average),
  myVote: row.my_vote == null ? null : Number(row.my_vote)
});

const mapComplaintWardRow = (row, extra = {}) => {
  const complaint = mapComplaint(row, extra);

  if (!complaint) {
    return null;
  }

  return {
    ...complaint,
    wardNo: row.ward_no ?? complaint.wardNo ?? null,
    voteSummary: mapComplaintVoteSummary(row),
    tracking: {
      submittedAt: row.submitted_at ?? complaint.submittedAt ?? null,
      officialViewedAt: row.official_viewed_at ?? null,
      contractorNotifiedAt: row.contractor_notified_at ?? null,
      workCompletedAt: row.work_completed_at ?? null
    },
    canVote: Boolean(row.can_vote ?? 0)
  };
};

const citizenController = {
  submitComplaint: async (req, res) => {
    try {
      const { title, description, category, area, address, pinCode } = req.body;
      const wardNo = String(req.user?.wardNo || req.user?.pincode || req.body?.wardNo || '').trim();
      const areaText = String(area || address || '').trim();
      const resolvedPinCode = String(pinCode || wardNo || '').trim();

      if (!title || !description || !category || !areaText || !wardNo) {
        return res.status(400).json({ message: 'Title, description, area, and ward number are required' });
      }

      if (!wardNo) {
        return res.status(400).json({ message: 'Ward number is required to file a complaint' });
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
        [req.user.id, `%${title.toLowerCase().trim()}%`, resolvedPinCode]
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
        [resolvedPinCode]
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
            ward_no,
            region_id,
            latitude,
            longitude
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          complaintPublicId,
          req.user.id,
          title.trim(),
          description.trim(),
          category,
          JSON.stringify(req.files ? req.files.map(file => ({ url: `/uploads/${file.filename}` })) : []),
          areaText,
          resolvedPinCode,
          wardNo,
          region?.id || null,
          null,
          null
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
          wardNo,
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
            vote_stats.vote_count,
            vote_stats.vote_average,
            my_vote.vote_value AS my_vote,
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
          LEFT JOIN (
            SELECT complaint_id, COUNT(*) AS vote_count, AVG(vote_value) AS vote_average
            FROM complaint_votes
            GROUP BY complaint_id
          ) vote_stats ON vote_stats.complaint_id = c.id
          LEFT JOIN complaint_votes my_vote
            ON my_vote.complaint_id = c.id AND my_vote.voter_user_id = ?
          LEFT JOIN ministries m ON m.id = c.ministry_id
          LEFT JOIN departments d ON d.id = c.department_id
          LEFT JOIN users u ON u.id = c.reviewed_by
          WHERE c.id = ? AND (c.citizen_id = ? OR c.ward_no = ?)
          LIMIT 1
        `,
        [req.user.id, req.params.id, req.user.id, req.user.wardNo || req.user.pincode || null]
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

      res.json({
        complaint: {
          ...complaint,
          wardNo: row.ward_no ?? complaint.wardNo ?? null,
          voteSummary: mapComplaintVoteSummary(row),
          tracking: {
            submittedAt: row.submitted_at ?? null,
            officialViewedAt: row.official_viewed_at ?? null,
            contractorNotifiedAt: row.contractor_notified_at ?? null,
            workCompletedAt: row.work_completed_at ?? null
          }
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getWardComplaints: async (req, res) => {
    try {
      const wardNo = String(req.user?.wardNo || req.user?.pincode || '').trim();

      if (!wardNo) {
        return res.status(400).json({ message: 'Ward number is required' });
      }

      const rows = await query(
        `
          SELECT
            c.*,
            citizen.id AS citizen_id,
            citizen.name AS citizen_name,
            citizen.email AS citizen_email,
            citizen.role AS citizen_role,
            citizen.phone AS citizen_phone,
            citizen.address AS citizen_address,
            citizen.ward_no AS citizen_ward_no,
            citizen.is_active AS citizen_is_active,
            citizen.is_email_verified AS citizen_is_email_verified,
            citizen.created_at AS citizen_created_at,
            citizen.updated_at AS citizen_updated_at,
            vote_stats.vote_count,
            vote_stats.vote_average,
            my_vote.vote_value AS my_vote,
            CASE
              WHEN c.citizen_id <> ? AND c.ward_no = ? AND c.status NOT IN ('completed', 'closed') THEN 1
              ELSE 0
            END AS can_vote
          FROM complaints c
          LEFT JOIN users citizen ON citizen.id = c.citizen_id
          LEFT JOIN (
            SELECT complaint_id, COUNT(*) AS vote_count, AVG(vote_value) AS vote_average
            FROM complaint_votes
            GROUP BY complaint_id
          ) vote_stats ON vote_stats.complaint_id = c.id
          LEFT JOIN complaint_votes my_vote
            ON my_vote.complaint_id = c.id AND my_vote.voter_user_id = ?
          WHERE c.ward_no = ? AND c.status NOT IN ('completed', 'closed')
          ORDER BY COALESCE(vote_stats.vote_average, 0) DESC, c.created_at DESC
        `,
        [req.user.id, wardNo, req.user.id, wardNo]
      );

      res.json({
        wardNo,
        complaints: rows.map(row =>
          mapComplaintWardRow(row, {
            citizen: mapSimpleUser(row, 'citizen_')
          })
        )
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  voteComplaint: async (req, res) => {
    try {
      const { id } = req.params;
      const { voteValue } = req.body;
      const wardNo = String(req.user?.wardNo || req.user?.pincode || '').trim();
      const normalizedVote = Number.parseInt(voteValue, 10);

      if (!wardNo) {
        return res.status(400).json({ message: 'Ward number is required' });
      }

      if (!Number.isInteger(normalizedVote) || normalizedVote < 1 || normalizedVote > 5) {
        return res.status(400).json({ message: 'Vote must be between 1 and 5' });
      }

      const complaint = await queryOne(
        'SELECT id, citizen_id, ward_no, status FROM complaints WHERE id = ? LIMIT 1',
        [id]
      );

      if (!complaint) {
        return res.status(404).json({ message: 'Complaint not found' });
      }

      if (String(complaint.ward_no || '') !== wardNo) {
        return res.status(403).json({ message: 'You can only vote on complaints from your ward' });
      }

      if (String(complaint.citizen_id) === String(req.user.id)) {
        return res.status(403).json({ message: 'You cannot vote on your own complaint' });
      }

      if (['completed', 'closed'].includes(complaint.status)) {
        return res.status(400).json({ message: 'This complaint has already been resolved' });
      }

      await run(
        `
          INSERT INTO complaint_votes (
            complaint_id,
            voter_user_id,
            ward_no,
            vote_value
          )
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            ward_no = VALUES(ward_no),
            vote_value = VALUES(vote_value),
            updated_at = CURRENT_TIMESTAMP
        `,
        [id, req.user.id, wardNo, normalizedVote]
      );

      const summary = await queryOne(
        `
          SELECT
            COUNT(*) AS vote_count,
            AVG(vote_value) AS vote_average
          FROM complaint_votes
          WHERE complaint_id = ?
        `,
        [id]
      );

      res.json({
        message: 'Vote recorded successfully',
        voteSummary: {
          totalVotes: Number(summary?.vote_count || 0),
          averageVote: summary?.vote_average == null ? 0 : Number(summary.vote_average)
        }
      });
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
            c.official_viewed_at,
            c.contractor_notified_at,
            c.work_completed_at,
            t.id AS tender_id,
            t.tender_id AS tender_public_id,
            t.status AS tender_status
          FROM complaints c
          LEFT JOIN tenders t ON t.complaint_id = c.id
          WHERE c.id = ? AND (c.citizen_id = ? OR c.ward_no = ?)
          LIMIT 1
        `,
        [req.params.id, req.user.id, req.user.wardNo || req.user.pincode || null]
      );

      if (!row) {
        return res.status(404).json({ message: 'Complaint not found' });
      }

      res.json({
        complaintId: row.complaint_id,
        status: row.status,
        submittedAt: row.submitted_at,
        reviewedAt: row.reviewed_at,
        officialViewedAt: row.official_viewed_at,
        contractorNotifiedAt: row.contractor_notified_at,
        workCompletedAt: row.work_completed_at,
        tender: row.tender_id
          ? {
              _id: row.tender_id,
              id: row.tender_id,
              tenderId: row.tender_public_id,
              status: row.tender_status
            }
          : null,
        stages: [
          {
            key: 'received',
            label: 'Complaint received',
            completedAt: row.submitted_at
          },
          {
            key: 'viewed',
            label: 'Viewed by government official',
            completedAt: row.official_viewed_at || row.reviewed_at
          },
          {
            key: 'notified',
            label: 'Contractor notified',
            completedAt: row.contractor_notified_at
          },
          {
            key: 'work_done',
            label: 'Work completed',
            completedAt: row.work_completed_at
          }
        ]
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = citizenController;
