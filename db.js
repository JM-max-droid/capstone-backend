const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected to Atlas');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message || err);
    process.exit(1); // stop server kung may error
  }
};

module.exports = connectDB;
