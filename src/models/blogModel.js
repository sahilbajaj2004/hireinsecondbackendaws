const mongoose = require("mongoose");

var Schema = mongoose.Schema;
const BlogSchema = Schema(
  {
    blogTitle: {
      type: String,
      required: true,
    },
    blogSubTitle: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      default: "ACTIVE",
    },
    category: {
      type: String,
      default: "admin",
    },
  },
  { timestamps: true }
);

const Blogs = new mongoose.model("Blogs", BlogSchema);
module.exports = Blogs;
