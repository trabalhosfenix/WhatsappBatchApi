// 📁 models/TrackingConfig.js
const mongoose = require('mongoose');

const trackingConfigSchema = new mongoose.Schema({
  sessionName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
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
  // Configurações do tracking
  enabled: {
    type: Boolean,
    default: true
  },
  trackMessages: {
    type: Boolean,
    default: true
  },
  trackPresence: {
    type: Boolean,
    default: false
  },
  collectProfileData: {
    type: Boolean,
    default: true
  },
  autoReenable: {
    type: Boolean,
    default: true
  },
  // Controle de estado
  lastActive: Date,
  isListening: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Índices
trackingConfigSchema.index({ sessionName: 1 });
trackingConfigSchema.index({ userId: 1 });
trackingConfigSchema.index({ autoReenable: 1 });

module.exports = mongoose.model('TrackingConfig', trackingConfigSchema);