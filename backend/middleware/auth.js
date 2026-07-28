/**
 * Auth Middleware - Protects routes that require authentication
 * 
 * HOW IT WORKS:
 * ============
 * 1. Frontend sends JWT token in Authorization header: "Bearer <token>"
 * 2. Middleware extracts the token from the header
 * 3. Verifies token using JWT_SECRET
 * 4. Decodes token to get userId
 * 5. Fetches user from database
 * 6. Attaches user to req.user so route handlers can access it
 * 7. If token invalid or missing → returns 401 Unauthorized
 * 
 * USAGE IN ROUTES:
 * ================
 * router.get('/protected-route', auth, (req, res) => {
 *   // req.user contains the logged-in user's data
 *   // req.user.role can be 'admin' or 'user'
 * });
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Step 1: Get token from Authorization header
    // Header format: "Bearer eyJhbGciOiJIUzI1NiIs..."
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided, authorization denied' });
    }

    // Extract the token (remove "Bearer " prefix)
    const token = authHeader.replace('Bearer ', '');

    // Step 2: Verify token using JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Step 3: Find user in database by userId from token
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid, user not found' });
    }

    // Step 4: Attach user to request object
    // Now any route using this middleware can access req.user
    req.user = user;
    
    // Step 5: Continue to the actual route handler
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;
