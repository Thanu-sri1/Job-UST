const express = require('express');
const DailyMetric = require('../models/DailyMetric');

const router = express.Router();

function userIdFrom(req) {
  return req.headers['x-user-id'];
}

function isAdmin(req) {
  return req.headers['x-user-role'] === 'admin';
}

function sinceDate(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

router.get('/me/summary', async (req, res, next) => {
  try {
    const rows = await DailyMetric.find({ userId: userIdFrom(req), date: { $gte: sinceDate(30) } });
    const summary = rows.reduce(
      (acc, row) => {
        acc.tasksCreated += row.tasksCreated;
        acc.tasksUpdated += row.tasksUpdated;
        acc.tasksCompleted += row.tasksCompleted;
        acc.commentsCreated += row.commentsCreated;
        acc.filesAttached += row.filesAttached;
        return acc;
      },
      { tasksCreated: 0, tasksUpdated: 0, tasksCompleted: 0, commentsCreated: 0, filesAttached: 0 }
    );
    res.json({ rangeDays: 30, summary });
  } catch (err) {
    next(err);
  }
});

router.get('/me/tasks-completed', async (req, res, next) => {
  try {
    const days = req.query.range === 'week' ? 7 : 30;
    const metrics = await DailyMetric.find({ userId: userIdFrom(req), date: { $gte: sinceDate(days) } }).sort({ date: 1 });
    res.json({ rangeDays: days, metrics: metrics.map((m) => ({ date: m.date, tasksCompleted: m.tasksCompleted })) });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/users/productivity', async (req, res, next) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin role required' });
  try {
    const results = await DailyMetric.aggregate([
      { $match: { date: { $gte: sinceDate(30) } } },
      { $group: { _id: '$userId', tasksCompleted: { $sum: '$tasksCompleted' }, tasksCreated: { $sum: '$tasksCreated' } } },
      { $sort: { tasksCompleted: -1 } },
      { $limit: 50 },
    ]);
    res.json({ users: results });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/tasks/overview', async (req, res, next) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin role required' });
  try {
    const rows = await DailyMetric.aggregate([
      { $match: { date: { $gte: sinceDate(30) } } },
      { $group: { _id: null, tasksCreated: { $sum: '$tasksCreated' }, tasksCompleted: { $sum: '$tasksCompleted' } } },
    ]);
    res.json({ rangeDays: 30, overview: rows[0] || { tasksCreated: 0, tasksCompleted: 0 } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
