const express = require('express');
const router = express.Router();
const db = require('../db');
const { authRequired, authOptional } = require('../middleware/auth');

// ── Get Feed Posts ───────────────────────────────────────────
router.get('/posts', (req, res) => {
  try {
    const posts = db.get('posts');
    res.json({ success: true, count: posts.length, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch feed posts' });
  }
});

// ── Create New Post ──────────────────────────────────────────
router.post('/posts', authOptional, (req, res) => {
  try {
    const { content, image, tags } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Post content cannot be empty' });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Please sign in to publish to developer feed' });
    }

    const newPost = {
      id: 'post_' + Date.now(),
      author: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        verified: user.role === 'developer' || user.role === 'seller'
      },
      content: content.trim(),
      image: image || null,
      likes: 0,
      likedBy: [],
      comments: [],
      shares: 0,
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim().replace(/^#/, '')) : ['Community']),
      createdAt: new Date().toISOString()
    };

    db.insert('posts', newPost);

    res.status(201).json({
      success: true,
      message: 'Post published to developer feed! 🚀',
      post: newPost
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create post' });
  }
});

// ── Like / Unlike Post ───────────────────────────────────────
router.post('/posts/:id/like', authOptional, (req, res) => {
  try {
    const post = db.findById('posts', req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const user = req.user || null;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Please sign in to like posts' });
    }
    if (!post.likedBy) post.likedBy = [];

    const userIndex = post.likedBy.indexOf(user.id);
    let isLiked = false;

    if (userIndex > -1) {
      // Unlike
      post.likedBy.splice(userIndex, 1);
      post.likes = Math.max(0, (post.likes || 1) - 1);
      isLiked = false;
    } else {
      // Like
      post.likedBy.push(user.id);
      post.likes = (post.likes || 0) + 1;
      isLiked = true;
    }

    db.update('posts', post.id, { likes: post.likes, likedBy: post.likedBy });

    res.json({
      success: true,
      isLiked,
      likes: post.likes
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update like status' });
  }
});

// ── Comment on Post ──────────────────────────────────────────
router.post('/posts/:id/comments', authOptional, (req, res) => {
  try {
    const post = db.findById('posts', req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Comment text is required' });
    }

    const user = req.user || null;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Please sign in to comment' });
    }
    if (!post.comments) post.comments = [];

    const newComment = {
      id: 'c_' + Date.now(),
      author: user.name,
      avatar: user.avatar,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    post.comments.push(newComment);
    db.update('posts', post.id, { comments: post.comments });

    res.status(201).json({
      success: true,
      message: 'Comment added',
      comment: newComment,
      commentsCount: post.comments.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add comment' });
  }
});

// ── Share Post ───────────────────────────────────────────────
router.post('/posts/:id/share', (req, res) => {
  try {
    const post = db.findById('posts', req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const shares = (post.shares || 0) + 1;
    db.update('posts', post.id, { shares });

    res.json({ success: true, shares });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to share post' });
  }
});

// ── Developer Stories ─────────────────────────────────────────
router.get('/stories', (req, res) => {
  res.json({ success: true, stories: [] });
});

module.exports = router;
