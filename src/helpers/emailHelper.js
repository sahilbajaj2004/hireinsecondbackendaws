const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtpout.secureserver.net",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
});

/**
 * Returns the compressed webp logo attachment with inline CID for email clients.
 * Falls back to favicon.ico if webp is not found.
 */
function getLogoAttachment() {
  const webpPath = path.resolve(__dirname, "../../public/logo-icon.webp");
  const fallbackIcoPath = path.resolve(__dirname, "../../public/favicon.ico");
  const chosenPath = fs.existsSync(webpPath) ? webpPath : fallbackIcoPath;
  const isWebp = chosenPath.endsWith(".webp");

  return [
    {
      filename: isWebp ? "logo-icon.webp" : "favicon.ico",
      path: chosenPath,
      cid: "logo",
      contentType: isWebp ? "image/webp" : "image/x-icon",
    },
  ];
}

/**
 * Builds responsive, branded HTML email matching the exact template format used across
 * HireInSecond (navy #0f3462 backdrop, centered card, logo header, and Need Help footer).
 */
function createBrandedHtmlEmail({ subject, bodyHtml, recipientName }) {
  const greeting = recipientName ? `Hi, ${recipientName}` : "Hi there,";
  const year = new Date().getFullYear();

  // Convert plain text newlines to clean paragraphs if not already HTML
  let formattedContent = bodyHtml;
  if (!/<[a-z][\s\S]*>/i.test(bodyHtml)) {
    formattedContent = bodyHtml
      .split(/\n\s*\n/)
      .map(
        (para) =>
          `<p style="margin: 0 0 16px 0; line-height: 1.8; color: #2d3748; font-size: 15px;">${para.replace(/\n/g, "<br/>")}</p>`
      )
      .join("");
  }

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject || "Hire In Second"}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>table, td, div, p, h1 { font-family: Arial, Helvetica, sans-serif !important; }</style>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }

    /* Styles for whatever lands inside ${formattedContent} */
    .content p { margin: 0 0 16px 0; }
    .content p:last-child { margin-bottom: 0; }
    .content a { color: #0f3462; font-weight: 600; text-decoration: underline; }
    .content ul, .content ol { margin: 0 0 16px 0; padding-left: 22px; }
    .content li { margin-bottom: 6px; }
    .content strong, .content b { color: #0f3462; }

    @media only screen and (max-width: 640px) {
      .outer { padding: 12px 8px !important; }
      .px { padding-left: 24px !important; padding-right: 24px !important; }
      .headline { font-size: 24px !important; line-height: 1.25 !important; }
    }
  </style>
</head>
<body bgcolor="#0f3462" style="margin: 0; padding: 0; background-color: #0f3462; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

  <!-- Preheader: the grey preview text shown in the inbox list -->
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all; font-size: 1px; line-height: 1px; color: #0f3462;">
    ${subject || "Hire In Second"}&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;
  </div>

  <!-- Main content -->
  <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" bgcolor="#0f3462" style="background-color: #0f3462;">
    <tr>
      <td align="center" class="outer" style="padding: 32px 16px;">

        <!-- Card -->
        <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="600" bgcolor="#ffffff" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 12px;">

          <!-- Coral top edge -->
          <tr>
            <td height="5" bgcolor="#f08080" style="height: 5px; line-height: 5px; font-size: 5px; background-color: #f08080; border-radius: 12px 12px 0 0;">&nbsp;</td>
          </tr>

          <!-- Brand row -->
          <tr>
            <td class="px" style="padding: 28px 40px 0 40px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="middle" style="padding-right: 12px;">
                    <img src="cid:logo" alt="Hire In Second" width="44" height="44" style="display: block; width: 44px; height: 44px; object-fit: contain;" />
                  </td>
                  <td valign="middle" style="font-size: 20px; font-weight: 700; color: #0f3462; letter-spacing: -0.3px;">
                    HireInSecond
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td class="px" style="padding: 32px 40px 0 40px;">
              <h1 class="headline" style="margin: 0; font-size: 28px; line-height: 1.25; font-weight: 700; color: #0f3462; letter-spacing: -0.5px;">
                ${subject || "Announcement"}
              </h1>
            </td>
          </tr>

          <!-- Greeting + body -->
          <tr>
            <td class="px" style="padding: 24px 40px 8px 40px;">
              <p style="margin: 0 0 14px 0; font-size: 16px; line-height: 1.5; font-weight: 600; color: #0f3462;">
                ${greeting}
              </p>
              <div class="content" style="font-size: 16px; line-height: 1.65; color: #2d3748;">
                ${formattedContent}
              </div>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td class="px" style="padding: 24px 40px 36px 40px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid #e6ebf2; padding-top: 20px; font-size: 14px; line-height: 1.6; color: #718096;">
                    Regards,<br />
                    <strong style="font-size: 15px; color: #0f3462;">The Hire In Second Team</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="px" bgcolor="#f5f8fc" style="padding: 24px 40px; background-color: #f5f8fc; border-top: 1px solid #e6ebf2; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 4px 0; font-size: 14px; line-height: 1.5; font-weight: 600; color: #0f3462;">
                Need help?
              </p>
              <p style="margin: 0 0 8px 0; font-size: 14px; line-height: 1.5; color: #4a5568;">
                Write to us at
                <a href="mailto:support@hireinsecond.com" style="color: #0f3462; font-weight: 600; text-decoration: underline;">support@hireinsecond.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a0aec0;">
                &copy; ${year} <a href="https://hireinsecond.com" target="_blank" style="color: #718096; text-decoration: underline;">HireInSecond</a> Inc. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Send single email via verified SMTP transporter with inline webp logo attachment.
 */
async function sendSingleEmail({ to, subject, html, text }) {
  const mailOptions = {
    from: `"HireInSecond" <${process.env.SMTP_USER || "support@hireinsecond.com"}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    attachments: getLogoAttachment(),
  };

  return await transporter.sendMail(mailOptions);
}

/**
 * Dispatch emails in rate-controlled batches to avoid overwhelming SMTP connections.
 */
async function sendBatchEmails(recipients, { subject, bodyHtml, batchSize = 10, delayMs = 350 }) {
  let deliveredCount = 0;
  let failedCount = 0;
  const errors = [];

  for (let i = 0; i < recipients.length; i += batchSize) {
    const chunk = recipients.slice(i, i + batchSize);

    const chunkPromises = chunk.map(async (r) => {
      const email = typeof r === "string" ? r : r.email;
      const name = typeof r === "object" ? `${r.firstName || ""} ${r.lastName || ""}`.trim() : "";

      if (!email || !email.includes("@") || email.endsWith("@phone.hireinsecond.com")) {
        return { success: false, email, error: "Invalid email" };
      }

      try {
        const personalizedHtml = createBrandedHtmlEmail({
          subject,
          bodyHtml,
          recipientName: name,
        });

        await sendSingleEmail({
          to: email,
          subject,
          html: personalizedHtml,
        });

        return { success: true, email };
      } catch (err) {
        return { success: false, email, error: err.message };
      }
    });

    const results = await Promise.all(chunkPromises);
    for (const res of results) {
      if (res.success) {
        deliveredCount++;
      } else {
        failedCount++;
        if (res.error && errors.length < 10) {
          errors.push(`${res.email}: ${res.error}`);
        }
      }
    }

    // Small delay between batches to respect SMTP connection limits
    if (i + batchSize < recipients.length && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    total: recipients.length,
    deliveredCount,
    failedCount,
    errors,
  };
}

module.exports = {
  createBrandedHtmlEmail,
  sendSingleEmail,
  sendBatchEmails,
  transporter,
  getLogoAttachment,
};
