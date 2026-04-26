const express = require('express');
const Comment = require('../models/Comment');
const { publishEvent } = require('../lib/publisher');

const router = express.Router();

function commentBody(req) {
  return {
    body: req.body.body,
    mentions: Array.isArray(req.body.mentions) ? req.body.mentions : [],
  };
}

router.post('/tasks/:taskId', async (req, res, next) => {
  try {
    const comment = await Comment.create({
      taskId: req.params.taskId,
      authorId: req.headers['x-user-id'],
      authorName: req.headers['x-user-name'] || 'User',
      ...commentBody(req),
    });
    await publishEvent('comment.created', req.headers['x-user-id'], comment.toObject());
    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/:taskId', async (req, res, next) => {
  try {
    const comments = await Comment.find({ taskId: req.params.taskId, deletedAt: null }).sort({ createdAt: 1 });
    res.json({ comments });
  } catch (err) {
    next(err);
  }
});

router.post('/:commentId/replies', async (req, res, next) => {
  try {
    const parent = await Comment.findById(req.params.commentId);
    if (!parent) return res.status(404).json({ error: 'Parent comment not found' });
    const comment = await Comment.create({
      taskId: parent.taskId,
      parentCommentId: parent._id,
      authorId: req.headers['x-user-id'],
      authorName: req.headers['x-user-name'] || 'User',
      ...commentBody(req),
    });
    await publishEvent('comment.created', req.headers['x-user-id'], comment.toObject());
    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
});

router.patch('/:commentId', async (req, res, next) => {
  try {
    const comment = await Comment.findOneAndUpdate(
      { _id: req.params.commentId, authorId: req.headers['x-user-id'], deletedAt: null },
      commentBody(req),
      { new: true, runValidators: true }
    );
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    res.json({ comment });
  } catch (err) {
    next(err);
  }
});

router.delete('/:commentId', async (req, res, next) => {
  try {
    const comment = await Comment.findOneAndUpdate(
      { _id: req.params.commentId, authorId: req.headers['x-user-id'], deletedAt: null },
      { deletedAt: new Date() },
      { new: true }
    );
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
