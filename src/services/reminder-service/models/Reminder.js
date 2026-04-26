const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    taskId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    remindAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['scheduled', 'sent', 'cancelled'], default: 'scheduled', index: true },
    channel: { type: String, enum: ['in_app', 'email'], default: 'in_app' },
    message: { type: String, default: 'Task reminder' },
  },
  { timestamps: true }
);

reminderSchema.index({ status: 1, remindAt: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
