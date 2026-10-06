const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { verifyLimiter, loginLimiter } = require('../middleware/rateLimiters');
const verify = require('../controllers/verifyController');
const auth = require('../controllers/authController');
const admin = require('../controllers/adminController');

const router = express.Router();

// Public
router.post('/codes/verify', verifyLimiter, verify.verifyCode);

// Auth
router.post('/auth/login', loginLimiter, auth.login);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', requireAdmin, auth.me);
router.post('/auth/change-password', requireAdmin, auth.changePassword);

// Admin (every route below requires a valid admin session)
router.use('/admin', requireAdmin);
router.get('/admin/stats', admin.stats);
router.get('/admin/codes/export', admin.exportCodes); // must precede /codes/:id
router.post('/admin/codes/generate', admin.generateCodes);
router.get('/admin/codes', admin.listCodes);
router.post('/admin/codes', admin.addCode);
router.delete('/admin/codes/:id', admin.deleteCode);
router.get('/admin/batches', admin.listBatches);

module.exports = router;
