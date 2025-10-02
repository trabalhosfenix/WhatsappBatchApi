const mongoose = require('mongoose');

const messageLogSchema = new mongoose.Schema({
    sessionName: {
        type: String,
        required: true,
        index: true
    },
    jid: {
        type: String,
        required: true,
        index: true
    },
    message: {
        type: String,
        required: true
    },
    direction: {
        type: String,
        enum: ['incoming', 'outgoing'],
        required: true
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'failed', 'received'],
        required: true
    },
    messageId: {
        type: String,
        index: true
    },
    mediaType: String,
    error: String,
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    senderName: String
}, {
    timestamps: true
});

// Índices para performance
messageLogSchema.index({ sessionName: 1, timestamp: -1 });
messageLogSchema.index({ jid: 1, timestamp: -1 });

module.exports = mongoose.model('MessageLog', messageLogSchema);