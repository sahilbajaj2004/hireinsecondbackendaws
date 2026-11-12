const express = require('express')
const passport = require('passport')
const { OAuth2Client } = require('google-auth-library')
const generateToken = require('../functions/jwtHelper')
const { userAuthorization } = require('../middlewares/user/jwtMiddleware');
const Users = require('../models/userModel');
const { checkRoleConflict } = require('../helpers/roleHelper');

const router = express.Router();
// Allow up to 6 hours clock skew tolerance to handle local development machine clock drift vs Google's NTP servers
OAuth2Client.CLOCK_SKEW_SECS_ = 21600;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Native Mobile Google Sign-In
 * POST /api/auth/google
 * Body: { idToken, userType }
 */
router.post("/google", async (req, res) => {
    try {
        const { idToken, userType = "personal" } = req.body;
        if (!idToken) {
            return res.status(400).json({ success: false, message: "idToken is required" });
        }

        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: [
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_WEB_CLIENT_ID,
                ].filter(Boolean),
            });
            payload = ticket.getPayload();
        } catch (verifyErr) {
            try {
                const ticket = await googleClient.verifyIdToken({ idToken });
                payload = ticket.getPayload();
            } catch (e2) {
                console.error("Google token verification failed:", verifyErr.message, e2?.message);
                const isExpired = verifyErr.message && verifyErr.message.includes("Token used too late");
                return res.status(401).json({
                    success: false,
                    message: isExpired
                        ? "Google token expired. Please sign out and sign in again."
                        : `Invalid Google token: ${verifyErr.message || e2?.message || "verification failed"}`,
                });
            }
        }

        if (!payload || !payload.sub) {
            return res.status(401).json({ success: false, message: "Invalid Google payload" });
        }

        const googleId = payload.sub;
        const email = (payload.email || "").toLowerCase();
        const firstName = payload.given_name || payload.name?.split(" ")[0] || "";
        const lastName = payload.family_name || payload.name?.split(" ").slice(1).join(" ") || "";
        const picture = payload.picture || "";

        let isNewUser = false;
        let user = await Users.findOne({ googleId });
        if (!user && email) {
            user = await Users.findOne({ email });
            if (user) {
                user.googleId = googleId;
                if (!user.profilePic && picture) user.profilePic = picture;
                await user.save();
            }
        }

        if (user) {
            if (user.status === false) {
                return res.status(401).json({
                    success: false,
                    message: "Your account is deactivated, please contact support team",
                });
            }

            const conflict = checkRoleConflict(user.userType, userType);
            if (conflict) {
                return res.status(400).json({
                    success: false,
                    code: "ROLE_CONFLICT",
                    message: conflict,
                });
            }
        } else {
            isNewUser = true;
            user = await Users.create({
                googleId,
                firstName,
                lastName,
                email,
                profilePic: picture,
                userType,
                status: true,
                otpVerified: true,
                isProfileCompleted: false,
            });
        }

        const token = generateToken({
            id: user._id,
            email: user.email,
            userType: user.userType,
        });

        const userObj = user.toObject ? user.toObject() : { ...user };
        delete userObj.password;
        userObj.isNewUser = isNewUser;

        return res.status(200).json({
            success: true,
            isNewUser,
            data: userObj,
            token,
        });
    } catch (err) {
        console.error("POST /auth/google error:", err);
        return res.status(500).json({ success: false, message: err.message || "Google auth error" });
    }
});

router.get("/google", (req, res, next) => {
    const userType = req.query.userType;

    passport.authenticate("google", {
        scope: ["profile", "email"],  // Permissions requested from Google
        prompt: "select_account",
        state: userType,
    })(req, res, next);
});


router.get(
    "/google/callback",
    (req, res, next) => {
        passport.authenticate("google", { session: false }, (err, user, info) => {
            // Handle authentication failure
            if (err || !user) {
                console.error("Google Auth Failed:", err || info?.message);
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`);
            }

            // Attach user to request for next handler
            req.user = user;
            next();
        })(req, res, next);
    },
    (req, res) => {
        try {
            const token = generateToken({
                id: req.user._id,
                email: req.user.email,
                userType: req.user.userType,
            });

            // Don't echo issued JWTs to the server logs.

            // Encode token to safely send via URL
            const encodedToken = encodeURIComponent(token);

            // Redirect frontend with JWT token
            res.redirect(`${process.env.FRONTEND_URL}/AuthSuccess?token=${encodedToken}`);
        } catch (error) {
            console.error("Google Login Error:", error);
            res.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`);
        }
    }
);


router.get("/me", userAuthorization, async (req, res) => {
    try {
        const user = await Users.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.json({ success: true, user });
    } catch (err) {
        console.error("Error in /me route:", err);
        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
});



// export default router
module.exports = router;