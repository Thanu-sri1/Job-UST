const Minio = require('minio');

const endpoint = process.env.S3_ENDPOINT || 'http://minio:9000';
const parsed = new URL(endpoint);

const client = new Minio.Client({
  endPoint: parsed.hostname,
  port: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80)),
  useSSL: parsed.protocol === 'https:',
  accessKey: process.env.S3_ACCESS_KEY || 'taskflow',
  secretKey: process.env.S3_SECRET_KEY || 'taskflow-secret',
});

const bucket = process.env.S3_BUCKET || 'taskflow-files';

async function ensureBucket() {
  const exists = await client.bucketExists(bucket).catch(() => false);
  if (!exists) {
    await client.makeBucket(bucket);
  }
}

module.exports = { client, bucket, ensureBucket };
