const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.get('/complaints/pending', protect, authorize('admin'), adminController.getPendingComplaints);
router.get('/complaints/all', protect, authorize('admin'), adminController.getAllComplaints);
router.patch('/complaints/:id/verify', protect, authorize('admin'), adminController.verifyComplaint);
router.patch('/complaints/:id/reject', protect, authorize('admin'), adminController.rejectComplaint);
router.post('/complaints/:id/route', protect, authorize('admin'), adminController.routeComplaint);
router.get('/dashboard/stats', protect, authorize('admin'), adminController.getDashboardStats);
router.post('/reports/generate', protect, authorize('admin'), adminController.generateReport);
router.get('/reports', protect, authorize('admin'), adminController.getReports);
router.get('/reports/:id', protect, authorize('admin'), adminController.getReport);
router.get('/alerts', protect, authorize('admin'), adminController.getAlerts);
router.patch('/alerts/:id/resolve', protect, authorize('admin'), adminController.resolveAlert);

module.exports = router;
