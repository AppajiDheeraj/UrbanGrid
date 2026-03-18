const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ministryController = require('../controllers/ministryController');

router.get('/complaints', protect, authorize('ministry_officer', 'department_head', 'senior_official'), ministryController.getComplaints);
router.post('/tenders', protect, authorize('ministry_officer', 'department_head'), ministryController.createTender);
router.get('/tenders', protect, authorize('ministry_officer', 'department_head', 'senior_official'), ministryController.getTenders);
router.get('/tenders/:id', protect, authorize('ministry_officer', 'department_head', 'senior_official'), ministryController.getTender);
router.patch('/tenders/:id/publish', protect, authorize('ministry_officer', 'department_head'), ministryController.publishTender);
router.get('/tenders/:tenderId/bids', protect, authorize('ministry_officer', 'department_head', 'senior_official'), ministryController.getBids);
router.post('/tenders/:tenderId/bids/:bidId/select', protect, authorize('ministry_officer', 'department_head'), ministryController.selectBid);

module.exports = router;
