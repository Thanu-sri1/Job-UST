const amqp = require('amqplib');
const { randomUUID } = require('crypto');

const EXCHANGE = process.env.EVENT_EXCHANGE || 'taskflow.events';
let channelPromise;

async function getChannel() {
  if (!channelPromise) {
    channelPromise = amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672').then(async (conn) => {
      const channel = await conn.createChannel();
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      return channel;
    });
  }
  return channelPromise;
}

async function publishEvent(eventType, actorId, data) {
  const channel = await getChannel();
  const event = { eventId: randomUUID(), eventType, version: 1, occurredAt: new Date().toISOString(), actorId, data };
  channel.publish(EXCHANGE, eventType, Buffer.from(JSON.stringify(event)), { persistent: true });
}

module.exports = { publishEvent };
