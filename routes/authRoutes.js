const express = require('express');
const router = express.Router();
const { register, login, resetPassword, getProfile, updatePassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/reset-password', resetPassword);
router.get('/profile', protect, getProfile);
router.patch('/update-password', protect, updatePassword);

module.exports = router;
