const axios = require("axios");

const generateNumericOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// const sendEmail = async (payload) => {
//   const url = process.env.EMAIL_URL;
//   const emailResponse = await axios.post(url, payload);
//   console.log("4.0", emailResponse)
//   return emailResponse;
// };


const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,        // e.g. mail.hireinsecond.com
  port: Number(process.env.SMTP_PORT) || 465,
  secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

 async function sendEmail(payload) {
  try {
    const webpPath = path.resolve(__dirname, "../../public/logo-icon.webp");
    const fallbackPath = path.resolve(__dirname, "../../public/favicon.ico");
    const logoFile = fs.existsSync(webpPath) ? webpPath : (fs.existsSync("./public/logo-icon.webp") ? "./public/logo-icon.webp" : fallbackPath);
    const isWebp = logoFile.endsWith(".webp");

    const mailOptions = {
      from: `"HireInSecond" <${process.env.SMTP_USER}>`,
      to: payload?.toEmail,
      subject: payload?.subject,
      html: `
      <div style="text-align:center;">
        <img src="cid:logo" style="height: 60px !important; width: 60px !important; display: block; margin: 0 auto; object-fit: contain;"/>
      </div>
      ${payload?.emailbody}
      `,
      attachments: [
        {
          filename: isWebp ? "logo-icon.webp" : "favicon.ico",
          path: logoFile,
          cid: "logo",
          contentType: isWebp ? "image/webp" : "image/x-icon",
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log(" OTP Email sent successfully to", payload.email);
  } catch (error) {
    console.error(" Error sending email:", error);
  }
}

module.exports = { generateNumericOtp, sendEmail };
