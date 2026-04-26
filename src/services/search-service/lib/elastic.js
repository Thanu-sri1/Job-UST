const { Client } = require('@elastic/elasticsearch');

const client = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200' });
const index = process.env.TASK_INDEX || 'taskflow-tasks';

async function ensureIndex() {
  const exists = await client.indices.exists({ index });
  if (!exists) {
    await client.indices.create({
      index,
      mappings: {
        properties: {
          taskId: { type: 'keyword' },
          userId: { type: 'keyword' },
          title: { type: 'text' },
          description: { type: 'text' },
          status: { type: 'keyword' },
          priority: { type: 'keyword' },
          tags: { type: 'keyword' },
          dueDate: { type: 'date' },
          updatedAt: { type: 'date' },
        },
      },
    });
  }
}

module.exports = { client, index, ensureIndex };
