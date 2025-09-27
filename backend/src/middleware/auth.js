import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Middleware to authenticate JWT token
 */
export const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header or query string
    let token = req.header('Authorization')?.replace('Bearer ', '');
    
    // If no token in header, check query string (for SSE connections)
    if (!token && req.query.token) {
      token = req.query.token;
    }
    
    if (!token) {
      console.log('No token provided in request');
      return res.status(401).json({ 
        success: false,
        message: 'No authentication token, access denied' 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'devdeck-secret-key');
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token',
        error: jwtError.message 
      });
    }
    
    // Find user and attach to request
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      console.log('User not found for token');
      return res.status(401).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Attach user to request
    req.user = { 
      userId: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      username: user.username
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during authentication',
      error: error.message 
    });
  }
};

/**
 * Middleware to check user role
 */
export const checkRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    next();
  };
};
