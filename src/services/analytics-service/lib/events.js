const amqp = require('amqplib');
const DailyMetric = require('../models/DailyMetric');

const EXCHANGE = process.env.EVENT_EXCHANGE || 'taskflow.events';

const counters = {
  'task.created': 'tasksCreated',
  'task.updated': 'tasksUpdated',
  'task.completed': 'tasksCompleted',
  'comment.created': 'commentsCreated',
  'file.attached': 'filesAttached',
};

async function connectWithRetry() {
  const url = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
  for (;;) {
    try {
      return await amqp.connect(url);
    } catch (err) {
      console.error('RabbitMQ unavailable, retrying:', err.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function startConsumers() {
  const conn = await connectWithRetry();
  const channel = await conn.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  const queue = await channel.assertQueue('analytics-service.events', { durable: true });

  for (const key of Object.keys(counters)) {
    await channel.bindQueue(queue.queue, EXCHANGE, key);
  }

  channel.consume(queue.queue, async (msg) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      const field = counters[event.eventType];
      const data = event.data || {};
      const userId = data.userId || event.actorId;

      if (field && userId) {
        const date = new Date(event.occurredAt || Date.now()).toISOString().slice(0, 10);
        await DailyMetric.updateOne({ userId, date }, { $inc: { [field]: 1 } }, { upsert: true });
      }

      channel.ack(msg);
    } catch (err) {
      console.error('Analytics event handling failed:', err.message);
      channel.nack(msg, false, false);
    }
  });
}

module.exports = { startConsumers };
