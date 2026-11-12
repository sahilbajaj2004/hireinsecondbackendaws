const WalletQueries = require("../models/walletModel");

const addStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const userObj = await WalletQueries.create({
      status,
    });
    if (userObj) {
      res.status(200).json({
        success: true,
        message: "User added successfully",
      });
    }
  } catch (error) {
    console.log("error ==>> ", error);
    res.status(500).json({ success: false, error });
  }
};

const getStatus = async (req, res) => {
  try {
    const datas = await WalletQueries.find();
    res.status(200).json({
      success: true,
      message: "Successfully fetched data",
      data: datas,
    });
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};
module.exports = {
  addStatus,
  getStatus,
};
