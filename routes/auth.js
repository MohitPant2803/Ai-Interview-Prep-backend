import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Google credential (ID Token) is required' });
  }

  try {
    // Verify Google ID Token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Find or create user in MongoDB
    let user = await User.findOne({ googleId });
    if (!user) {
      user = new User({
        googleId,
        email,
        name,
        picture,
      });
      await user.save();
    }

    // Create a local JWT session token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback_secret_online_interviewer',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        geminiApiKey: user.geminiApiKey || '',
        resumeText: user.resumeText || '',
        hasCumulativeReport: !!user.cumulativeReport
      }
    });
  } catch (error) {
    console.error('Google Authentication Error:', error);
    res.status(401).json({ error: 'Invalid Google Token or authentication failed' });
  }
});

export default router;
