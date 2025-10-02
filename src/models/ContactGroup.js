// 📁 models/ContactGroup.js - MANTER APENAS ESTE
// models/ContactGroup.js - SCHEMA ATUALIZADO
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
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
    whatsappId: {
        type: String,
        default: null
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    customFields: {
        type: Map,
        of: String,
        default: {}
    }
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
        maxlength: 500
    },
    contacts: [contactSchema],
    contactCount: {
        type: Number,
        default: 0
    },
    // NOVOS CAMPOS PARA WHATSAPP
    jid: {
        type: String,
        default: null,
        index: true
    },
    whatsappGroupId: {
        type: String,
        default: null
    },
    participantCount: {
        type: Number,
        default: 0
    },
    source: {
        type: String,
        enum: ['manual', 'whatsapp'],
        default: 'manual'
    },
    whatsappInstanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WhatsAppInstance',
        default: null
    }
}, {
    timestamps: true
});

contactGroupSchema.pre('save', function(next) {
    this.contactCount = this.contacts.length;
    next();
});

// Índices para busca eficiente
contactGroupSchema.index({ userId: 1, name: 1 });
contactGroupSchema.index({ userId: 1, source: 1 });
contactGroupSchema.index({ userId: 1, jid: 1 });
contactGroupSchema.index({ userId: 1, whatsappInstanceId: 1 });

module.exports = mongoose.model('ContactGroup', contactGroupSchema);