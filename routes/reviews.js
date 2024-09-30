const express = require('express');
const router = express.Router();


// Get all reviews for a specific location
router.get('/test/reviews/:location', async (req, res) => {
    const touristLocation = req.params.location;  // Get the location from URL params
    try {
        const reviews = await Review.find({ touristLocation });
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving reviews', error });
    }
});

// Submit a new review for a specific location
router.post('/test/reviews', async (req, res) => {
    const { rating, comment, touristLocation } = req.body;
    if (!rating || !comment || !touristLocation) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    try {
        const newReview = new Review({ rating, comment, touristLocation });
        await newReview.save();
        res.status(201).json(newReview);
    } catch (error) {
        res.status(500).json({ message: 'Error saving review', error });
    }
});

module.exports = router;
