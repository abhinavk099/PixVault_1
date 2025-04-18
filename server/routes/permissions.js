const express = require('express');
const router = express.Router();
const { User, Permission } = require('../models/user');
const { authenticateJWT, checkRole } = require('../middleware/auth');

/**
 * @route   GET /permissions
 * @desc    Get user permissions
 * @access  Private
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('permissions');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Could not find user permissions'
      });
    }

    res.json({
      role: user.role,
      permissions: user.permissions
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch permissions'
    });
  }
});

/**
 * @route   GET /permissions/all
 * @desc    Get all available permissions
 * @access  Private/Admin
 */
router.get('/all', authenticateJWT, checkRole(['admin']), async (req, res) => {
  try {
    const permissions = await Permission.find();
    res.json(permissions);
  } catch (error) {
    console.error('Error fetching all permissions:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch permissions list'
    });
  }
});

/**
 * @route   POST /permissions/grant
 * @desc    Grant permissions to a user
 * @access  Private/Admin
 */
router.post('/grant', authenticateJWT, checkRole(['admin']), async (req, res) => {
  try {
    const { userId, permissions } = req.body;

    if (!userId || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'User ID and permissions array required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Could not find user to grant permissions'
      });
    }

    // Add new permissions
    const uniquePermissions = new Set([...user.permissions.map(p => p.toString()), ...permissions]);
    user.permissions = Array.from(uniquePermissions);
    await user.save();

    res.json({
      message: 'Permissions granted successfully',
      permissions: user.permissions
    });
  } catch (error) {
    console.error('Error granting permissions:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to grant permissions'
    });
  }
});

/**
 * @route   POST /permissions/revoke
 * @desc    Revoke permissions from a user
 * @access  Private/Admin
 */
router.post('/revoke', authenticateJWT, checkRole(['admin']), async (req, res) => {
  try {
    const { userId, permissions } = req.body;

    if (!userId || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'User ID and permissions array required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Could not find user to revoke permissions'
      });
    }

    // Remove specified permissions
    user.permissions = user.permissions.filter(p => !permissions.includes(p.toString()));
    await user.save();

    res.json({
      message: 'Permissions revoked successfully',
      permissions: user.permissions
    });
  } catch (error) {
    console.error('Error revoking permissions:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to revoke permissions'
    });
  }
});

module.exports = router;
