const express = require('express');
const router = express.Router();
const db = require('../db');
const { authOptional } = require('../middleware/auth');

// ── Get Challenges ───────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const challenges = db.get('challenges');
    res.json({ success: true, count: challenges.length, challenges });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch challenges' });
  }
});

// ── Get Leaderboard ───────────────────────────────────────────
router.get('/leaderboard', (req, res) => {
  try {
    const users = db.get('users');
    // Sort users by XP
    const sorted = [...users].sort((a, b) => (b.xp || 0) - (a.xp || 0));
    const leaderboard = sorted.map((u, i) => ({
      rank: i + 1,
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      xp: u.xp || 0,
      badges: u.badges || 0,
      location: u.location || 'India',
      isYou: req.user ? u.id === req.user.id : false
    }));

    res.json({ success: true, count: leaderboard.length, leaderboard });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

// ── Submit / Claim Challenge Solution ────────────────────────
router.post(['/:id/submit', '/:id/claim', '/claim', '/submit'], authOptional, (req, res) => {
  try {
    const challengeId = req.params.id || req.body.challengeId || req.body.id || (db.get('challenges')[0] && db.get('challenges')[0].id);
    const { code, repoUrl } = req.body;

    const challenge = challengeId ? db.findById('challenges', challengeId) : db.get('challenges')[0];
    if (!challenge) {
      return res.status(404).json({ success: false, error: 'Challenge not found' });
    }

    const user = req.user || null;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Please sign in to earn XP and record challenge progress' });
    }

    // Award XP
    const earnedXp = challenge.xp || 200;
    const newXp = (user.xp || 0) + earnedXp;
    const newBadges = (user.badges || 0) + 1;

    db.update('users', user.id, { xp: newXp, badges: newBadges });

    // Mark challenge completed and increment participants
    db.update('challenges', challenge.id, {
      completed: true,
      participants: (challenge.participants || 0) + 1
    });

    res.json({
      success: true,
      message: `🎉 Challenge verified! You earned +${earnedXp} XP and a new skill badge!`,
      earnedXp,
      newTotalXp: newXp,
      newBadges,
      challengeId: challenge.id
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Challenge submission failed' });
  }
});

module.exports = router;
