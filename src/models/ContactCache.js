// 📁 models/ContactCache.js
const mongoose = require('mongoose');

const contactCacheSchema = new mongoose.Schema({
  sessionName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  whatsappInstanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WhatsAppInstance',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contacts: {
    type: Map,
    of: new mongoose.Schema({
      name: {
        type: String,
        trim: true
      },
      verifiedName: {
        type: String,
        trim: true
      },
      isBusiness: {
        type: Boolean,
        default: false
      },
      lastUpdate: {
        type: Date,
        default: Date.now
      },
      // Novos campos para informações completas
      pushName: String,
      shortName: String,
      profilePicture: String,
      status: String,
      lastSeen: Date,
      businessName: String,
      businessCategory: String,
      verified: Boolean,
      phone: String,
      whatsappId: String
    }, { _id: false }),
    default: {}
  },
  totalContacts: {
    type: Number,
    default: 0
  },
  lastSynced: {
    type: Date,
    default: Date.now
  },
  syncStatus: {
    type: String,
    enum: ['synced', 'syncing', 'failed'],
    default: 'synced'
  }
}, {
  timestamps: true
});

// Índices para performance
contactCacheSchema.index({ sessionName: 1, userId: 1 }, { unique: true });
contactCacheSchema.index({ whatsappInstanceId: 1 });
contactCacheSchema.index({ userId: 1 });
contactCacheSchema.index({ 'lastSynced': -1 });

// Middleware para atualizar totalContacts
contactCacheSchema.pre('save', function(next) {
  this.totalContacts = this.contacts.size;
  this.lastSynced = new Date();
  next();
});

module.exports = mongoose.model('ContactCache', contactCacheSchema);