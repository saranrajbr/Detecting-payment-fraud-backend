const express = require('express');
const router = express.Router();
const { register, login, resetPassword, getProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/reset-password', resetPassword);
router.get('/profile', protect, getProfile);

module.exports = router;
