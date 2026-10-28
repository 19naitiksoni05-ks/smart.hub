const express = require('express');
const router = express.Router();
const db = require('../db');
const { supabase, isConfigured: isSupabaseConfigured } = require('../supabase');
const { authOptional } = require('../middleware/auth');

// ── Get Conversations / Threads ──────────────────────────────
router.get(['/conversations', '/threads', '/'], authOptional, async (req, res) => {
  try {
    const user = req.user || null;
    const myId = user ? (user.id || user.username) : null;
    const myUsername = user ? (user.username || '').replace('@', '').toLowerCase() : null;

    let convMap = new Map();

    // 1. Fetch conversations from Supabase if configured
    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .not('id', 'like', 'otp:%')
          .order('last_message_time', { ascending: false });

        if (!error && data) {
          data.forEach(c => {
            convMap.set(c.id, {
              id: c.id,
              name: c.name || 'Direct Chat',
              is_group: !!c.is_group,
              last_message: c.last_message || 'Conversation started',
              last_message_time: c.last_message_time,
              unread_count: c.unread_count || 0,
              participant_ids: Array.isArray(c.participant_ids) ? c.participant_ids : [],
              created_at: c.created_at
            });
          });
        }
      } catch (sbErr) {
        console.warn('[Chat] Supabase get conversations warning:', sbErr.message);
      }
    }

    // 2. Merge local db conversations
    try {
      const localConvs = (db.get('conversations') || []).filter(c => !String(c.id).startsWith('otp:'));
      localConvs.forEach(lc => {
        if (!convMap.has(lc.id)) {
          convMap.set(lc.id, {
            id: lc.id,
            name: lc.name || 'Direct Chat',
            is_group: lc.type === 'groups',
            last_message: lc.lastMessage || 'Conversation started',
            last_message_time: lc.lastMessageTime || new Date().toISOString(),
            unread_count: lc.unread || 0,
            participant_ids: lc.participant_ids || [],
            avatar: lc.avatar,
            type: lc.type || 'dm'
          });
        }
      });
    } catch (e) {}

    // 3. Format and personalize for the current user
    const formatted = Array.from(convMap.values()).map(c => {
      const participants = Array.isArray(c.participant_ids) ? c.participant_ids : [];
      let displayName = c.name;
      let displayAvatar = c.avatar;

      // If DM between two users, show the OTHER user's name to the viewer
      if (!c.is_group && participants.length > 0 && (myId || myUsername)) {
        const otherParticipant = participants.find(p => {
          const cleanP = String(p).replace('@', '').toLowerCase();
          return cleanP !== myUsername && p !== myId;
        });
        if (otherParticipant) {
          displayName = otherParticipant.startsWith('@') ? otherParticipant : '@' + otherParticipant;
          displayAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=6366f1`;
        }
      }

      if (!displayAvatar) {
        displayAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName || c.id)}&backgroundColor=6366f1`;
      }

      const timeStr = c.last_message_time
        ? new Date(c.last_message_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : 'Just now';

      return {
        id: c.id,
        name: displayName || 'Chat',
        avatar: displayAvatar,
        lastMsg: c.last_message || 'Conversation started',
        time: timeStr,
        unread: c.unread_count || 0,
        type: c.is_group ? 'groups' : 'dm',
        online: true,
        participant_ids: participants
      };
    });

    res.json({ success: true, count: formatted.length, conversations: formatted, threads: formatted });
  } catch (err) {
    console.error('[Chat] Get conversations error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
  }
});

// ── Get Messages for Conversation ────────────────────────────
router.get('/messages/:convId', authOptional, async (req, res) => {
  try {
    const convId = req.params.convId;
    const user = req.user || null;
    const myId = user ? (user.id || user.username) : null;
    const myUsername = user ? (user.username || '').replace('@', '').toLowerCase() : null;

    let messages = [];

    // 1. Fetch from Supabase if configured
    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          messages = data.map(m => {
            let parsed = null;
            if (m.message && typeof m.message === 'string' && m.message.trim().startsWith('{')) {
              try { parsed = JSON.parse(m.message); } catch (e) {}
            }

            const senderIdentifier = m.sender_id || (parsed && parsed.senderId) || '';
            const cleanSender = String(senderIdentifier).replace('@', '').toLowerCase();
            const isMe = myId
              ? (senderIdentifier === myId || cleanSender === myUsername || (user && user.id === senderIdentifier))
              : false;

            const timeStr = m.created_at
              ? new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              : 'Just now';

            return {
              id: m.id,
              conversationId: m.conversation_id,
              senderId: senderIdentifier,
              receiverId: m.receiver_id,
              from: isMe ? 'me' : (parsed && parsed.senderName ? parsed.senderName : senderIdentifier),
              senderName: parsed && parsed.senderName ? parsed.senderName : (isMe ? 'You' : senderIdentifier),
              avatar: parsed && parsed.senderAvatar
                ? parsed.senderAvatar
                : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(senderIdentifier || 'user')}&backgroundColor=6366f1`,
              text: parsed ? (parsed.text || '') : (m.message || ''),
              type: parsed ? (parsed.type || 'text') : (m.media_url ? 'file' : 'text'),
              fileUrl: parsed ? parsed.fileUrl : m.media_url,
              fileName: parsed ? parsed.fileName : null,
              fileSize: parsed ? parsed.fileSize : null,
              code: parsed ? parsed.code : null,
              lang: parsed ? parsed.lang : null,
              title: parsed ? parsed.title : null,
              prodId: parsed ? parsed.prodId : null,
              time: parsed && parsed.time ? parsed.time : timeStr,
              sent: isMe,
              createdAt: m.created_at
            };
          });
        }
      } catch (sbErr) {
        console.warn('[Chat] Supabase get messages warning:', sbErr.message);
      }
    }

    // 2. Fallback to local db if Supabase returned 0 messages
    if (messages.length === 0) {
      const localMsgs = db.find('chatMessages', m => m.conversationId === convId) || [];
      messages = localMsgs.map(m => {
        const senderIdentifier = m.senderId || m.from || '';
        const cleanSender = String(senderIdentifier).replace('@', '').toLowerCase();
        const isMe = myId
          ? (senderIdentifier === myId || cleanSender === myUsername || m.from === 'me')
          : (m.from === 'me');

        return {
          ...m,
          sent: isMe,
          from: isMe ? 'me' : (m.senderName || senderIdentifier)
        };
      });
    }

    res.json({ success: true, count: messages.length, messages });
  } catch (err) {
    console.error('[Chat] Get messages error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// ── Send Message ─────────────────────────────────────────────
router.post('/messages', authOptional, async (req, res) => {
  try {
    const {
      conversationId = 'chat_general',
      text = '',
      recipientId,
      recipientUsername,
      attachment,
      type = 'text',
      code,
      lang,
      title,
      prodId
    } = req.body;

    if (!text && !attachment && !code && !prodId) {
      return res.status(400).json({ success: false, error: 'Message content, code, or attachment is required' });
    }

    const user = req.user || null;
    const senderId = user ? (user.id || user.username) : 'guest_' + Date.now();
    const senderName = user ? (user.name || user.username) : 'Guest User';
    const senderAvatar = user
      ? (user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(senderId)}&backgroundColor=6366f1`)
      : 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest&backgroundColor=6366f1';

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const msgId = 'm_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    const richMessage = {
      id: msgId,
      conversationId,
      senderId,
      senderName,
      senderAvatar,
      text: text ? text.trim() : '',
      type,
      attachment: attachment || null,
      code: code || null,
      lang: lang || null,
      title: title || null,
      prodId: prodId || null,
      time: timeStr,
      sent: true,
      createdAt: now.toISOString()
    };

    // Text representation for Supabase column 'message'
    const storedMessageText = (type && type !== 'text') || attachment
      ? JSON.stringify(richMessage)
      : (text ? text.trim() : 'Attachment');

    // 1. Persist to Supabase if configured
    if (supabase && isSupabaseConfigured()) {
      try {
        const participants = [senderId];
        if (recipientId && !participants.includes(recipientId)) participants.push(recipientId);
        if (recipientUsername && !participants.includes(recipientUsername)) participants.push(recipientUsername);

        // Ensure conversation exists
        await supabase.from('conversations').upsert([{
          id: conversationId,
          participant_ids: participants,
          name: recipientUsername || 'Direct Conversation',
          last_message: text ? text.trim() : (attachment ? '📎 Attachment' : 'Message'),
          last_message_time: now.toISOString(),
          unread_count: 0
        }], { onConflict: 'id' });

        // Insert message
        await supabase.from('chat_messages').insert([{
          id: msgId,
          conversation_id: conversationId,
          sender_id: senderId,
          receiver_id: recipientId || null,
          message: storedMessageText,
          media_url: attachment || null,
          status: 'sent',
          created_at: now.toISOString()
        }]);
      } catch (sbErr) {
        console.warn('[Chat] Supabase save error:', sbErr.message);
      }
    }

    // 2. Persist to local JSON DB
    try {
      db.insert('chatMessages', {
        ...richMessage,
        from: senderName
      });

      const existingConv = db.findById('conversations', conversationId);
      if (existingConv) {
        db.update('conversations', conversationId, {
          lastMessage: text ? text.trim() : (attachment ? '📎 Attachment' : 'Message'),
          lastMessageTime: timeStr
        });
      } else {
        db.insert('conversations', {
          id: conversationId,
          type: 'dm',
          name: recipientUsername || senderName,
          lastMessage: text ? text.trim() : (attachment ? '📎 Attachment' : 'Message'),
          lastMessageTime: timeStr,
          participant_ids: [senderId, recipientId || recipientUsername].filter(Boolean)
        });
      }
    } catch (dbErr) {}

    // 3. Broadcast live message via WebSocket if available
    if (req.app.get('broadcastWs')) {
      try {
        req.app.get('broadcastWs')({
          type: 'CHAT_MESSAGE',
          conversationId,
          message: richMessage
        });
      } catch (wsErr) {}
    }

    return res.status(201).json({
      success: true,
      message: 'Message sent',
      chatMessage: richMessage
    });
  } catch (err) {
    console.error('[Chat] Message send error:', err);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// ── Start New Direct Conversation ────────────────────────────
router.post('/new-dm', authOptional, async (req, res) => {
  try {
    const { contactName, contactAvatar, contactId } = req.body;
    if (!contactName) {
      return res.status(400).json({ success: false, error: 'Contact name is required' });
    }

    const user = req.user || null;
    const myId = user ? (user.username || user.id || 'me').replace('@', '').toLowerCase() : 'me';
    const targetId = (contactId || contactName).replace('@', '').toLowerCase();

    // Canonical direct conversation ID
    const convId = 'dm_' + [myId, targetId].sort().join('_');

    const participants = [myId, targetId];
    if (user && user.id && !participants.includes(user.id)) participants.push(user.id);
    if (contactId && !participants.includes(contactId)) participants.push(contactId);

    const newConv = {
      id: convId,
      type: 'dm',
      name: contactName.startsWith('@') ? contactName : '@' + contactName,
      avatar: contactAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(targetId)}&backgroundColor=6366f1`,
      isOnline: true,
      lastMessage: 'Conversation started',
      lastMessageTime: 'Just now',
      unread: 0,
      verified: true,
      participant_ids: participants
    };

    if (supabase && isSupabaseConfigured()) {
      try {
        await supabase.from('conversations').upsert([{
          id: convId,
          participant_ids: participants,
          name: newConv.name,
          is_group: false,
          last_message: 'Conversation started',
          last_message_time: new Date().toISOString(),
          unread_count: 0
        }], { onConflict: 'id' });
      } catch (e) {}
    }

    try {
      const existing = db.findById('conversations', convId);
      if (!existing) {
        db.insert('conversations', newConv);
      }
    } catch (e) {}

    res.status(201).json({
      success: true,
      conversation: newConv
    });
  } catch (err) {
    console.error('[Chat] New DM error:', err);
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
  }
});

module.exports = router;
