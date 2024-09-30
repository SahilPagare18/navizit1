const mongoose = require('mongoose');

// Create schema for reviews
const reviewSchema = new mongoose.Schema({
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    touristLocation: { type: String, required: true }
});

// Export the model
const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
