const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', protect, authController.logout);
router.post('/refresh', protect, authController.refresh);
router.get('/me', protect, authController.getMe);
router.get('/me/profile', protect, authController.getProfile);
router.patch('/me/profile', protect, authController.updateProfile);
router.get('/me/settings', protect, authController.getSettings);
router.patch('/me/settings', protect, authController.updateSettings);

module.exports = router;
