// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true 
    },
    password: {
        type: String,
        required: true
    },
    balance: {
        type: Number,
        default: 1000.00 // Saldo inicial, por exemplo
    }
});

module.exports = mongoose.model('User', UserSchema);