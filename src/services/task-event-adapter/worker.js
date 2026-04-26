require('dotenv').config();
const mongoose = require('mongoose');
const { publishEvent } = require('./lib/publisher');

const taskSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    status: String,
    priority: String,
    dueDate: Date,
    userId: String,
    tags: [String],
  },
  { timestamps: true, collection: 'tasks' }
);

const Task = mongoose.model('Task', taskSchema);
const seen = new Map();

function eventTypeFor(previous, task) {
  if (!previous) return 'task.created';
  if (previous.status !== task.status && task.status === 'done') return 'task.completed';
  if (previous.status !== task.status) return 'task.status_changed';
  return 'task.updated';
}

async function poll() {
  const lookbackMs = Number(process.env.TASK_EVENT_LOOKBACK_MS || 120000);
  const since = new Date(Date.now() - lookbackMs);
  const tasks = await Task.find({ updatedAt: { $gte: since } }).lean();

  for (const task of tasks) {
    const previous = seen.get(String(task._id));
    const signature = `${task.updatedAt?.toISOString()}|${task.status}`;
    if (previous?.signature === signature) continue;

    const eventType = eventTypeFor(previous, task);
    await publishEvent(eventType, task.userId, { ...task, taskId: String(task._id) });
    seen.set(String(task._id), { signature, status: task.status });
  }
}

async function start() {
  await mongoose.connect(process.env.TASK_MONGODB_URI || 'mongodb://mongo-task:27017/task-db');
  console.log('Task Event Adapter connected to task database');
  await poll();
  setInterval(() => {
    poll().catch((err) => console.error('Task polling failed:', err.message));
  }, Number(process.env.TASK_EVENT_POLL_INTERVAL_MS || 30000));
}

start().catch((err) => {
  console.error('Task Event Adapter startup failed:', err);
  process.exit(1);
});
