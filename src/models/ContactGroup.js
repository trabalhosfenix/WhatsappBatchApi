// 📁 models/ContactGroup.js - SCHEMA ATUALIZADO COM CORREÇÕES
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  // Informações básicas
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  // ✅ NOVOS CAMPOS
  pushName: {
    type: String,
    trim: true
  },
  shortName: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String, // URL ou base64
    trim: true
  },
  status: {
    type: String, // Status do WhatsApp
    trim: true
  },
  lastSeen: {
    type: Date
  },
  isBusiness: {
    type: Boolean,
    default: false
  },
  businessName: {
    type: String,
    trim: true
  },
  businessCategory: {
    type: String,
    trim: true
  },
  // Dados da plataforma
  platform: {
    type: String,
    enum: ['whatsapp', 'manual', 'imported'],
    default: 'manual'
  },
  whatsappId: {
    type: String, // ID único do WhatsApp
    trim: true
  },
  isGroup: {
    type: Boolean,
    default: false
  },
  groupMetadata: {
    creator: String,
    creation: Date,
    participants: Number,
    admins: [String]
  },
  // Metadados
  verified: {
    type: Boolean,
    default: false
  },
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  tags: [{
    type: String,
    trim: true
  }]
}, { 
  timestamps: true 
});

const contactGroupSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 5000
  },
  
  // ✅ CORREÇÃO CRÍTICA: ADICIONAR CAMPO jid QUE ESTÁ FALTANDO
  jid: {
    type: String,
    trim: true,
    sparse: true // Permite null para grupos manuais
  },
  
  contacts: [contactSchema],
  contactCount: {
    type: Number,
    default: 0
  },
  
  // ✅ NOVOS CAMPOS PARA GRUPOS
  source: {
    type: String,
    enum: ['whatsapp', 'manual', 'imported', 'api'],
    default: 'manual'
  },
  whatsappInstanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WhatsAppInstance'
  },
  groupType: {
    type: String,
    enum: ['personal', 'business', 'community', 'broadcast'],
    default: 'personal'
  },
  
  // ✅ CORREÇÃO: Adicionar participantCount que está sendo usado
  participantCount: {
    type: Number,
    default: 0
  },
  
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'failed'],
    default: 'pending'
  },
  lastSync: {
    type: Date
  }
}, {
  timestamps: true
});

contactGroupSchema.pre('save', function(next) {
  this.contactCount = this.contacts.length;
  this.updatedAt = Date.now();
  next();
});

// ✅ Índices para melhor performance
contactGroupSchema.index({ userId: 1, name: 1 });
contactGroupSchema.index({ userId: 1, 'contacts.phone': 1 });
contactGroupSchema.index({ userId: 1, source: 1 });

// ✅ NOVO ÍNDICE CRÍTICO: Para buscar grupos por jid
contactGroupSchema.index({ userId: 1, jid: 1 }, { sparse: true });

module.exports = mongoose.model('ContactGroup', contactGroupSchema);