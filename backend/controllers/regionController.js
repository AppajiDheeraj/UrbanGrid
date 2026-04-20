const { query, queryOne } = require('../utils/sql');
const { mapComplaint, mapProject, mapContractor, mapSimpleUser } = require('../utils/serializers');

const regionController = {
  getRegionProjects: async (req, res) => {
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
            c.category AS complaint_ref_category,
            loc.address AS complaint_ref_address,
            loc.pincode AS complaint_ref_pin_code,
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
            contractor.updated_at AS contractor_ref_updated_at
          FROM projects p
          LEFT JOIN tenders t ON t.id = p.tender_id
          LEFT JOIN complaints c ON c.id = p.complaint_id
          LEFT JOIN locations loc ON loc.id = c.location_id
          LEFT JOIN users contractor ON contractor.id = p.contractor_id
          WHERE p.region_id = ?
          ORDER BY p.created_at DESC
        `,
        [req.user.region]
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
                category: row.complaint_ref_category,
                address: row.complaint_ref_address,
                pinCode: row.complaint_ref_pin_code
              }
            : null,
          contractor: mapContractor(row, 'contractor_ref_')
        })
      );

      res.json({ projects });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getRegionComplaints: async (req, res) => {
    try {
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
            NULL AS citizen_is_active,
            NULL AS citizen_is_email_verified,
            citizen.created_at AS citizen_created_at,
            citizen.updated_at AS citizen_updated_at,
            m.id AS ministry_ref_id,
            m.name AS ministry_ref_name,
            m.code AS ministry_ref_code
          FROM complaints c
          LEFT JOIN users citizen ON citizen.id = c.citizen_id
          LEFT JOIN locations loc ON loc.id = c.location_id
          LEFT JOIN ministries m ON m.id = COALESCE(c.ministry_id, c.routed_to_ministry_id)
          WHERE loc.region_id = ?
          ORDER BY c.created_at DESC
        `,
        [req.user.region]
      );

      const complaints = rows.map(row =>
        mapComplaint(row, {
          citizen: mapSimpleUser(row, 'citizen_'),
          ministry: row.ministry_ref_id
            ? {
                _id: row.ministry_ref_id,
                id: row.ministry_ref_id,
                name: row.ministry_ref_name,
                code: row.ministry_ref_code
              }
            : null
        })
      );

      res.json({ complaints });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  monitorProject: async (req, res) => {
    try {
      const row = await queryOne(
        `
          SELECT *
          FROM projects
          WHERE id = ? AND region_id = ?
          LIMIT 1
        `,
        [req.params.id, req.user.region]
      );

      if (!row) {
        return res.status(404).json({ message: 'Project not found or not in your region' });
      }

      res.json({
        message: 'Project monitoring data retrieved',
        project: mapProject(row)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = regionController;
