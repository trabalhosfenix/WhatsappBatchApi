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
  }
}, {
  timestamps: true
});

contactGroupSchema.pre('save', function(next) {
  this.contactCount = this.contacts.length;
  next();
});

module.exports = mongoose.model('ContactGroup', contactGroupSchema);