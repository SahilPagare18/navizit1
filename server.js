// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');

require('dotenv').config();
const Review = require('./models/Review');
const User = require('./models/user'); // Correctly imported user model

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3004; // Use environment variable for PORT

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((error) => console.error('MongoDB connection error:', error));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'navizit27@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'bhdi qsla ukfr mexx',
  },
});

let otpStore = {};

app.get('/test/reviews/:location', async (req, res) => {
  const { location } = req.params; // Get the location from the request params
  try {
    // Fetch reviews based on the tourist location
    const reviews = await Review.find({ touristLocation: location });
    res.status(200).json(reviews);  // Send the retrieved reviews as JSON
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving reviews', error });
  }
});

app.post('/test/reviews', async (req, res) => {
  const { rating, comment, touristLocation, user } = req.body;

  // Check if all fields are present
  if (!rating || !comment || !touristLocation || !user) {
      return res.status(400).json({ message: 'All fields are required' });
  }

  try {
      // Extract the initial from the username
      const initial = user.charAt(0).toUpperCase(); // Get the first letter and capitalize it

      // Create a new review object
      const newReview = new Review({
          rating,
          comment,
          touristLocation,
          user,
          initial // Associate the review with the user
      });

      // Save the new review to the database
      await newReview.save();
      res.status(201).json(newReview);
  } catch (error) {
      res.status(500).json({ message: 'Error saving review', error });
  }
});


// Endpoint for user signup
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).send("All fields are required");
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit OTP
  otpStore[email] = otp;

  const mailOptions = {
    from: process.env.EMAIL_USER || 'navizit27@gmail.com',
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send("OTP sent to your email.");
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).send("Error sending OTP");
  }
});

// Endpoint for verifying OTP and signing up user
app.post("/api/verify-otp", async (req, res) => {
  const { email, otp, username, password } = req.body;

  // Log received data for debugging
  console.log("Received Data:", { email, otp, username, password });

  // Check if OTP is correct
  if (otpStore[email] === otp) {
    try {
      // Ensure email and username are not null or empty
      if (!email || !username || !password) {
        return res.status(400).send("Error: All fields are required.");
      }

      // Check if email or username already exists in the database
      const existingEmail = await User.findOne({ email });
      const existingUsername = await User.findOne({ username });

      if (existingEmail) {
        return res.status(400).send("Error: Email already exists");
      }
      if (existingUsername) {
        return res.status(400).send("Error: Username already exists");
      }

      // Create the new user
      const newUser = new User({ username, email, password });
      await newUser.save();

      // Clear OTP and respond with success
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



// Endpoint for user login
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

// Define a simple error handler for undefined routes
app.use((req, res, next) => {
  res.status(404).send('404 Not Found');
  console.log("Route not found");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
