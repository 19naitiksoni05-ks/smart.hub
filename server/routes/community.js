const express = require('express');
const router = express.Router();
const db = require('../db');
const { authOptional } = require('../middleware/auth');

// ── Get All Community Channels ────────────────────────────────
router.get('/channels', (req, res) => {
  try {
    const channels = db.get('channels');
    res.json({ success: true, count: channels.length, channels });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch channels' });
  }
});

// ── Get Channel Messages ──────────────────────────────────────
router.get('/channels/:id/messages', (req, res) => {
  try {
    const channelId = req.params.id;
    const messages = db.find('channelMessages', m => m.channelId === channelId);
    res.json({ success: true, count: messages.length, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch channel messages' });
  }
});

// ── Post Message to Channel ───────────────────────────────────
router.post('/channels/:id/messages', authOptional, (req, res) => {
  try {
    const channelId = req.params.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Message text is required' });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Please sign in to post messages to channels' });
    }

    const newMsg = {
      id: 'cm_' + Date.now(),
      channelId,
      author: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        role: user.role === 'developer' ? 'Creator' : 'Member'
      },
      text: text.trim(),
      reactions: { '🔥': 1 },
      createdAt: new Date().toISOString()
    };

    db.insert('channelMessages', newMsg);

    // Broadcast WebSocket
    if (req.app.get('broadcastWs')) {
      req.app.get('broadcastWs')({
        type: 'CHANNEL_MESSAGE',
        channelId,
        message: newMsg
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message posted to channel',
      channelMessage: newMsg
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to post message' });
  }
});

// ── React to Message ──────────────────────────────────────────
router.post('/messages/:id/react', (req, res) => {
  try {
    const msgId = req.params.id;
    const { emoji = '🔥' } = req.body;

    const msg = db.findById('channelMessages', msgId);
    if (!msg) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    if (!msg.reactions) msg.reactions = {};
    msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1;

    db.update('channelMessages', msg.id, { reactions: msg.reactions });

    res.json({ success: true, reactions: msg.reactions });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to react to message' });
  }
});

module.exports = router;
