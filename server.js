const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { PythonShell } = require("python-shell"); // Unused in current code; consider removing
require("dotenv").config();
const Review = require("./models/Review");
const Usercats = require("./models/user");
const path = require("path");
const { spawn } = require("child_process");
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000; // Changed to 3000 to match frontend expectation

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    dbName: "test",
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.error("MongoDB connection error:", error));

// Nodemailer Config
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "navizit27@gmail.com",
    pass: process.env.EMAIL_PASSWORD || "bhdi qsla ukfr mexx",
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

app.post("/api/signup", async (req, res) => {
  console.log("Received Signup Request:", req.body);
  const { email, username, password, category } = req.body;

  if (!email || !username || !password || !category || !Array.isArray(category) || category.length === 0) {
    return res.status(400).json({ message: "All fields, including a non-empty category array, are required." });
  }

  const existingUser = await Usercats.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    return res.status(400).json({ message: "Email or Username already exists" });
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
  const { email, otp, username, password, category } = req.body;

  console.log("Received Verify OTP Request:", req.body); // Debug log

  if (otpStore[email] === otp) {
    try {
      if (!email || !username || !password || !category || !Array.isArray(category) || category.length === 0) {
        return res.status(400).send("All fields, including a non-empty category array, are required.");
      }

      const existingUser = await Usercats.findOne({ $or: [{ email }, { username }] });

      if (existingUser) {
        return res.status(400).send("Email or Username already exists");
      }

      const newUser = new Usercats({ username, email, password, category });
      await newUser.save();
      console.log("Saved User:", newUser); // Debug log

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
    const user = await Usercats.findOne({ email, password });
    if (user) {
      res.status(200).json({ user });
    } else {
      res.status(400).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({ message: "Error logging in user", error: error.message });
  }
});

app.post("/api/recommend", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const pythonServiceUrl = "https://python1-mern-2.onrender.com/recommend";
  console.log(`Calling Python service at: ${pythonServiceUrl} with email: ${email}`);

  try {
    // Make POST request to the Python Flask service
    const response = await axios.post(pythonServiceUrl, { email }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const recommendations = response.data;

    // Handle different response scenarios from the Python service
    if (Array.isArray(recommendations)) {
      if (recommendations.length === 0) {
        return res.status(200).json({ 
          message: "No recommendations found for this email",
          recommendations: []
        });
      }
      return res.status(200).json({ recommendations });
    } else if (recommendations.message) {
      // Handle "No recommendations found" case from Flask
      return res.status(200).json({ 
        message: recommendations.message,
        recommendations: []
      });
    } else if (recommendations.error) {
      // Handle error messages from Flask
      return res.status(400).json({ error: recommendations.error });
    } else {
      throw new Error("Unexpected response format from Python service");
    }
  } catch (error) {
    console.error("Error calling Python service:", error.message);
    let errorDetails = error.response ? error.response.data : error.message;
    return res.status(500).json({
      error: "Failed to fetch recommendations from Python service",
      details: errorDetails
    });
  }
});

app.post("/api/ratingbase", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // Make a POST request to the Render-hosted Python service
    const response = await axios.post(
      "https://python2-mern.onrender.com/recommend_by_email",
      { email },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000, // Optional: Set a timeout (10 seconds) to avoid hanging
      }
    );

    const recommendations = response.data;

    // Validate that the response is an array
    if (!Array.isArray(recommendations)) {
      throw new Error("Response from Python service is not an array");
    }

    res.status(200).json({ recommendations });
  } catch (error) {
    console.error("Error fetching recommendations:", error.message);

    // Handle specific axios errors
    if (error.response) {
      // The request was made and the server responded with a status code outside 2xx
      return res.status(500).json({
        error: "Failed to fetch recommendations from Python service",
        details: error.response.data,
        status: error.response.status,
      });
    } else if (error.request) {
      // The request was made but no response was received
      return res.status(500).json({
        error: "No response from Python service",
        details: error.message,
      });
    } else {
      // Something else went wrong (e.g., parsing error, network issue)
      return res.status(500).json({
        error: "Error processing recommendation request",
        details: error.message,
      });
    }
  }
});

// 📌 Handle Undefined Routes
app.use((req, res) => {
  res.status(404).json({ message: "404 Not Found" });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
