const axios = require("axios");

const verifyRecaptcha = async (token) =>{
    const url = `https://www.google.com/recaptcha/api/siteverify`;

    const params = new URLSearchParams();
    params.append("secret", process.env.RECAPTCHA_SECRET_KEY);
    params.append("response", token);

    const res = await axios.post(url, params);

    return res.data.success;
}

module.exports= verifyRecaptcha;