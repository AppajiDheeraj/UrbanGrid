const { parseJsonArray } = require('./sql');

const withId = (record) => {
  if (!record || record.id == null) {
    return null;
  }

  return {
    _id: record.id,
    ...record
  };
};

const mapSimpleUser = (row, prefix = '') => {
  const id = row[`${prefix}id`];

  if (id == null) {
    return null;
  }

  return withId({
    id,
    name: row[`${prefix}name`],
    email: row[`${prefix}email`],
    role: row[`${prefix}role`],
    phone: row[`${prefix}phone`] ?? null,
    address: row[`${prefix}address`] ?? null,
    isActive: row[`${prefix}is_active`] == null ? undefined : Boolean(row[`${prefix}is_active`]),
    isEmailVerified: row[`${prefix}is_email_verified`] == null ? undefined : Boolean(row[`${prefix}is_email_verified`]),
    createdAt: row[`${prefix}created_at`] ?? null,
    updatedAt: row[`${prefix}updated_at`] ?? null
  });
};

const mapMinistry = (row, prefix = '') => {
  const id = row[`${prefix}id`];

  if (id == null) {
    return null;
  }

  return withId({
    id,
    name: row[`${prefix}name`],
    code: row[`${prefix}code`] ?? null,
    description: row[`${prefix}description`] ?? null,
    isActive: row[`${prefix}is_active`] == null ? undefined : Boolean(row[`${prefix}is_active`]),
    createdAt: row[`${prefix}created_at`] ?? null,
    updatedAt: row[`${prefix}updated_at`] ?? null
  });
};

const mapDepartment = (row, prefix = '') => {
  const id = row[`${prefix}id`];

  if (id == null) {
    return null;
  }

  return withId({
    id,
    name: row[`${prefix}name`],
    code: row[`${prefix}code`] ?? null,
    responsibilities: parseJsonArray(row[`${prefix}responsibilities`]),
    isActive: row[`${prefix}is_active`] == null ? undefined : Boolean(row[`${prefix}is_active`]),
    ministryId: row[`${prefix}ministry_id`] ?? null,
    createdAt: row[`${prefix}created_at`] ?? null,
    updatedAt: row[`${prefix}updated_at`] ?? null
  });
};

const mapRegion = (row, prefix = '') => {
  const id = row[`${prefix}id`];

  if (id == null) {
    return null;
  }

  return withId({
    id,
    name: row[`${prefix}name`],
    pinCodes: parseJsonArray(row[`${prefix}pin_codes`]),
    manager: row[`${prefix}manager_id`] ?? null,
    department: row[`${prefix}department_id`] ?? null,
    isActive: row[`${prefix}is_active`] == null ? undefined : Boolean(row[`${prefix}is_active`]),
    createdAt: row[`${prefix}created_at`] ?? null,
    updatedAt: row[`${prefix}updated_at`] ?? null
  });
};

const mapContractor = (row, prefix = '') => {
  const id = row[`${prefix}id`];

  if (id == null) {
    return null;
  }

  return withId({
    id,
    user: row[`${prefix}user_id`] ?? null,
    companyName: row[`${prefix}company_name`],
    registrationNumber: row[`${prefix}registration_number`],
    gstNumber: row[`${prefix}gst_number`] ?? null,
    address: row[`${prefix}address`] ?? null,
    phone: row[`${prefix}phone`] ?? null,
    specializations: parseJsonArray(row[`${prefix}specializations`]),
    pastProjects: row[`${prefix}past_projects`] ?? 0,
    rating: row[`${prefix}rating`] == null ? 0 : Number(row[`${prefix}rating`]),
    documents: parseJsonArray(row[`${prefix}documents`]),
    isVerified: row[`${prefix}is_verified`] == null ? undefined : Boolean(row[`${prefix}is_verified`]),
    isActive: row[`${prefix}is_active`] == null ? undefined : Boolean(row[`${prefix}is_active`]),
    createdAt: row[`${prefix}created_at`] ?? null,
    updatedAt: row[`${prefix}updated_at`] ?? null
  });
};

const mapComplaint = (row, extra = {}) => withId({
  id: row.id,
  complaintId: row.complaint_id,
  citizen: extra.citizen ?? row.citizen_id ?? null,
  title: row.title,
  description: row.description,
  category: row.category,
  images: parseJsonArray(row.images),
  address: row.address,
  pinCode: row.pin_code,
  region: extra.region ?? row.region_id ?? null,
  location: row.latitude != null && row.longitude != null
    ? { latitude: Number(row.latitude), longitude: Number(row.longitude) }
    : null,
  status: row.status,
  ministry: extra.ministry ?? row.ministry_id ?? null,
  department: extra.department ?? row.department_id ?? null,
  submittedAt: row.submitted_at,
  reviewedBy: extra.reviewedBy ?? row.reviewed_by ?? null,
  reviewedAt: row.reviewed_at ?? null,
  reviewNotes: row.review_notes ?? null,
  rejectionReason: row.rejection_reason ?? null,
  tender: extra.tender ?? null,
  isActive: row.is_active == null ? undefined : Boolean(row.is_active),
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null
});

