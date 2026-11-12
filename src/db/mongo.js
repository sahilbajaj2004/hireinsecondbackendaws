const mongoose = require("mongoose");
const Users = require("../models/userModel");

mongoose
  .connect(process.env.DB_CONNECTION_STRING)
  .then(() => {
    console.log("connection successfull");
    // async function updateUsers() {
    //   try {
    //     const result = await Users.updateMany({}, { $set: { status: true } });
    //     console.log(`${result.nModified} documents updated successfully`);
    //   } catch (error) {
    //     console.error("Error occurred while updating documents:", error);
    //   } finally {
    //     mongoose.disconnect(); // Close the connection when done
    //   }
    // }

    // updateUsers();
  })
  .catch((err) => {
    console.log(err);
  });
