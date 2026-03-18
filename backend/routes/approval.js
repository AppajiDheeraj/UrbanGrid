const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const approvalController = require('../controllers/approvalController');

router.post('/tenders/:id/submit', protect, authorize('ministry_officer', 'department_head'), approvalController.submitForApproval);
router.get('/pending', protect, authorize('department_head', 'senior_official'), approvalController.getPendingApprovals);
router.post('/tenders/:id/approve', protect, authorize('department_head', 'senior_official'), approvalController.approveTender);
router.post('/tenders/:id/reject', protect, authorize('department_head', 'senior_official'), approvalController.rejectTender);
router.get('/history', protect, authorize('department_head', 'senior_official'), approvalController.getApprovalHistory);

module.exports = router;
