const express = require('express');
const multer = require('multer');
const { randomUUID } = require('crypto');
const Attachment = require('../models/Attachment');
const { client, bucket } = require('../storage/minioClient');
const { publishEvent } = require('../storage/publisher');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/tasks/:taskId', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    const storageKey = `${req.params.taskId}/${randomUUID()}-${req.file.originalname}`;
    await client.putObject(bucket, storageKey, req.file.buffer, req.file.size, { 'Content-Type': req.file.mimetype });

    const attachment = await Attachment.create({
      taskId: req.params.taskId,
      uploadedBy: req.headers['x-user-id'],
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storageKey,
      url: '/api/files/pending/download',
    });
    attachment.url = `/api/files/${attachment._id}/download`;
    await attachment.save();

    await publishEvent('file.attached', req.headers['x-user-id'], attachment.toObject());
    res.status(201).json({ attachment });
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/:taskId', async (req, res, next) => {
  try {
    const attachments = await Attachment.find({ taskId: req.params.taskId }).sort({ createdAt: -1 });
    res.json({ attachments });
  } catch (err) {
    next(err);
  }
});

router.get('/:fileId/download', async (req, res, next) => {
  try {
    const attachment = await Attachment.findById(req.params.fileId);
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    client.getObject(bucket, attachment.storageKey, (err, stream) => {
      if (err) return next(err);
      stream.pipe(res);
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:fileId', async (req, res, next) => {
  try {
    const attachment = await Attachment.findOne({ _id: req.params.fileId, uploadedBy: req.headers['x-user-id'] });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
    await client.removeObject(bucket, attachment.storageKey).catch(() => null);
    await attachment.deleteOne();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
