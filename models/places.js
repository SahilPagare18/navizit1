const mongoose = require("mongoose");

const placeSchema = new mongoose.Schema({
  heading: { type: String, required: true },
  image: { type: String}, 
  para: { type: String }, 
  category: { type: String}, 
});

const Place = mongoose.model("PlaceUpdate", placeSchema);
module.exports = Place;