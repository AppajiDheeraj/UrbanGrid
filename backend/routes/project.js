const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const projectController = require('../controllers/projectController');

router.get('/', protect, authorize('admin', 'ministry_officer', 'department_head', 'senior_official', 'regional_manager'), projectController.getProjects);
router.get('/:id', protect, authorize('admin', 'ministry_officer', 'department_head', 'senior_official', 'regional_manager'), projectController.getProject);
router.patch('/:id/assign', protect, authorize('ministry_officer', 'department_head'), (req, res, next) => {
  if (!req.body.bidId) {
    return res.status(400).json({ message: 'bidId is required' });
  }

  req.params.tenderId = req.params.id;
  req.params.bidId = req.body.bidId;
  return projectController.assignContractor(req, res, next);
});
router.post('/:tenderId/assign/:bidId', protect, authorize('ministry_officer', 'department_head'), projectController.assignContractor);
router.get('/:id/progress', protect, authorize('admin', 'ministry_officer', 'department_head', 'senior_official', 'regional_manager'), projectController.getProgressHistory);
router.post('/:id/verify', protect, authorize('admin', 'senior_official'), upload.array('images', 5), projectController.verifyCompletion);
router.get('/:id/milestones', protect, authorize('admin', 'ministry_officer', 'department_head', 'senior_official', 'regional_manager'), projectController.getMilestones);
router.put('/:id/milestones', protect, authorize('admin', 'ministry_officer', 'department_head', 'senior_official', 'regional_manager'), projectController.updateMilestones);

module.exports = router;
