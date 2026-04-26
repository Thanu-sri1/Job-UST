const amqp = require('amqplib');
const { client, index } = require('./elastic');

const EXCHANGE = process.env.EVENT_EXCHANGE || 'taskflow.events';

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
  const queue = await channel.assertQueue('search-service.events', { durable: true });

  for (const key of ['task.created', 'task.updated', 'task.completed', 'task.deleted']) {
    await channel.bindQueue(queue.queue, EXCHANGE, key);
  }

  channel.consume(queue.queue, async (msg) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      const task = event.data || {};
      const taskId = task._id || task.taskId;

      if (event.eventType === 'task.deleted' && taskId) {
        await client.delete({ index, id: taskId }, { ignore: [404] });
      } else if (taskId) {
        await client.index({
          index,
          id: taskId,
          document: {
            taskId,
            userId: task.userId || event.actorId,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            tags: task.tags || [],
            dueDate: task.dueDate,
            updatedAt: task.updatedAt || event.occurredAt,
          },
        });
      }

      channel.ack(msg);
    } catch (err) {
      console.error('Search event handling failed:', err.message);
      channel.nack(msg, false, false);
    }
  });
}

module.exports = { startConsumers };
