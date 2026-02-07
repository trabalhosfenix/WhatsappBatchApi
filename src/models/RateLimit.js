// 📁 models/RateLimit.js
const rateLimitSchema = new mongoose.Schema({
  whatsappInstanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WhatsAppInstance',
    required: true
  },
  windowStart: {
    type: Date,
    default: Date.now,
    index: true
  },
  messageCount: {
    type: Number,
    default: 0
  },
  mediaCount: {
    type: Number, 
    default: 0
  },
  groupMessageCount: {
    type: Number,
    default: 0
  },
  lastReset: Date
}, {
  timestamps: true
});