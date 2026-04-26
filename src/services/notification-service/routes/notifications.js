const express = require('express');
const Notification = require('../models/Notification');

const router = express.Router();

function userIdFrom(req) {
  return req.headers['x-user-id'];
}

router.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: userIdFrom(req) })
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit || 50));
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

router.get('/unread', async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: userIdFrom(req), read: false }).sort({ createdAt: -1 });
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: userIdFrom(req) },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification });
  } catch (err) {
    next(err);
  }
});

router.post('/test-email', async (req, res, next) => {
  try {
    const notification = await Notification.create({
      userId: userIdFrom(req),
      type: 'notification.test_email',
      title: 'Test email notification',
      message: req.body?.message || 'Email delivery can be wired to SMTP using NOTIFICATION_SMTP_* variables.',
      channel: 'email',
      metadata: { email: req.headers['x-user-email'] },
    });
    res.status(202).json({ notification });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
