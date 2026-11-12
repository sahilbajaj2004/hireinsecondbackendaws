const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

var Schema = mongoose.Schema;
const UserSchema = Schema({
    name: {
        type: String,
        required: false,
    },
    email: {
        type: String,
        required: false,
    },
    phone: {
        type: Number,
    },
    walletAddress: {
        type: String,
        required: true,
    },
});
const TempUser = new mongoose.model("TempUser", UserSchema);

// const Users = new mongoose.model("Users", UserSchema);
module.exports = TempUser;



