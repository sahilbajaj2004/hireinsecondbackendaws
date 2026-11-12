const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const WalletModel = Schema({
  status: {
    type: Boolean,
    required: true,
  },
});

const WalletQueries = new mongoose.model("WalletQueries", WalletModel);
module.exports = WalletQueries;
