const mongoose = require('mongoose');

const mediaItemSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true
  },
  originalName: String,
  mimeType: {
    type: String,
    required: true
  },
  fileSize: Number,
  url: String, // URL do arquivo armazenado
  localPath: String, // Caminho local do arquivo
  caption: String // Legenda opcional
});

const mediaBatchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  whatsappInstanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WhatsAppInstance',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  mediaItems: [mediaItemSchema],
  contactGroupIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContactGroup',
    required: true
  }],
  // ✅ CORREÇÃO: ADICIONAR CAMPO CAPTION NO NÍVEL PRINCIPAL
  caption: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  progress: {
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  options: {
    delayBetweenMessages: { type: Number, default: 2000, min: 1000, max: 60000 },
    sendAsDocument: { type: Boolean, default: false },
    caption: { type: String, default: '' }
  },
  results: [{
    contact: String,
    phone: String,
    mediaItem: String,
    status: { type: String, enum: ['sent', 'failed'] },
    messageId: String,
    error: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

mediaBatchSchema.index({ userId: 1, createdAt: -1 });
mediaBatchSchema.index({ status: 1 });

module.exports = mongoose.model('MediaBatch', mediaBatchSchema);