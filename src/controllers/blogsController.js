const Blogs = require("../models/blogModel");

const addBlogs = async (req, res) => {
  const { blogTitle, blogSubTitle, imageUrl, category } = req.body;
  try {
    const data = await Blogs.create({
      blogTitle,
      blogSubTitle,
      imageUrl,
      category,
    });
    if (data) {
      res.status(200).json({ success: true });
    } else {
      res.status(200).json({ success: false });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error });
  }
};

const updateBlogs = async (req, res) => {
  const { _id, blogTitle, blogSubTitle, imageUrl, category, status } = req.body;
  try {
    const data = await Blogs.findByIdAndUpdate(_id, {
      blogTitle,
      blogSubTitle,
      imageUrl,
      category,
      status
    });
    if (data) {
      res.status(200).json({ success: true, data });
    } else {
      res.status(200).json({ success: false });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error });
  }
}

const deleteBlogs = async (req, res) => {
  const { _id } = req.body;
  try {
    const data = await Blogs.findByIdAndDelete(_id);
    if (data) {
      res.status(200).json({ success: true, data });
    } else {
      res.status(200).json({ success: false });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error });
  }
}

const getBlogs = async (req, res) => {
  try {
    const data = await Blogs.find();
    if (data) {
      res.status(200).json({ success: true, data });
    } else {
      res.status(200).json({ success: false });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};

const getBlogsById = async (req, res) => {
  const blogId = req.params.id;

  try {
    const data = await Blogs.findById(blogId);
    if (data) {
      res.status(200).json({ success: true, data });
    } else {
      res.status(200).json({ success: false });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};
module.exports = { addBlogs, getBlogs, getBlogsById, updateBlogs, deleteBlogs };
