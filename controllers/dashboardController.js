const User = require('../models/User');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
exports.getStats = async (req, res) => {
    try {
        // Real data: Count users
        const userCount = await User.countDocuments();

        // Mock data for other stats (as we don't have Order/Revenue models yet)
        const stats = {
            revenue: {
                value: '$45,231.89',
                change: '+20.1% from last month'
            },
            activeUsers: {
                value: userCount.toString(), // Real count
                change: '+5% from last month'
            },
            sales: {
                value: '+12,234',
                change: '+19% from last month'
            },
            activeNow: {
                value: '+573',
                change: '+201 since last hour'
            }
        };

        res.status(200).json({
            status: 'success',
            data: stats
        });

    } catch (error) {
        console.error('Get Stats Error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error. Please try again later.'
        });
    }
};
