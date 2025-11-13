const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  participantId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  pushName: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100
  },
  remoteJid: {
    type: String,
    required: true,
    trim: true
  },
  firstMessageTimestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  lastMessageTimestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  messageCount: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Índices para melhor performance
participantSchema.index({ participantId: 1 });
participantSchema.index({ phoneNumber: 1 });
participantSchema.index({ remoteJid: 1 });
participantSchema.index({ lastMessageTimestamp: -1 });

// Método estático para upsert (inserir ou atualizar)
participantSchema.statics.upsertParticipant = async function(participantData) {
  const { participantId, phoneNumber, pushName, remoteJid } = participantData;
  
  const existingParticipant = await this.findOne({ participantId });
  
  if (existingParticipant) {
    // Atualiza dados existentes
    return await this.findOneAndUpdate(
      { participantId },
      {
        $set: {
          pushName: pushName || existingParticipant.pushName,
          phoneNumber: phoneNumber || existingParticipant.phoneNumber,
          lastMessageTimestamp: new Date()
        },
        $inc: { messageCount: 1 }
      },
      { new: true }
    );
  } else {
    // Cria novo participante
    return await this.create({
      participantId,
      phoneNumber,
      pushName,
      remoteJid,
      firstMessageTimestamp: new Date(),
      lastMessageTimestamp: new Date()
    });
  }
};

// Método para JSON seguro (sem campos internos)
participantSchema.methods.toJSON = function() {
  const participant = this.toObject();
  delete participant.__v;
  return participant;
};

module.exports = mongoose.model('Participant', participantSchema);