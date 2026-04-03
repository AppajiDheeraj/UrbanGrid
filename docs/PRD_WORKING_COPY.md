# UrbanGrid - Technical Specification

## Database Schema

### 1. User Model
```javascript
{
  _id: ObjectId,
  name: String (required),
  email: String (required, unique),
  password: String (required, hashed),
  role: Enum ['citizen', 'admin', 'ministry_officer', 'department_head', 'senior_official', 'contractor', 'regional_manager'],
  ministry: ObjectId (ref: 'Ministry', for govt users),
  department: ObjectId (ref: 'Department', for govt users),
  region: ObjectId (ref: 'Region', for regional managers),
  contractorProfile: ObjectId (ref: 'Contractor', for contractors),
  phone: String,
  address: String,
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### 2. Ministry Model
```javascript
{
  _id: ObjectId,
  name: String (required), // e.g., "Transport Ministry"
  code: String (required, unique), // e.g., "TRANSPORT"
  description: String,
  departments: [ObjectId (ref: 'Department')],
  isActive: Boolean (default: true),
  createdAt: Date
}
```

### 3. Department Model
```javascript
{
  _id: ObjectId,
  name: String (required),
  ministry: ObjectId (ref: 'Ministry', required),
  code: String (required),
  responsibilities: [String], // e.g., ['road_damage', 'streetlights']
  regions: [ObjectId (ref: 'Region')],
  isActive: Boolean (default: true)
}
```

### 4. Region Model
```javascript
{
  _id: ObjectId,
  name: String (required), // e.g., "North Zone"
  pinCodes: [String], // Array of pincodes this region covers
  manager: ObjectId (ref: 'User'), // Regional manager
  department: ObjectId (ref: 'Department'),
  isActive: Boolean (default: true)
}
```

### 5. Contractor Model
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: 'User', required),
  companyName: String (required),
  registrationNumber: String (required, unique),
  gstNumber: String,
  address: String,
  phone: String,
  specializations: [String], // e.g., ['road_repair', 'water_supply']
  pastProjects: Number (default: 0),
  rating: Number (default: 0, min: 0, max: 5),
  documents: [{ name: String, url: String }],
  isVerified: Boolean (default: false),
  isActive: Boolean (default: true)
}
```

### 6. Complaint Model
```javascript
{
  _id: ObjectId,
  complaintId: String (unique, auto-generated), // e.g., "CMP-2024-001"
  citizen: ObjectId (ref: 'User', required),
  title: String (required),
  description: String (required),
  category: Enum ['road_damage', 'water_leakage', 'streetlight_failure', 'garbage', 'drainage', 'others'],
  images: [{ url: String, uploadedAt: Date }],
  address: String (required),
  pinCode: String (required),
  region: ObjectId (ref: 'Region'),
  location: {
    latitude: Number,
    longitude: Number
  },
  status: Enum ['submitted', 'under_review', 'verified', 'rejected', 'tender_created', 'in_progress', 'completed', 'closed'],
  ministry: ObjectId (ref: 'Ministry'),
  department: ObjectId (ref: 'Department'),
  submittedAt: Date (default: Date.now),
  reviewedBy: ObjectId (ref: 'User'),
  reviewedAt: Date,
  reviewNotes: String,
  tender: ObjectId (ref: 'Tender'),
  rejectionReason: String,
  isActive: Boolean (default: true)
}
```

### 7. Tender Model
```javascript
{
  _id: ObjectId,
  tenderId: String (unique, auto-generated), // e.g., "TND-2024-001"
  complaint: ObjectId (ref: 'Complaint', required),
  ministry: ObjectId (ref: 'Ministry', required),
  department: ObjectId (ref: 'Department', required),
  title: String (required),
  description: String (required),
  location: {
    address: String,
    pinCode: String,
    region: ObjectId (ref: 'Region')
  },
  estimatedBudget: Number (required),
  timeline: {
    startDate: Date,
    endDate: Date
  },
  status: Enum ['draft', 'pending_approval', 'approved', 'rejected', 'published', 'bidding_closed', 'assigned', 'in_progress', 'completed', 'cancelled'],
  approvalChain: [{
    level: Number, // 1=Officer, 2=Ministry Head, 3=Senior Official
    approver: ObjectId (ref: 'User'),
    status: Enum ['pending', 'approved', 'rejected'],
    comments: String,
    actionAt: Date
  }],
  bids: [ObjectId (ref: 'Bid')],
  winningBid: ObjectId (ref: 'Bid'),
  project: ObjectId (ref: 'Project'),
  createdBy: ObjectId (ref: 'User', required),
  createdAt: Date (default: Date.now),
  publishedAt: Date,
  biddingDeadline: Date
}
```

### 8. Bid Model
```javascript
{
  _id: ObjectId,
  tender: ObjectId (ref: 'Tender', required),
  contractor: ObjectId (ref: 'Contractor', required),
  amount: Number (required),
  timeline: {
    proposedStartDate: Date,
    proposedEndDate: Date,
    durationDays: Number
  },
  proposal: String,
  documents: [{ name: String, url: String }],
  status: Enum ['submitted', 'under_review', 'shortlisted', 'accepted', 'rejected'],
  submittedAt: Date (default: Date.now),
  reviewedBy: ObjectId (ref: 'User'),
  reviewedAt: Date,
  reviewNotes: String
}
```

