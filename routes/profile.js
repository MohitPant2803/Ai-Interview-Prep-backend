import { Router } from 'express';
import User from '../models/User.js';
import authenticate from '../middleware/auth.js';

const router = Router();

// GET /api/profile
router.get('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      name: user.name,
      email: user.email,
      picture: user.picture,
      geminiApiKey: user.geminiApiKey || '',
      resumeText: user.resumeText || '',
      cumulativeReport: user.cumulativeReport || null
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to retrieve profile details' });
  }
});

// POST /api/profile
router.post('/', authenticate, async (req, res) => {
  const { geminiApiKey, resumeText } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (geminiApiKey !== undefined) {
      user.geminiApiKey = geminiApiKey;
    }
    if (resumeText !== undefined) {
      user.resumeText = resumeText;
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      profile: {
        name: user.name,
        email: user.email,
        picture: user.picture,
        geminiApiKey: user.geminiApiKey,
        resumeText: user.resumeText,
        cumulativeReport: user.cumulativeReport
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile details' });
  }
});

export default router;
