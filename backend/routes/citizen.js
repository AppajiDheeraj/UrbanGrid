const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');
const { validatePinCode, validateCoordinates } = require('../middleware/validation');
const auditMiddleware = require('../middleware/audit');
const citizenController = require('../controllers/citizenController');

router.post('/complaints', 
  protect, 
  authorize('citizen'), 
  uploadMultiple('images', 5), 
  validatePinCode,
  validateCoordinates,
  auditMiddleware('COMPLAINT_SUBMIT'),
  citizenController.submitComplaint
);
router.get('/complaints/ward', 
  protect, 
  authorize('citizen'), 
  auditMiddleware('WARD_COMPLAINTS_VIEW'),
  citizenController.getWardComplaints
);
router.get('/complaints/my', 
  protect, 
  authorize('citizen'), 
  auditMiddleware('COMPLAINTS_VIEW'),
  citizenController.getMyComplaints
);
router.post('/complaints/:id/vote', 
  protect, 
  authorize('citizen'), 
  auditMiddleware('COMPLAINT_VOTE'),
  citizenController.voteComplaint
);
router.get('/complaints/ward/:id', 
  protect, 
  authorize('citizen'), 
  auditMiddleware('WARD_COMPLAINT_VIEW'),
  citizenController.getComplaint
);
router.get('/complaints/:id', 
  protect, 
  authorize('citizen'), 
  auditMiddleware('COMPLAINT_VIEW'),
  citizenController.getComplaint
);
router.get('/complaints/:id/status', 
  protect, 
  authorize('citizen'), 
  auditMiddleware('COMPLAINT_STATUS_CHECK'),
  citizenController.trackStatus
);

module.exports = router;
