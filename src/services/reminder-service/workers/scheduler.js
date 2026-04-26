const Reminder = require('../models/Reminder');
const { publishEvent } = require('../lib/publisher');

async function processDueReminders() {
  const due = await Reminder.find({
    status: 'scheduled',
    remindAt: { $lte: new Date() },
  }).limit(100);

  for (const reminder of due) {
    reminder.status = 'sent';
    await reminder.save();
    await publishEvent('reminder.due', reminder.userId, reminder.toObject());
  }
}

function startScheduler() {
  const intervalMs = Number(process.env.REMINDER_POLL_INTERVAL_MS || 30000);
  setInterval(() => {
    processDueReminders().catch((err) => console.error('Reminder scheduler failed:', err.message));
  }, intervalMs);
}

module.exports = { startScheduler, processDueReminders };
