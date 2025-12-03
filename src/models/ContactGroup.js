// 📁 models/ContactGroup.js - SCHEMA ATUALIZADO COM PREVENÇÃO DE DUPLICAÇÃO
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
    trim: true,
    index: true
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
  }],
  
  // ✅ NOVOS CAMPOS PARA CONTROLE DE SINCRONIZAÇÃO
  syncStatus: {
    type: String,
    enum: ['active', 'inactive', 'removed'],
    default: 'active'
  },
  lastInteraction: {
    type: Date,
    default: Date.now
  },
  raster:{
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

const contactGroupSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 5000,
    trim: true
  },
  
  // ✅ CAMPO OBRIGATÓRIO PARA GRUPOS DO WHATSAPP - CHAVE ÚNICA
  jid: {
    type: String,
    trim: true,
    required: function() {
      return this.source === 'whatsapp';
    },
    index: true
  },
  
  contacts: [contactSchema],
  contactCount: {
    type: Number,
    default: 0
  },
  
  // ✅ CAMPOS PARA CONTROLE DE ORIGEM
  source: {
    type: String,
    enum: ['whatsapp', 'manual', 'imported', 'api'],
    default: 'manual',
    required: true,
    index: true
  },
  whatsappInstanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WhatsAppInstance',
    required: function() {
      return this.source === 'whatsapp';
    },
    index: true
  },
  
  // ✅ INFORMAÇÕES ESPECÍFICAS DO GRUPO
  groupType: {
    type: String,
    enum: ['personal', 'business', 'community', 'broadcast', 'unknown'],
    default: 'unknown'
  },
  
  participantCount: {
    type: Number,
    default: 0
  },
  
  // ✅ METADADOS DO GRUPO DO WHATSAPP
  groupMetadata: {
    creation: {
      type: Date
    },
    owner: {
      type: String,
      trim: true
    },
    subjectOwner: {
      type: String,
      trim: true
    },
    subjectTime: {
      type: Date
    },
    restrict: {
      type: Boolean,
      default: false
    },
    announce: {
      type: Boolean,
      default: false
    },
    ephemeralDuration: {
      type: Number,
      default: 0
    },
    size: {
      type: Number,
      default: 0
    },
    support: {
      type: Boolean,
      default: false
    },
    suspended: {
      type: Boolean,
      default: false
    },
    terminated: {
      type: Boolean,
      default: false
    },
    uniqueShortName: {
      type: String,
      trim: true
    },
    isParentGroup: {
      type: Boolean,
      default: false
    },
    parentGroupId: {
      type: String,
      trim: true
    },
    defaultMembershipApprovalMode: {
      type: Boolean,
      default: false
    },
    membershipApprovalMode: {
      type: Boolean,
      default: false
    },
    participants: [{
      id: {
        type: String,
        required: true
      },
      type: {
        type: String,
        enum: ['admin', 'superadmin', 'member'],
        default: 'member'
      }
    }]
  },
  
  // ✅ METADADOS GERAIS
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // ✅ CONTROLE DE SINCRONIZAÇÃO
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'failed', 'outdated'],
    default: 'pending'
  },
  lastSync: {
    type: Date
  },
  syncVersion: {
    type: Number,
    default: 1
  },
  
  // ✅ CONTROLE DE ESTADO
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  
  // ✅ ESTATÍSTICAS
  statistics: {
    totalMessages: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date
    },
    activeParticipants: {
      type: Number,
      default: 0
    },
    adminCount: {
      type: Number,
      default: 0
    }
  },
  
  // ✅ TAGS E CATEGORIZAÇÃO
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  category: {
    type: String,
    trim: true,
    lowercase: true
  },
  
  // ✅ CONFIGURAÇÕES
  settings: {
    autoSync: {
      type: Boolean,
      default: true
    },
    backupEnabled: {
      type: Boolean,
      default: false
    },
    exportEnabled: {
      type: Boolean,
      default: true
    }
  },
  
  // ✅ AUDITORIA
  createdBy: {
    type: String,
    enum: ['user', 'system', 'import', 'api'],
    default: 'user'
  },
  lastModifiedBy: {
    type: String,
    enum: ['user', 'system', 'import', 'api'],
    default: 'user'
  },
  
  // ✅ CONTROLE DE VERSÃO
  version: {
    type: Number,
    default: 1
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ MIDDLEWARES
contactGroupSchema.pre('save', function(next) {
  // Atualizar contadores
  this.contactCount = this.contacts.length;
  
  // Calcular participantCount baseado nos contatos ou metadados
  if (this.source === 'whatsapp' && this.groupMetadata.participants) {
    this.participantCount = this.groupMetadata.participants.length;
  } else {
    this.participantCount = this.contacts.length;
  }
  
  // Atualizar estatísticas de administradores
  if (this.groupMetadata.participants) {
    this.statistics.adminCount = this.groupMetadata.participants.filter(
      p => p.type === 'admin' || p.type === 'superadmin'
    ).length;
  }
  
  // Incrementar versão se houve modificação
  if (this.isModified()) {
    this.version += 1;
  }
  
  this.updatedAt = Date.now();
  next();
});

// ✅ VIRTUAIS
contactGroupSchema.virtual('isWhatsAppGroup').get(function() {
  return this.source === 'whatsapp';
});

contactGroupSchema.virtual('isConnected').get(function() {
  return this.syncStatus === 'synced' && this.isActive;
});

contactGroupSchema.virtual('syncAge').get(function() {
  return this.lastSync ? Date.now() - this.lastSync.getTime() : null;
});

// ✅ MÉTODOS DE INSTÂNCIA
contactGroupSchema.methods.updateSyncStatus = function(status, message = null) {
  this.syncStatus = status;
  this.lastSync = new Date();
  
  if (message && this.metadata) {
    this.metadata.set('lastSyncMessage', message);
  }
  
  return this.save();
};

contactGroupSchema.methods.addContacts = function(newContacts) {
  const existingPhones = new Set(this.contacts.map(c => c.phone));
  const duplicates = [];
  const added = [];
  
  newContacts.forEach(contact => {
    if (!existingPhones.has(contact.phone)) {
      this.contacts.push(contact);
      added.push(contact);
      existingPhones.add(contact.phone);
    } else {
      duplicates.push(contact.phone);
    }
  });
  
  return { added, duplicates };
};

contactGroupSchema.methods.getAdminContacts = function() {
  if (this.source !== 'whatsapp' || !this.groupMetadata.participants) {
    return [];
  }
  
  const adminIds = this.groupMetadata.participants
    .filter(p => p.type === 'admin' || p.type === 'superadmin')
    .map(p => p.id);
  
  return this.contacts.filter(contact => 
    adminIds.includes(contact.whatsappId) || 
    adminIds.includes(contact.phone + '@s.whatsapp.net')
  );
};

// ✅ MÉTODOS ESTÁTICOS
contactGroupSchema.statics.findByJid = function(userId, jid, instanceId = null) {
  const query = { userId, jid };
  if (instanceId) {
    query.whatsappInstanceId = instanceId;
  }
  return this.findOne(query);
};

contactGroupSchema.statics.findByInstance = function(userId, instanceId, options = {}) {
  const query = { 
    userId, 
    whatsappInstanceId: instanceId,
    ...options 
  };
  return this.find(query);
};

contactGroupSchema.statics.upsertGroup = async function(groupData) {
  const { userId, jid, whatsappInstanceId } = groupData;
  
  if (!jid || !whatsappInstanceId) {
    throw new Error('JID e whatsappInstanceId são obrigatórios para upsert');
  }
  
  const existingGroup = await this.findOne({
    userId,
    jid,
    whatsappInstanceId
  });
  
  if (existingGroup) {
    // Atualizar grupo existente
    Object.keys(groupData).forEach(key => {
      if (key !== 'userId' && key !== 'jid' && key !== 'whatsappInstanceId') {
        existingGroup[key] = groupData[key];
      }
    });
    
    existingGroup.syncStatus = 'synced';
    existingGroup.lastSync = new Date();
    existingGroup.version += 1;
    
    return await existingGroup.save();
  } else {
    // Criar novo grupo
    return await this.create({
      ...groupData,
      syncStatus: 'synced',
      lastSync: new Date()
    });
  }
};

contactGroupSchema.statics.cleanDuplicates = async function(userId, instanceId = null) {
  const matchStage = { userId: mongoose.Types.ObjectId(userId) };
  if (instanceId) {
    matchStage.whatsappInstanceId = mongoose.Types.ObjectId(instanceId);
  }
  
  const duplicates = await this.aggregate([
    { $match: matchStage },
    { $match: { jid: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: { jid: "$jid", whatsappInstanceId: "$whatsappInstanceId" },
        count: { $sum: 1 },
        docs: { 
          $push: {
            _id: "$_id",
            createdAt: "$createdAt",
            updatedAt: "$updatedAt",
            version: "$version"
          }
        }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { "_id.jid": 1 } }
  ]);
  
  let deletedCount = 0;
  
  for (const duplicate of duplicates) {
    // Ordenar por updatedAt (mais recente primeiro) e version (maior primeiro)
    const sortedDocs = duplicate.docs.sort((a, b) => {
      if (b.updatedAt.getTime() !== a.updatedAt.getTime()) {
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      }
      return b.version - a.version;
    });
    
    const keepId = sortedDocs[0]._id;
    const deleteIds = sortedDocs.slice(1).map(doc => doc._id);
    
    if (deleteIds.length > 0) {
      await this.deleteMany({ _id: { $in: deleteIds } });
      deletedCount += deleteIds.length;
    }
  }
  
  return { duplicatesFound: duplicates.length, deletedCount };
};

// ✅ ÍNDICES OTIMIZADOS
contactGroupSchema.index({ userId: 1, name: 1 });
contactGroupSchema.index({ userId: 1, 'contacts.phone': 1 });
contactGroupSchema.index({ userId: 1, source: 1 });
contactGroupSchema.index({ userId: 1, jid: 1 });
contactGroupSchema.index({ userId: 1, whatsappInstanceId: 1 });
contactGroupSchema.index({ userId: 1, syncStatus: 1 });
contactGroupSchema.index({ userId: 1, isActive: 1 });
contactGroupSchema.index({ 'contacts.whatsappId': 1 });
contactGroupSchema.index({ lastSync: -1 });
contactGroupSchema.index({ 'statistics.lastActivity': -1 });

// ✅ ÍNDICE COMPOSTO ÚNICO PARA EVITAR DUPLICAÇÃO
contactGroupSchema.index({ 
  userId: 1, 
  jid: 1, 
  whatsappInstanceId: 1 
}, { 
  unique: true,
  partialFilterExpression: { 
    jid: { $exists: true, $ne: null },
    whatsappInstanceId: { $exists: true, $ne: null }
  },
  name: "unique_group_per_instance"
});

// ✅ ÍNDICE PARA BUSCA DE TEXTO
contactGroupSchema.index({
  name: 'text',
  description: 'text',
  'contacts.name': 'text',
  'contacts.pushName': 'text'
});

module.exports = mongoose.model('ContactGroup', contactGroupSchema);