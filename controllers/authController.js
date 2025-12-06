const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { sendOTPEmail } = require('../utils/emailService');

// Generate JWT Token
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });
};

// @desc    Register a new user and send OTP
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
    try {
        // Validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                errors: errors.array()
            });
        }

        const { name, email, password } = req.body;

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user && user.isVerified) {
            return res.status(400).json({
                status: 'error',
                message: 'User already exists with this email'
            });
        }

        // Create or update user
        if (user && !user.isVerified) {
            user.name = name;
            user.password = password;
        } else {
            user = new User({ name, email, password });
        }

        // Generate OTP
        const otp = user.generateOTP();
        await user.save();

        // Send OTP via email
        await sendOTPEmail(email, name, otp);

        res.status(201).json({
            status: 'success',
            message: 'OTP sent to your email. Please verify to complete signup.',
            data: { email, userId: user._id }
        });

    } catch (error) {
        console.error('Signup Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error. Please try again later.'
        });
    }
};

// @desc    Verify OTP and complete registration
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide email and OTP'
            });
        }

        // Find user with OTP
        const user = await User.findOne({ email }).select('+otp +otpExpire');

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Check if OTP is expired
        if (user.otpExpire < Date.now()) {
            return res.status(400).json({
                status: 'error',
                message: 'OTP has expired. Please request a new one.'
            });
        }

        // Check if OTP matches
        if (user.otp !== otp) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid OTP'
            });
        }

        // Mark user as verified
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpire = undefined;
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.status(200).json({
            status: 'success',
            message: 'Email verified successfully',
            data: {
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email
                }
            }
        });

    } catch (error) {
        console.error('Verify OTP Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error. Please try again later.'
        });
    }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide email'
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                status: 'error',
                message: 'User is already verified'
            });
        }

        // Generate new OTP
        const otp = user.generateOTP();
        await user.save();

        // Send OTP via email
        await sendOTPEmail(email, user.name, otp);

        res.status(200).json({
            status: 'success',
            message: 'OTP resent to your email'
        });

    } catch (error) {
        console.error('Resend OTP Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error. Please try again later.'
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide email and password'
            });
        }

        // Find user and include password
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password'
            });
        }

        // Check if user is verified
        if (!user.isVerified) {
            return res.status(401).json({
                status: 'error',
                message: 'Please verify your email first'
            });
        }

        // Check password
        const isPasswordMatch = await user.comparePassword(password);

        if (!isPasswordMatch) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid email or password'
            });
        }

        // Generate token
        const token = generateToken(user._id);

        res.status(200).json({
            status: 'success',
            message: 'Login successful',
            data: {
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email
                }
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error. Please try again later.'
        });
    }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(200).json({
            status: 'success',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    createdAt: user.createdAt
                }
            }
        });

    } catch (error) {
        console.error('Get Me Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error. Please try again later.'
        });
    }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res) => {
    try {
        const { name, email } = req.body;

        // Create update object
        const fieldsToUpdate = {
            name,
            email
        };

        const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            status: 'success',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    createdAt: user.createdAt
                }
            }
        });
    } catch (error) {
        console.error('Update Details Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error. Please try again later.'
        });
    }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Get user from database with password
        const user = await User.findById(req.user.id).select('+password');

        // Check current password
        if (!(await user.comparePassword(currentPassword))) {
            return res.status(401).json({
                status: 'error',
                message: 'Incorrect current password'
            });
        }

        user.password = newPassword;
        await user.save();

        // Send new token
        const token = generateToken(user._id);

        res.status(200).json({
            status: 'success',
            token,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Update Password Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error. Please try again later.'
        });
    }
};
