const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ১. নতুন ইউজার রেজিস্ট্রেশন বা সাইন-আপ করার লজিক
exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // চেক করা এই ইমেইল দিয়ে ইতোমধ্যে কোনো ইউজার আছে কি না
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'ഈ ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট খোলা হয়েছে!' });
        }

        // পাসওয়ার্ড সিকিউর বা হ্যাশ (Hash) করার জন্য সল্ট (Salt) তৈরি করা
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // নতুন ইউজার ডাটাবেসে সেভ করার জন্য তৈরি করা
        user = new User({
            username,
            email,
            password: hashedPassword
        });

        await user.save();

        res.status(201).json({ message: 'রেজিস্ট্রেশন সফল হয়েছে! 🎉' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('সার্ভারে সমস্যা হয়েছে!');
    }
};

// ২. ইউজার লগইন করার লজিক
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // ডাটাবেসে ইমেইলটি খোঁজা
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'ভুল ইমেইল বা পাসওয়ার্ড!' });
        }

        // ইউজার যে পাসওয়ার্ড দিয়েছে তা ডাটাবেসের হ্যাশ করা পাসওয়ার্ডের সাথে মিলে কি না চেক করা
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'ভুল ইমেইল বা পাসওয়ার্ড!' });
        }

        // সফলভাবে লগইন হলে একটি সিকিউরড JWT টোকেন তৈরি করা (মেয়াদ ৭ দিন)
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('সার্ভারে সমস্যা হয়েছে!');
    }
};