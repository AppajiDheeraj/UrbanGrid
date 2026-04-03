const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const regionController = require('../controllers/regionController');

router.get('/projects', protect, authorize('regional_manager'), regionController.getRegionProjects);
router.get('/complaints', protect, authorize('regional_manager'), regionController.getRegionComplaints);
router.get('/projects/:id/monitor', protect, authorize('regional_manager'), regionController.monitorProject);
router.post('/projects/:id/monitor', protect, authorize('regional_manager'), regionController.monitorProject);

module.exports = router;
