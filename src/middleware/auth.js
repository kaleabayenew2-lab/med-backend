const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // Check if the authorization header exists
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    // Extract the token
    const token = authHeader.split(' ')[1];

    // Verify the token
    const secret = process.env.JWT_SECRET || 'dev_secret';
    const decoded = jwt.verify(token, secret);

    // Attach decoded user info to request
    req.user = decoded;
    
    // Proceed to next middleware
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};
