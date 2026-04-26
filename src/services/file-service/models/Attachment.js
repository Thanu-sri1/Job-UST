const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    taskId: { type: String, required: true, index: true },
    uploadedBy: { type: String, required: true, index: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true, unique: true },
    url: { type: String, required: true },
  },
  { timestamps: true }
);

attachmentSchema.index({ taskId: 1, createdAt: -1 });

module.exports = mongoose.model('Attachment', attachmentSchema);
