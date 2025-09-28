const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  contact: String,
  phone: String,
  group: String,
  status: {
    type: String,
    enum: ['sent', 'failed'],
    required: true
  },
  messageId: String,
  error: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const messageBatchSchema = new mongoose.Schema({
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
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  contactGroupIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContactGroup',
    required: true
  }],
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  progress: {
    total: {
      type: Number,
      default: 0
    },
    sent: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    }
  },
  schedule: Date,
  results: [resultSchema],
  options: {
    delayBetweenMessages: {
      type: Number,
      default: 1000,
      min: 500,
      max: 60000
    },
    maxRetries: {
      type: Number,
      default: 3,
      min: 1,
      max: 10
    }
  }
}, {
  timestamps: true
});

messageBatchSchema.index({ userId: 1, createdAt: -1 });
messageBatchSchema.index({ status: 1, schedule: 1 });

module.exports = mongoose.model('MessageBatch', messageBatchSchema);