const mongoose = require('mongoose');

const whatsappInstanceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
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
    }
}, {
    timestamps: true
});

whatsappInstanceSchema.index({ userId: 1, sessionName: 1 });

module.exports = mongoose.model('WhatsAppInstance', whatsappInstanceSchema);