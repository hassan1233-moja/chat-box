require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

// Cloudinary এবং Multer Storage Cloudinary প্যাকেজ
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // ব্যাকআপের জন্য রাখা হলো

// Cloudinary কনফিগারেশন (.env ফাইল থেকে ভ্যালুগুলো রিড করবে)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer-এর মাধ্যমে ফাইল ও ছবি সরাসরি ক্লাউডিনারিতে পাঠানোর কনফিগারেশন
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'chatex_uploads', // ক্লাউডিনারিতে যে ফোল্ডারে ফাইলগুলো জমা হবে
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'webm', 'mp4', 'mp3'],
        resource_type: 'auto' // ইমেজ, ভিডিও, অডিও বা যেকোনো ফাইল স্বয়ংক্রিয়ভাবে ডিটেক্ট করবে
    },
});

const upload = multer({ storage: storage });

// ডাটাবেজ কানেকশন
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chatexDB')
    .then(() => console.log('MongoDB Connected Successfully!'))
    .catch(err => console.log('MongoDB Connection Error:', err));

// ১. রেজিস্ট্রেশন রাউট
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, phone, password } = req.body;
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ message: 'এই ফোন নম্বর দিয়ে ইতিমধ্যে অ্যাকাউন্ট রয়েছে!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, phone, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: 'Registration successful!' });
    } catch (err) {
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
});

// ২. লগইন রাউট
app.post('/api/auth/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(400).json({ message: 'ইউজার পাওয়া যায়নি!' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'ভুল পাসওয়ার্ড!' });
        }

        const token = jwt.sign({ id: user._id }, 'secret_key', { expiresIn: '7d' });
        res.json({ token, user: { username: user.username, phone: user.phone, profilePic: user.profilePic } });
    } catch (err) {
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
});

// ৩. প্রফাইল আপডেট রাউট
app.post('/api/user/update', async (req, res) => {
    try {
        const { currentPhone, newUsername, newPhone, newProfilePic } = req.body;
        const user = await User.findOne({ phone: currentPhone });
        if (!user) return res.status(404).json({ message: 'ইউজার পাওয়া যায়নি!' });

        if (newUsername) user.username = newUsername;
        if (newPhone) user.phone = newPhone;
        if (newProfilePic !== undefined) user.profilePic = newProfilePic;

        await user.save();
        res.json({ message: 'Profile updated successfully!', user });
    } catch (err) {
        res.status(500).json({ message: 'Server Error: ' + err.message });
    }
});

// ৪. ফাইল/ছবি/ভয়েস আপলোড রাউট (Cloudinary URL রিটার্ন করবে)
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'কোনো ফাইল আপলোড করা হয়নি!' });
    }
    // req.file.path-এর ভেতরে ক্লাউডিনারির পার্মানেন্ট সিকিউর URL পাওয়া যায়
    const fileUrl = req.file.path;
    res.json({ fileUrl, fileType: req.file.mimetype });
});

// Socket.io রিয়েল-টাইম চ্যাট ও কলিং লজিক
const activeUsers = new Map();

