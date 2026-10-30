const mongoose = require('mongoose');

// User Schema Structure
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    }
}, { timestamps: true }); // এটি অ্যাকাউন্ট তৈরির সঠিক সময় সেভ রাখবে

module.exports = mongoose.model('User', userSchema);