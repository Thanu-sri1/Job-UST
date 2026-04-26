const express = require('express');
const Reminder = require('../models/Reminder');

const router = express.Router();

router.post('/tasks/:taskId', async (req, res, next) => {
  try {
    const reminder = await Reminder.create({
      taskId: req.params.taskId,
      userId: req.headers['x-user-id'],
      remindAt: req.body.remindAt,
      channel: req.body.channel || 'in_app',
      message: req.body.message || 'Task reminder',
    });
    res.status(201).json({ reminder });
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    const reminders = await Reminder.find({ userId: req.headers['x-user-id'] }).sort({ remindAt: 1 });
    res.json({ reminders });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.headers['x-user-id'] },
      {
        remindAt: req.body.remindAt,
        channel: req.body.channel,
        message: req.body.message,
        status: req.body.status,
      },
      { new: true, runValidators: true }
    );
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    res.json({ reminder });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.headers['x-user-id'] },
      { status: 'cancelled' },
      { new: true }
    );
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