io.on('connection', (socket) => {
    socket.on('join_user', async (username) => {
        activeUsers.set(socket.id, username);
        updateAllFriendsList();
    });

    socket.on('search_and_add_friend', async ({ currentUsername, searchPhone }) => {
        try {
            const currentUser = await User.findOne({ username: currentUsername });
            const friendToAdd = await User.findOne({ phone: searchPhone });

            if (!friendToAdd) {
                socket.emit('friend_add_response', { success: false, message: 'এই নম্বরে কোনো ইউজার পাওয়া যায়নি!' });
                return;
            }

            if (currentUser._id.toString() === friendToAdd._id.toString()) {
                socket.emit('friend_add_response', { success: false, message: 'নিজের নম্বর অ্যাড করতে পারবেন না!' });
                return;
            }

            if (currentUser.friends.includes(friendToAdd._id)) {
                socket.emit('friend_add_response', { success: false, message: 'তিনি ইতিমধ্যে আপনার ফ্রেন্ড লিস্টে আছেন!' });
                return;
            }

            currentUser.friends.push(friendToAdd._id);
            await currentUser.save();

            // উভয়পক্ষকে ফ্রেন্ড হিসেবে যুক্ত করা (মিউচুয়াল কানেকশন)
            if (!friendToAdd.friends.includes(currentUser._id)) {
                friendToAdd.friends.push(currentUser._id);
                await friendToAdd.save();
            }

            socket.emit('friend_add_response', { success: true, message: `${friendToAdd.username} সফলভাবে ফ্রেন্ড হিসেবে যুক্ত হয়েছেন!` });
            updateAllFriendsList();
        } catch (err) {
            socket.emit('friend_add_response', { success: false, message: 'ত্রুটি ঘটেছে!' });
        }
    });

    // পুরনো মেসেজ লোড করার নিরাপদ লজিক
    socket.on('load_old_messages', async (data) => {
        try {
            if (!data || !data.user1 || !data.user2) return;

            const { user1, user2 } = data;
            const messages = await Message.find({
                $or: [
                    { sender: user1, receiver: user2 },
                    { sender: user2, receiver: user1 }
                ]
            }).sort({ createdAt: 1 });

            socket.emit('old_messages_loaded', messages);
        } catch (err) {
            console.log('Load message error:', err);
        }
    });

    // চ্যাট মেসেজ রিসিভ, ডাটাবেজে সেভ এবং ইউজারের কাছে পাঠানোর লজিক
    socket.on('chat message', async (data) => {
        try {
            const newMessage = new Message({
                sender: data.sender,
                receiver: data.receiver,
                text: data.text,
                fileUrl: data.fileUrl || '',
                fileType: data.fileType || ''
            });
            await newMessage.save();

            const receiverSocketId = Array.from(activeUsers.entries()).find(([id, name]) => name === data.receiver)?.[0];
            const senderSocketId = socket.id;

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('chat message', data);
            }
            io.to(senderSocketId).emit('chat message', data);

        } catch (err) {
            console.log('Message save error:', err);
        }
    });

    // কলিং সিগন্যালিং ইভেন্টসমূহ
    socket.on('call_offer', (data) => {
        const targetSocketId = Array.from(activeUsers.entries()).find(([id, name]) => name === data.to)?.[0];
        if (targetSocketId) {
            io.to(targetSocketId).emit('incoming_call', { from: activeUsers.get(socket.id), offer: data.offer, isVideo: data.isVideo });
        }
    });

    socket.on('call_answer', (data) => {
        const targetSocketId = Array.from(activeUsers.entries()).find(([id, name]) => name === data.to)?.[0];
        if (targetSocketId) {
            io.to(targetSocketId).emit('call_answered', { answer: data.answer });
        }
    });

    socket.on('ice_candidate', (data) => {
        const targetSocketId = Array.from(activeUsers.entries()).find(([id, name]) => name === data.to)?.[0];
        if (targetSocketId) {
            io.to(targetSocketId).emit('ice_candidate', { candidate: data.candidate });
        }
    });

    socket.on('end_call', (data) => {
        const targetSocketId = Array.from(activeUsers.entries()).find(([id, name]) => name === data.to)?.[0];
        if (targetSocketId) {
            io.to(targetSocketId).emit('end_call');
        }
    });

    socket.on('disconnect', () => {
        activeUsers.delete(socket.id);
        updateAllFriendsList();
    });
});

async function updateAllFriendsList() {
    for (let [socketId, username] of activeUsers.entries()) {
        const user = await User.findOne({ username }).populate('friends', 'username phone profilePic');
        if (user) {
            const friendsData = user.friends.map(f => ({
                username: f.username,
                phone: f.phone,
                profilePic: f.profilePic || '',
                isOnline: Array.from(activeUsers.values()).includes(f.username)
            }));
            io.to(socketId).emit('update_friend_list', friendsData);
        }
    }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));