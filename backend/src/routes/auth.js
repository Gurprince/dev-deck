import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Register a new user
router.post('/register', async (req, res, next) => {
  try {
    console.log('Register request headers:', JSON.stringify(req.headers, null, 2));
    console.log('Register request body:', req.body);
    
    // Check if request body exists and is an object
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      console.error('Invalid request body:', req.body);
      return res.status(400).json({ 
        success: false,
        message: 'Invalid request body',
        received: req.body || 'No body received'
      });
    }
    
    const { username, email, password } = req.body;
    
    // Validate required fields with detailed error messages
    const errors = {};
    
    if (!username || typeof username !== 'string' || username.trim() === '') {
      errors.username = 'Username is required and must be a non-empty string';
    } else if (username.length < 3 || username.length > 30) {
      errors.username = 'Username must be between 3 and 30 characters';
    }
    
    if (!email || typeof email !== 'string' || email.trim() === '') {
      errors.email = 'Email is required and must be a non-empty string';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
    }
    
    if (!password || typeof password !== 'string' || password.trim() === '') {
      errors.password = 'Password is required and must be a non-empty string';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }
    
    if (Object.keys(errors).length > 0) {
      console.error('Validation errors:', errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Invalid email format:', email);
      return res.status(400).json({ 
        message: 'Please enter a valid email address',
        field: 'email',
        value: email
      });
    }
    
    // Validate password length
    if (password.length < 8) {
      console.error('Password too short');
      return res.status(400).json({ 
        message: 'Password must be at least 8 characters long',
        field: 'password',
        minLength: 8,
        actualLength: password.length
      });
    }
    
    // Validate username format
    if (username.length < 3 || username.length > 30) {
      console.error('Invalid username length:', username.length);
      return res.status(400).json({
        message: 'Username must be between 3 and 30 characters',
        field: 'username',
        minLength: 3,
        maxLength: 30,
        actualLength: username.length
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User already exists',
        field: existingUser.email === email ? 'email' : 'username'
      });
    }

    // Create new user
    const user = new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: password.trim(),
      name: username.trim() // Use username as the default name
    });

    await user.save();

    // Generate JWT with user details
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        name: user.name || user.username,
        username: user.username
      },
      process.env.JWT_SECRET || 'devdeck-secret-key',
      { expiresIn: '7d' }
    );

    // Omit password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    // Send response with token and user data
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name || user.username
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = {};
      Object.keys(error.errors).forEach(key => {
        errors[key] = error.errors[key].message;
      });
      return res.status(400).json({ 
        message: 'Validation failed',
        errors 
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field} already in use`,
        field
      });
    }
    
    next(error);
  }
});

// Login user
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT with user details
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        name: user.name || user.username, // Fallback to username if name is not set
        username: user.username
      },
      process.env.JWT_SECRET || 'devdeck-secret-key',
      { expiresIn: '7d' }
    );

    res.json({ 
      token, 
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email,
        name: user.name || user.username
      } 
    });
  } catch (error) {
    next(error);
  }
});

// Logout (stateless)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

// Get current user
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
