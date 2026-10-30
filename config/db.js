const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // এখানে dbName দিয়ে স্পষ্টভাবে 'chatbox-app' বলে দেওয়া হলো
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: 'chatbox-app'
        });
        console.log('MongoDB Connected Successfully! ✅');
    } catch (err) {
        console.log('DB Connection Error: ❌', err.message);
        process.exit(1); // কোনো এরর হলে সার্ভার বন্ধ করে দেবে
    }
};

module.exports = connectDB;