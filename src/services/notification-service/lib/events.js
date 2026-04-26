const amqp = require('amqplib');
const Notification = require('../models/Notification');

const EXCHANGE = process.env.EVENT_EXCHANGE || 'taskflow.events';

const messagesByEvent = {
  'task.created': 'A task was created.',
  'task.updated': 'A task was updated.',
  'task.status_changed': 'A task status changed.',
  'task.completed': 'A task was completed.',
  'comment.created': 'A new comment was added.',
  'file.attached': 'A file was attached.',
  'reminder.due': 'A reminder is due.',
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
  const queue = await channel.assertQueue('notification-service.events', { durable: true });

  for (const key of Object.keys(messagesByEvent)) {
    await channel.bindQueue(queue.queue, EXCHANGE, key);
  }

  channel.consume(queue.queue, async (msg) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      const data = event.data || {};
      const userId = data.userId || data.assigneeId || event.actorId;

      if (userId) {
        await Notification.create({
          userId,
          type: event.eventType,
          title: event.eventType.replaceAll('.', ' '),
          message: messagesByEvent[event.eventType] || 'TaskFlow event received.',
          channel: data.channel || 'in_app',
          metadata: data,
        });
      }

      channel.ack(msg);
    } catch (err) {
      console.error('Notification event handling failed:', err.message);
      channel.nack(msg, false, false);
    }
  });
}

module.exports = { startConsumers };
