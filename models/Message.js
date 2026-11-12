const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    text: { type: String },
    fileUrl: { type: String, default: '' },
    fileType: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);