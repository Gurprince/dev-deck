import express from 'express';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Search users by username/email (for invites)
router.get('/search', authenticateToken, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({ $or: [{ username: regex }, { email: regex }] })
      .select('_id username email avatar')
      .limit(10);
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Get user profile
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const currentUserId = req.user.userId?.toString();
    if (currentUserId !== req.params.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const currentUserId = req.user.userId?.toString();
    if (currentUserId !== req.params.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const allowed = ['username', 'email', 'avatar'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    // Handle duplicate key error for unique fields
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `${field} already in use`, field });
    }
    next(error);
  }
});

export default router;


