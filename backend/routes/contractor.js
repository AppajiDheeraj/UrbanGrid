const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const contractorController = require('../controllers/contractorController');

router.get('/tenders/available', protect, authorize('contractor'), contractorController.getAvailableTenders);
router.post('/tenders/:tenderId/bid', protect, authorize('contractor'), upload.array('documents', 3), contractorController.submitBid);
router.get('/bids', protect, authorize('contractor'), contractorController.getMyBids);
router.get('/bids/:id', protect, authorize('contractor'), contractorController.getBid);
router.get('/projects', protect, authorize('contractor'), contractorController.getMyProjects);
router.post('/projects/:projectId/progress', protect, authorize('contractor'), upload.array('images', 5), contractorController.updateProgress);
router.post('/projects/:projectId/complete', protect, authorize('contractor'), upload.array('images', 5), contractorController.markComplete);

module.exports = router;
