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

// 📌 Recommendation System (Fetching and Running recommendation.py)
app.post("/api/recommend", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const pythonScriptPath = path.join(__dirname, "ml", "recommendation.py");
  console.log("Script path:", pythonScriptPath);
  const pythonProcess = spawn("python", [pythonScriptPath, email]);

  let output = "";
  let errorOutput = "";

  pythonProcess.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });

  pythonProcess.stderr.on("data", (chunk) => {
    errorOutput += chunk.toString();
  });

  pythonProcess.on("close", (code) => {
    console.log(`Python script exited with code ${code}`);
    console.log("Raw stdout:", output.trim());
    console.log("Raw stderr:", errorOutput.trim());

    if (code !== 0) {
      return res.status(500).json({
        error: "Failed to generate recommendations",
        details: errorOutput || "Unknown error",
      });
    }

    if (!output.trim()) {
      return res.status(500).json({ error: "No output received from recommendation script" });
    }

    try {
      const recommendations = JSON.parse(output.trim());
      res.status(200).json({ recommendations });
    } catch (error) {
      console.error("Error parsing recommendations:", error.message);
      res.status(500).json({
        error: "Failed to parse recommendations",
        rawOutput: output.trim(),
      });
    }
  });

  pythonProcess.on("error", (err) => {
    console.error("Spawn error:", err.message);
    res.status(500).json({ error: "Failed to start recommendation script", details: err.message });
  });
});


app.post("/api/ratingbase", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const pythonScriptPath = path.join(__dirname, "ml", "ratingbase.py");
  console.log("Script path:", pythonScriptPath);

  const pythonProcess = spawn("python", [pythonScriptPath, email]);

  let output = "";
  let errorOutput = "";

  // Capture stdout (expected JSON response)
  pythonProcess.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
 
  // Capture stderr (for debugging)
  pythonProcess.stderr.on("data", (chunk) => {
    errorOutput += chunk.toString();
  });

  pythonProcess.on("close", (code) => {
    console.log(`Python script exited with code ${code}`);
    console.log("Raw stdout:", output.trim());
    console.log("Raw stderr:", errorOutput.trim());

    if (code !== 0) {
      return res.status(500).json({
        error: "Failed to generate recommendations",
        details: errorOutput || "Unknown error",
      });
    }

    if (!output.trim()) {
      return res.status(500).json({ error: "No output received from recommendation script" });
    }

    try {
      // Ensure output is valid JSON
      const recommendations = JSON.parse(output.trim());

      if (!Array.isArray(recommendations)) {
        throw new Error("Parsed output is not an array");
      }

      res.status(200).json({ recommendations });
    } catch (error) {
      console.error("Error parsing recommendations:", error.message);
      res.status(500).json({
        error: "Failed to parse recommendations",
        rawOutput: output.trim(),
      });
    }
  });

  pythonProcess.on("error", (err) => {
    console.error("Spawn error:", err.message);
    res.status(500).json({ error: "Failed to start recommendation script", details: err.message });
  });
});

// 📌 Handle Undefined Routes
app.use((req, res) => {
  res.status(404).json({ message: "404 Not Found" });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));