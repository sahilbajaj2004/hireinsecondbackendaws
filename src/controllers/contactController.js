const { sendEmail } = require("../functions/utils");
const ContactsInquiries = require("../models/contactModel");
const NewsLetter = require("../models/newsLetterModal");

const addContacts = async (req, res) => {
  try {
    const { name, email, phone, queries } = req.body;
    const userObj = await ContactsInquiries.create({
      name,
      email,
      phone,
      queries,
    });
    if (userObj) {
      const payload = {
        subject: "Contact Inquiry Received",
        emailbody: `<!DOCTYPE html>
            <html lang="en">
            
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Hire In Second</title>
            </head>
            <body bgcolor="#0f3462" style="margin-top:20px;margin-bottom:20px;border-radius:20px">
              <!-- Main table -->
              <table border="0" align="center" cellspacing="0" cellpadding="0" bgcolor="white" width="650">
                <tr>
                  <td>
                    <!-- Child table -->
                    <table border="0" cellspacing="0" cellpadding="0" style="color:#0f3462; font-family: sans-serif;">
                      <tr>
                        <td>
                          <h2 style="text-align:center; margin: 0px; padding-bottom: 4px; margin-top: 15px; font-size: 26px; font-weight: 800; color: #0f3462; letter-spacing: -0.5px;">
                            HireInSecond
                          </h2>
                          <div style="text-align:center; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #64748b; margin-bottom: 20px;">
                            Tech Hiring &bull; Direct &bull; Verified
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                      
                        </td>
                      </tr>
                      <h4 style="margin: 0px;padding-bottom: 25px; text-transform: uppercase;">Name ::: ${name}</h4>
                      <h4 style="margin: 0px;padding-bottom: 25px; text-transform: uppercase;">Email ::: ${email}</h4>
                      <h4 style="margin: 0px;padding-bottom: 25px; text-transform: uppercase;">Phone ::: ${phone}</h4>

                      <tr>
          <td style="text-align: center;">
                          <p style=" margin: 0px 40px;padding-bottom: 25px;line-height: 2; font-size: 15px;">${queries}
                          </p>             
                        </td>
                      </tr>
                     
                      <tr>
                        <td style="text-align:center;">
                          <h2 style="padding-top: 25px; line-height: 1; margin:0px;">Need Help?</h2>
                          <div style="margin-bottom: 25px; font-size: 15px;margin-top:7px;">Connect with us at <b>supports@hireinsecond.com</b>
                          </div>
                        </td>
                      </tr>
                    </table>
                    <!-- /Child table -->
                  </td>
                </tr>
              </table>
              <!-- / Main table -->
            </body>
            
            </html>`,
        bodyType: "html",
        toEmail: `${"hireinsecond@gmail.com"}`,
      };
      await sendEmail(payload);
      res.status(200).json({
        success: true,
        message: "Contact Received",
      });
    } else {
      res.status(200).json({
        success: false,
        message: "Something went wrong",
      });
    }
  } catch (error) {
    console.log("error ==>> ", error);
    res.status(500).json({ success: false, error });
  }
};

const addNewsLetter = async (req, res) => {
  const { email } = req.body;
  try {
    const userObj = await NewsLetter.create({
      email,
    });
    if (userObj) {
      res.status(200).json({
        success: true,
        message: "News letter Received",
      });
    } else {
      res.status(200).json({
        success: false,
        message: "Something went wrong",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
};
module.exports = {
  addContacts,
  addNewsLetter,
};
