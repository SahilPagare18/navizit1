const mongoose = require("mongoose");

const UsersSchema= new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  category: { type: [String], required: true }, // ✅ Array of Strings
});

const UserwithCat = mongoose.model("UserwithCat", UsersSchema);
module.exports = UserwithCat;
