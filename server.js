const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const Review = require('./models/Review');

 // Import the review routes

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

// Use the routes under '/api'
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
    const { rating, comment, touristLocation } = req.body;
  
    // Check if all fields are present
    if (!rating || !comment || !touristLocation) {
      return res.status(400).json({ message: 'All fields are required' });
    }
  
    try {
      // Create a new review object
      const newReview = new Review({
        rating, 
        comment, 
        touristLocation
      });
  
      // Save the review to the database
      await newReview.save();
  
      // Respond with the saved review
      res.status(201).json(newReview);
  
    } catch (error) {
      res.status(500).json({ message: 'Error saving review', error });
    }
  });
  


// Define a simple error handler for undefined routes
app.use((req, res, next) => {
    res.status(404).send('404 Not Found');
    console.log("routes not found");
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


