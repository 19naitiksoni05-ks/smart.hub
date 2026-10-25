const express = require('express');
const router = express.Router();
const db = require('../db');
const { authOptional } = require('../middleware/auth');

// ── Get Conversations / Threads ──────────────────────────────
router.get(['/conversations', '/threads', '/'], (req, res) => {
  try {
    const convs = db.get('conversations') || [];
    res.json({ success: true, count: convs.length, conversations: convs, threads: convs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
  }
});

// ── Get Messages for Conversation ────────────────────────────
router.get('/messages/:convId', (req, res) => {
  try {
    const convId = req.params.convId;
    const messages = db.find('chatMessages', m => m.conversationId === convId);
    res.json({ success: true, count: messages.length, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// ── Send Message ─────────────────────────────────────────────
router.post('/messages', authOptional, (req, res) => {
  try {
    const { conversationId = 'chat_001', text, attachment } = req.body;

    if (!text && !attachment) {
      return res.status(400).json({ success: false, error: 'Message content or attachment is required' });
    }

    const user = req.user || null;

    const newMsg = {
      id: 'm_' + Date.now(),
      conversationId,
      from: 'me',
      senderName: user ? user.name : 'User',
      senderAvatar: user ? user.avatar : 'https://api.dicebear.com/7.x/avataaars/svg?seed=user&backgroundColor=6366f1',
      text: text ? text.trim() : '',
      attachment: attachment || null,
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      sent: true,
      createdAt: new Date().toISOString()
    };

    db.insert('chatMessages', newMsg);

    // Update conversation lastMessage
    const conv = db.findById('conversations', conversationId);
    if (conv) {
      db.update('conversations', conversationId, {
        lastMessage: text || (attachment ? `📎 Attachment` : ''),
        lastMessageTime: newMsg.time
      });
    }

    // Broadcast via global WebSocket broadcaster if available
    if (req.app.get('broadcastWs')) {
      req.app.get('broadcastWs')({
        type: 'CHAT_MESSAGE',
        conversationId,
        message: newMsg
      });
    }

    // Interactive automated realistic response simulation
    setTimeout(() => {
      let replyText = "Got it! Thanks for reaching out. Let me know if you need any technical documentation or integration help!";
      const lower = (text || '').toLowerCase();
      if (lower.includes('license') || lower.includes('commercial')) {
        replyText = "Yes, all Smart Hub purchases include full commercial licenses for unlimited production applications! 🚀";
      } else if (lower.includes('key') || lower.includes('token')) {
        replyText = "Your encryption unlock key is cryptographically signed and stored in your profile assets tab.";
      } else if (lower.includes('price') || lower.includes('discount')) {
        replyText = "Use coupon OUTLINE10 at checkout for an instant 10% off your purchase!";
      }

      const autoReply = {
        id: 'm_reply_' + Date.now(),
        conversationId,
        from: conv ? conv.name : 'Smart Hub Creator',
        senderName: conv ? conv.name : 'Smart Hub Creator',
        avatar: conv ? conv.avatar : 'https://api.dicebear.com/7.x/avataaars/svg?seed=creator&backgroundColor=6366f1',
        text: replyText,
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        sent: false,
        createdAt: new Date().toISOString()
      };

      db.insert('chatMessages', autoReply);
      if (conv) {
        db.update('conversations', conversationId, {
          lastMessage: replyText,
          lastMessageTime: autoReply.time
        });
      }

      if (req.app.get('broadcastWs')) {
        req.app.get('broadcastWs')({
          type: 'CHAT_MESSAGE',
          conversationId,
          message: autoReply
        });
      }
    }, 1200);

    res.status(201).json({
      success: true,
      message: 'Message sent',
      chatMessage: newMsg
    });
  } catch (err) {
    console.error('Chat message send error:', err);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// ── Start New Direct Conversation ────────────────────────────
router.post('/new-dm', authOptional, (req, res) => {
  try {
    const { contactName, contactAvatar } = req.body;
    if (!contactName) {
      return res.status(400).json({ success: false, error: 'Contact name is required' });
    }

    const newConv = {
      id: 'chat_' + Date.now(),
      type: 'dm',
      name: contactName,
      avatar: contactAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(contactName)}&backgroundColor=6366f1`,
      isOnline: true,
      lastMessage: 'Conversation started',
      lastMessageTime: 'Just now',
      unread: 0,
      verified: true
    };

    db.insert('conversations', newConv);

    res.status(201).json({
      success: true,
      conversation: newConv
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
  }
});

module.exports = router;
