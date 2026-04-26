const mongoose = require('mongoose');

const dailyMetricSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    tasksCreated: { type: Number, default: 0 },
    tasksUpdated: { type: Number, default: 0 },
    tasksCompleted: { type: Number, default: 0 },
    commentsCreated: { type: Number, default: 0 },
    filesAttached: { type: Number, default: 0 },
  },
  { timestamps: true }
);

dailyMetricSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyMetric', dailyMetricSchema);
