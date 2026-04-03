const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');
const { validatePinCode, validateCoordinates } = require('../middleware/validation');
const auditMiddleware = require('../middleware/audit');
const citizenController = require('../controllers/citizenController');

router.post('/',
  protect,
  authorize('citizen'),
  validatePinCode,
  validateCoordinates,
  auditMiddleware('COMPLAINT_SUBMIT'),
  uploadMultiple('images', 5),
  citizenController.submitComplaint
);

router.get('/my',
  protect,
  authorize('citizen'),
  auditMiddleware('COMPLAINTS_VIEW'),
  citizenController.getMyComplaints
);

router.get('/:id',
  protect,
  authorize('citizen'),
  auditMiddleware('COMPLAINT_VIEW'),
  citizenController.getComplaint
);

router.get('/:id/status',
  protect,
  authorize('citizen'),
  auditMiddleware('COMPLAINT_STATUS_CHECK'),
  citizenController.trackStatus
);

module.exports = router;
