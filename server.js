const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');

require('dotenv').config();
const Review = require('./models/Review'); 
const User = require('./models/user'); 

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3004;

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((error) => console.error('MongoDB connection error:', error));

// Nodemailer Config
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'navizit27@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'bhdi qsla ukfr mexx',
  },
});

let otpStore = {};

// 📌 Fetch Reviews (Including Image URL)
app.get('/test/reviews/:location', async (req, res) => {
  try {
    const reviews = await Review.find({ touristLocation: req.params.location });
    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving reviews', error });
  }
});

// 📌 Submit a Review (Including Image URL + Heading)
app.post('/test/reviews', async (req, res) => {
  const { heading, rating, comment, touristLocation, username, img } = req.body;

  // ✅ Validate all required fields, including heading
  if (!heading || !rating || !comment || !touristLocation || !username || !img) {
      return res.status(400).json({ message: 'All fields are required' });
  }

  try {
      const initial = username.charAt(0).toUpperCase(); // Extract first letter of username

      // ✅ Create a new Review document with heading included
      const newReview = new Review({
          heading,   // Added heading field
          rating,
          comment,
          touristLocation,
          username,
          initial,
          img, 
      });

      await newReview.save();
      res.status(201).json({ message: "Review submitted successfully!", review: newReview });
  } catch (error) {
      console.error("🚨 Error saving review:", error);
      res.status(500).json({ message: 'Error saving review', error: error.message });
  }
});

// 📌 User Signup (OTP Verification)
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).send("All fields are required");
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = otp;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'navizit27@gmail.com',
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}`,
    });

    res.status(200).send("OTP sent to your email.");
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).send("Error sending OTP");
  }
});

// 📌 Verify OTP & Create User
app.post("/api/verify-otp", async (req, res) => {
  const { email, otp, username, password } = req.body;

  if (otpStore[email] === otp) {
    try {
      if (!email || !username || !password) {
        return res.status(400).send("All fields are required.");
      }

      const existingUser = await User.findOne({ $or: [{ email }, { username }] });

      if (existingUser) {
        return res.status(400).send("Email or Username already exists");
      }

      const newUser = new User({ username, email, password });
      await newUser.save();

      delete otpStore[email];
      res.status(201).send("User signed up successfully");

    } catch (error) {
      console.error("Error signing up user:", error);
      res.status(500).send("Error signing up user");
    }
  } else {
    res.status(400).send("Invalid OTP");
  }
});

// 📌 User Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email, password });
    if (user) {
      res.status(200).json({ user });
    } else {
      res.status(400).send("Invalid email or password");
    }
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).send("Error logging in user");
  }
});

// 📌 Handle Undefined Routes
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

// 📌 Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});