const express = require('express');
const { body, validationResult } = require('express-validator');
const UserProfile = require('../models/UserProfile');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /users/profile — get own profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    let profile = await UserProfile.findOne({ userId: req.user.id });
    if (!profile) {
      // Auto-create profile from gateway-provided data
      profile = await UserProfile.create({
        userId: req.user.id,
        name: req.headers['x-user-name'] || 'User',
        email: req.user.email,
      });
    }
    res.json(profile);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /users/profile — update own profile
router.put(
  '/profile',
  authenticate,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('bio').optional().isLength({ max: 500 }).withMessage('Bio too long'),
    body('phone').optional().trim(),
    body('department').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const allowed = ['name', 'bio', 'avatar', 'phone', 'department'];
      const updates = Object.fromEntries(
        Object.entries(req.body).filter(([k]) => allowed.includes(k))
      );

      const profile = await UserProfile.findOneAndUpdate(
        { userId: req.user.id },
        { $set: updates },
        { new: true, upsert: true, runValidators: true }
      );

      res.json({ message: 'Profile updated', profile });
    } catch (err) {
      console.error('Update profile error:', err);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// GET /users — list all users (admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      UserProfile.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
      UserProfile.countDocuments(),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// DELETE /users/:userId — delete user profile (admin only)
router.delete('/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const profile = await UserProfile.findOneAndDelete({ userId: req.params.userId });
    if (!profile) return res.status(404).json({ error: 'User profile not found' });
    res.json({ message: 'User profile deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
