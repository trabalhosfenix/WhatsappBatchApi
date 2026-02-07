const mongoose = require('mongoose');

const whatsappInstanceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    sessionName: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['connected', 'disconnected', 'connecting', 'failed'],
        default: 'disconnected'
    },
    qrCode: String,
    phoneNumber: String,
    lastConnection: Date,
    isActive: {
        type: Boolean,
        default: true
    },
    ownerNode: {
        type: String,
        default: null,
        trim: true
    },
    lastHeartbeat: {
        type: Date,
        default: null
    },
    version: {
        type: Number,
        default: 1
    },
    connectionState: {
        type: String,
        enum: ['disconnected', 'connecting', 'qr', 'connected', 'reconnecting', 'error'],
        default: 'disconnected'
    },
    reconnectAttempts: {
        type: Number,
        default: 0
    },
    lastErrorCode: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

whatsappInstanceSchema.index({ userId: 1, sessionName: 1 });
whatsappInstanceSchema.index({ ownerNode: 1, connectionState: 1 });
whatsappInstanceSchema.index({ lastHeartbeat: 1 });

module.exports = mongoose.model('WhatsAppInstance', whatsappInstanceSchema);
