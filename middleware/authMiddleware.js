const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
    try {
        let token;

        // Check for token in headers
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'Not authorized. Please login.'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'User not found'
            });
        }

        if (!user.isVerified) {
            return res.status(401).json({
                status: 'error',
                message: 'Please verify your email'
            });
        }

        req.user = user;
        next();

    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(401).json({
            status: 'error',
            message: 'Not authorized. Invalid token.'
        });
    }
};
