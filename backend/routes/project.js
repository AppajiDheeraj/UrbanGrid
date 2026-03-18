const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const projectController = require('../controllers/projectController');

router.get('/', protect, authorize('admin', 'ministry_officer', 'department_head', 'senior_official', 'regional_manager'), projectController.getProjects);
router.get('/:id', protect, authorize('admin', 'ministry_officer', 'department_head', 'senior_official', 'regional_manager'), projectController.getProject);
router.post('/:tenderId/assign/:bidId', protect, authorize('ministry_officer', 'department_head'), projectController.assignContractor);
router.get('/:id/progress', protect, authorize('admin', 'ministry_officer', 'department_head', 'senior_official', 'regional_manager'), projectController.getProgressHistory);
router.post('/:id/verify', protect, authorize('admin', 'senior_official'), upload.array('images', 5), projectController.verifyCompletion);

module.exports = router;