const mapTender = (row, extra = {}) => withId({
  id: row.id,
  tenderId: row.tender_id,
  complaint: extra.complaint ?? row.complaint_id,
  ministry: extra.ministry ?? row.ministry_id,
  department: extra.department ?? row.department_id,
  title: row.title,
  description: row.description,
  location: {
    address: row.location_address ?? null,
    pinCode: row.location_pin_code ?? null,
    region: extra.region ?? row.location_region_id ?? null
  },
  estimatedBudget: row.estimated_budget == null ? null : Number(row.estimated_budget),
  timeline: {
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null
  },
  status: row.status,
  approvalChain: extra.approvalChain ?? [],
  bids: extra.bids ?? [],
  winningBid: extra.winningBid ?? row.winning_bid_id ?? null,
  project: extra.project ?? null,
  createdBy: extra.createdBy ?? row.created_by,
  createdAt: row.created_at,
  publishedAt: row.published_at ?? null,
  biddingDeadline: row.bidding_deadline ?? null
});

const mapBid = (row, extra = {}) => withId({
  id: row.id,
  tender: extra.tender ?? row.tender_id,
  contractor: extra.contractor ?? row.contractor_id,
  amount: row.amount == null ? null : Number(row.amount),
  timeline: {
    proposedStartDate: row.proposed_start_date ?? null,
    proposedEndDate: row.proposed_end_date ?? null,
    durationDays: row.duration_days ?? null
  },
  proposal: row.proposal ?? null,
  documents: parseJsonArray(row.documents),
  status: row.status,
  submittedAt: row.submitted_at,
  reviewedBy: extra.reviewedBy ?? row.reviewed_by ?? null,
  reviewedAt: row.reviewed_at ?? null,
  reviewNotes: row.review_notes ?? null
});

const mapProject = (row, extra = {}) => withId({
  id: row.id,
  projectId: row.project_id,
  tender: extra.tender ?? row.tender_id,
  complaint: extra.complaint ?? row.complaint_id,
  contractor: extra.contractor ?? row.contractor_id,
  title: row.title,
  description: row.description ?? null,
  status: row.status,
  timeline: {
    startDate: row.start_date ?? null,
    proposedEndDate: row.proposed_end_date ?? null,
    actualEndDate: row.actual_end_date ?? null
  },
  budget: {
    allocated: row.allocated_budget == null ? null : Number(row.allocated_budget),
    actual: row.actual_budget == null ? null : Number(row.actual_budget)
  },
  assignedBy: extra.assignedBy ?? row.assigned_by ?? null,
  assignedAt: row.assigned_at ?? null,
  regionalManager: extra.regionalManager ?? row.regional_manager_id ?? null,
  milestones: parseJsonArray(row.milestones),
  progress: {
    percentage: row.progress_percentage ?? 0,
    lastUpdated: row.progress_last_updated ?? null,
    lastUpdatedBy: row.progress_last_updated_by ?? null
  },
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null
});

const mapProgress = (row, extra = {}) => withId({
  id: row.id,
  project: extra.project ?? row.project_id,
  updateType: row.update_type,
  title: row.title,
  description: row.description,
  percentageComplete: row.percentage_complete ?? null,
  images: parseJsonArray(row.images),
  submittedBy: extra.submittedBy ?? row.submitted_by,
  submittedAt: row.submitted_at,
  reviewedBy: extra.reviewedBy ?? row.reviewed_by ?? null,
  reviewNotes: row.review_notes ?? null,
  isApproved: row.is_approved == null ? null : Boolean(row.is_approved)
});

const mapVerification = (row, extra = {}) => withId({
  id: row.id,
  project: extra.project ?? row.project_id,
  complaint: extra.complaint ?? row.complaint_id,
  verificationType: row.verification_type,
  status: row.status,
  verifiedBy: extra.verifiedBy ?? row.verified_by ?? null,
  verifiedAt: row.verified_at ?? null,
  findings: row.findings ?? null,
  issues: parseJsonArray(row.issues),
  images: parseJsonArray(row.images),
  rating: row.rating ?? null,
  recommendation: row.recommendation ?? null,
  createdAt: row.created_at ?? null
});

module.exports = {
  mapSimpleUser,
  mapMinistry,
  mapDepartment,
  mapRegion,
  mapContractor,
  mapComplaint,
  mapTender,
  mapBid,
  mapProject,
  mapProgress,
  mapVerification
};