### 9. Project Model
```javascript
{
  _id: ObjectId,
  projectId: String (unique, auto-generated), // e.g., "PRJ-2024-001"
  tender: ObjectId (ref: 'Tender', required),
  complaint: ObjectId (ref: 'Complaint', required),
  contractor: ObjectId (ref: 'Contractor', required),
  title: String (required),
  description: String,
  status: Enum ['not_started', 'in_progress', 'on_hold', 'completed', 'verified', 'closed'],
  timeline: {
    startDate: Date,
    proposedEndDate: Date,
    actualEndDate: Date
  },
  budget: {
    allocated: Number,
    actual: Number
  },
  assignedBy: ObjectId (ref: 'User'),
  assignedAt: Date,
  regionalManager: ObjectId (ref: 'User'),
  milestones: [{
    title: String,
    description: String,
    deadline: Date,
    completedAt: Date,
    status: Enum ['pending', 'completed', 'overdue']
  }],
  progress: {
    percentage: Number (default: 0),
    lastUpdated: Date,
    lastUpdatedBy: ObjectId (ref: 'User')
  },
  createdAt: Date (default: Date.now)
}
```

### 10. Progress Update Model
```javascript
{
  _id: ObjectId,
  project: ObjectId (ref: 'Project', required),
  updateType: Enum ['milestone', 'daily', 'weekly', 'issue', 'completion'],
  title: String (required),
  description: String (required),
  percentageComplete: Number,
  images: [{ url: String, uploadedAt: Date }],
  submittedBy: ObjectId (ref: 'User', required),
  submittedAt: Date (default: Date.now),
  reviewedBy: ObjectId (ref: 'User'),
  reviewNotes: String,
  isApproved: Boolean
}
```

### 11. Verification Record Model
```javascript
{
  _id: ObjectId,
  project: ObjectId (ref: 'Project', required),
  complaint: ObjectId (ref: 'Complaint', required),
  verificationType: Enum ['mid_term', 'final', 'quality_check'],
  status: Enum ['pending', 'in_progress', 'verified', 'rejected'],
  verifiedBy: ObjectId (ref: 'User'),
  verifiedAt: Date,
  findings: String,
  issues: [String],
  images: [{ url: String }],
  rating: Number, // Quality rating 1-5
  recommendation: Enum ['approve', 'reject', 'needs_rework'],
  createdAt: Date (default: Date.now)
}
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register (citizen/contractor)
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh token

### Citizen APIs
- `POST /api/complaints` - Submit complaint (with image upload)
- `GET /api/complaints/my` - Get my complaints
- `GET /api/complaints/:id` - Get complaint details
- `GET /api/complaints/:id/status` - Track status

### Admin APIs
- `GET /api/admin/complaints/pending` - List pending complaints
- `GET /api/admin/complaints/all` - List all complaints
- `PATCH /api/admin/complaints/:id/verify` - Verify complaint
- `PATCH /api/admin/complaints/:id/reject` - Reject complaint
- `POST /api/admin/complaints/:id/route` - Route to ministry
- `GET /api/admin/dashboard/stats` - Dashboard statistics

### Ministry APIs
- `GET /api/ministry/complaints` - Get ministry complaints
- `POST /api/ministry/tenders` - Create tender
- `GET /api/ministry/tenders` - List tenders
- `GET /api/ministry/tenders/:id` - Get tender details
- `PATCH /api/ministry/tenders/:id/publish` - Publish tender
- `GET /api/ministry/bids` - View bids for tenders
- `POST /api/ministry/bids/:id/select` - Select winning bid

### Approval Workflow APIs
- `POST /api/approvals/tenders/:id/submit` - Submit for approval
- `GET /api/approvals/pending` - Get pending approvals
- `POST /api/approvals/tenders/:id/approve` - Approve tender
- `POST /api/approvals/tenders/:id/reject` - Reject tender
- `GET /api/approvals/history` - Approval history

### Contractor APIs
- `GET /api/contractor/tenders/available` - Browse open tenders
- `POST /api/contractor/tenders/:id/bid` - Submit bid
- `GET /api/contractor/bids` - My bids
- `GET /api/contractor/bids/:id` - Bid details
- `GET /api/contractor/projects` - My projects
- `POST /api/contractor/projects/:id/progress` - Update progress
- `POST /api/contractor/projects/:id/complete` - Mark complete

### Project Management APIs
- `GET /api/projects` - List projects
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id/assign` - Assign contractor
- `GET /api/projects/:id/progress` - Get progress history
- `POST /api/projects/:id/verify` - Verify completion

### Regional Manager APIs
- `GET /api/region/projects` - Projects in my region
- `GET /api/region/complaints` - Complaints in my region
- `POST /api/region/projects/:id/monitor` - Monitor project

## File Structure
```
backend/
├── config/
│   └── db.js
├── controllers/
│   ├── authController.js
│   ├── citizenController.js
│   ├── adminController.js
│   ├── ministryController.js
│   ├── approvalController.js
│   ├── contractorController.js
│   ├── projectController.js
│   └── regionController.js
├── middleware/
│   ├── auth.js
│   ├── upload.js
│   └── validation.js
├── models/
│   ├── User.js
│   ├── Ministry.js
│   ├── Department.js
│   ├── Region.js
│   ├── Contractor.js
│   ├── Complaint.js
│   ├── Tender.js
│   ├── Bid.js
│   ├── Project.js
│   ├── Progress.js
│   └── Verification.js
├── routes/
│   ├── auth.js
│   ├── citizen.js
│   ├── admin.js
│   ├── ministry.js
│   ├── approval.js
│   ├── contractor.js
│   ├── project.js
│   └── region.js
├── utils/
│   ├── generateToken.js
│   ├── generateId.js
│   └── email.js
├── uploads/
├── server.js
└── package.json
```

## Environment Variables
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/urbangrid
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=7d
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
```
