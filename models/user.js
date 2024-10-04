const mongoose = require('mongoose');

const UsersSchema = new mongoose.Schema({
  username: { type: String, required: true}, // Ensure username is unique and required
  email: { type: String, required: true },    // Ensure email is unique and required
  password: { type: String, required: true },
});

const Users = mongoose.model('Users', UsersSchema);
module.exports = Users;
