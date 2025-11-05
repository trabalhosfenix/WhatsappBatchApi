const mongoose = require('mongoose');
const { Schema } = mongoose;

const limitSchema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppInstance', required: true },
  remaining: { type: Number, default: 150 },
  lastReset: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Limit', limitSchema);
