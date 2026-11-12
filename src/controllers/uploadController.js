const cloudinary = require("cloudinary").v2;
const fs = require("fs").promises;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFile = async (req, res) => {
  const { file } = req;

  try {
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }
    const uploadResult = await cloudinary.uploader.upload(file.path);
    await fs.unlink(file.path);
    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        fileUrl: uploadResult.url,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong",
      error,
    });
  }
};

module.exports = { uploadFile };
