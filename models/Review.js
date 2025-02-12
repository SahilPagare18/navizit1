const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
    heading: { type: String, required: true },  // ✅ Ensure heading is stored,
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    touristLocation: { type: String, required: true },
    username: { type: String, required: true },
    initial: { type: String, required: true },
    img: { type: String, required: true } // New field for storing image URL
});

const Review = mongoose.model('Review', ReviewSchema);
module.exports = Review;