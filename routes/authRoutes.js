const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

// ১. সাইন-আপ বা রেজিস্ট্রেশন রুট (POST /api/auth/register)
router.post('/register', register);

// ২. লগইন রুট (POST /api/auth/login)
router.post('/login', login);

module.exports = router;