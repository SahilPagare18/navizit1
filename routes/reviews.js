const express = require("express");
const router = express.Router();

// Get all reviews for a specific location
router.get("/test/reviews/:location", async (req, res) => {
  const touristLocation = req.params.location; // Get the location from URL params
  try {
    const decodedLocation = decodeURIComponent(req.params.location);
    console.log("Fetching reviews for:", decodedLocation);
    const reviews = await Review.find({ touristLocation });
    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving reviews", error });
  }
});

// Submit a new review for a specific location
router.post("/test/reviews", async (req, res) => {
  const { heading, rating, comment, touristLocation, image } = req.body;

  // ✅ Validate all required fields, including heading
  if (!heading || !rating || !comment || !touristLocation || !image) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // ✅ Save heading along with other data
    const newReview = new Review({
      heading,
      rating,
      comment,
      touristLocation,
      image,
    });
    await newReview.save();
    res.status(201).json(newReview);
  } catch (error) {
    console.error("🚨 Error saving review:", error);
    res.status(500).json({ message: "Error saving review", error });
  }
});

module.exports = router;


