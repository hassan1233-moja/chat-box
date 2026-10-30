const mongoose = require('mongoose');

// Chat Message Schema Structure
const messageSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    }
}, { timestamps: true }); // এটি মেসেজ পাঠানোর সঠিক সময় সেভ রাখবে

module.exports = mongoose.model('Message', messageSchema);