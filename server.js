require('dotenv').config(); // .env ফাইল থেকে গোপন ভ্যারিয়েবল লোড করার জন্য
const express = require('express');
const http = require('http'); // Node.js এর বিল্ট-ইন HTTP সার্ভার মডিউল
const { Server } = require('socket.io'); // Socket.io থেকে Server ক্লাসটি নিয়ে আসা হলো
const cors = require('cors'); // CORS সিকিউরিটি পলিসি হ্যান্ডেল করার জন্য
const connectDB = require('./config/db'); // আমাদের তৈরি করা ডাটাবেস কানেকশন ফাইল
const authRoutes = require('./routes/authRoutes');
const Message = require('./models/Message'); // মেসেজ মডেল

const app = express();
const server = http.createServer(app); // Express অ্যাপ দিয়ে একটি HTTP সার্ভার তৈরি করা হলো
const io = new Server(server); // HTTP সার্ভারের উপর Socket.io চালু করা হলো

// Database Connect Call
connectDB();

// Middleware
app.use(cors()); // ফ্রন্টএন্ড ও ব্যাকএন্ড সংযোগ সহজ করার জন্য
app.use(express.json()); // ফ্রন্টএন্ড থেকে পাঠানো JSON ডেটা পড়ার জন্য
app.use(express.static('public')); // 'public' ফোল্ডারের ফাইলগুলো ব্রাউজারে দেখানোর জন্য

// Auth Routes যুক্ত করা
app.use('/api/auth', authRoutes);

// Basic Test Route
app.get('/', (req, res) => {
    res.send('Chat App Server is running smoothly! 🚀');
});

// ১. অনলাইন ইউজারদের ট্র্যাক করার জন্য ম্যাপ
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log('A user connected! ID:', socket.id);

    // পুরোনো মেসেজ লোড করা
    socket.on('load_old_messages', async () => {
        try {
            const previousMessages = await Message.find().sort({ createdAt: 1 }).limit(50);
            socket.emit('load_old_messages', previousMessages);
        } catch (err) {
            console.error('Error loading old messages:', err);
        }
    });

    // ইউজার জয়েন করলে ম্যাপে সেভ করা এবং সবাইকে লিস্ট পাঠানো
    socket.on('join_user', (username) => {
        if (username) {
            activeUsers.set(socket.id, username);
            console.log(`User Joined: ${username} (Socket ID: ${socket.id})`);

            // সব ক্লায়েন্টের কাছে আপডেট লিস্ট পাঠিয়ে দেওয়া
            const userList = Array.from(activeUsers.values());
            io.emit('update_user_list', userList);
        }
    });

    // নতুন চ্যাট মেসেজ হ্যান্ডেল করা এবং ডাটাবেসে সেভ করা
    socket.on('chat message', async (data) => {
        console.log('📥 Server theke paowa chat message:', data);
        try {
            // ক্লায়েন্ট থেকে text বা message যে নামেই আসুক না কেন, তা ধরে নেব
            const messageText = data.text || data.message;

            if (!messageText) {
                console.error('Error: Message text is missing!');
                return;
            }

            const newMessage = new Message({
                sender: data.sender,
                message: messageText // এখানে সঠিক ভ্যারিয়েবলটি পাস করা হলো
            });
            await newMessage.save();

            // সবার কাছে মেসেজ পাঠিয়ে দেওয়া (যাতে সব ক্লায়েন্ট text প্রপার্টি পায়)
            io.emit('chat message', {
                sender: data.sender,
                text: messageText
            });
        } catch (err) {
            console.error('Error saving message:', err);
        }
    });
    // ডিসকানেক্ট হলে লিস্ট থেকে বাদ দেওয়া
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        activeUsers.delete(socket.id);
        io.emit('update_user_list', Array.from(activeUsers.values()));
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT} 🚀`);
});