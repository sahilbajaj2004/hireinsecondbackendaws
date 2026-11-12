const passport = require("passport");
const Users = require("../models/userModel");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { checkRoleConflict } = require("../helpers/roleHelper");

/**
 * Stateless OAuth state store.
 *
 * `state` carries the requested `userType` through the Google round-trip.
 * passport-oauth2's built-in stores require express-session middleware,
 * which this backend does not run, so the session-based verification threw
 * on EVERY callback ("OAuth 2.0 authentication requires session support
 * when using state") and every Google login bounced back with
 * `?error=google_failed`. This pass-through store lets the state flow
 * through untouched.
 *
 * Trade-off: no CSRF validation of the state value. Acceptable for the
 * local setup; revisit (express-session or an HMAC-signed state) before
 * any public-facing release.
 */
const stateStore = {
  // Authorize: carry an explicit string `state`, otherwise the requested
  // userType from the query string.
  store(req, state, meta, cb) {
    const carried =
      typeof state === "string" && state ? state : req.query.userType || "";
    cb(null, carried);
  },
  // Callback: accept the state echoed back by Google verbatim.
  verify(req, providedState, cb) {
    cb(null, true);
  },
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
      store: stateStore,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        let user = await Users.findOne({ googleId: profile.id });

        const userType = req.query.state;
        const firstName = profile.name?.givenName || "";
        const lastName = profile.name?.familyName || "";


        if (!user) {
          const email = profile.emails?.[0]?.value;
          if (email) {
            user = await Users.findOne({ email });
            if (user) {
              user.googleId = profile.id;
              await user.save();
            }
          }
        }

        if (user) {
          const conflict = checkRoleConflict(user.userType, userType);
          if (conflict) {
            return done(null, false, { message: conflict });
          }
          if (userType && String(user.userType || "").toLowerCase() !== String(userType || "").toLowerCase()) {
            return done(null, false, { message: `This account is registered as ${user.userType}. Please use the matching portal.` });
          }
          return done(null, user);
        }
        else {
          user = await Users.create({
            googleId: profile.id,
            firstName,
            lastName,
            email: profile.emails?.[0]?.value || "",
            profilePic: profile.photos?.[0]?.value || "",
            userType,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

