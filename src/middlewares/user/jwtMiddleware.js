// const jwt = require("jsonwebtoken");
// const User = require("../../models/userModel");

// const userAuthorization = async (req, res, next) => {
//   let token;
//   if (
//     req.headers.authorization &&
//     req.headers.authorization.startsWith("Bearer")
//   ) {
//     try {
//       token = req.headers.authorization.split(" ")[1];
//       if (!token) {
//         return res.status(401).json({ error: "No Token" });
//       }
//       const decoded = jwt.verify(token, process.env.SECRET_KEY);
//       if (!decoded) {
//         return res.status(401).send({ success: false, error: "Unauthorized" });
//       }
//       req.decodedUser = decoded;
//       next();
//     } catch (error) {
//       console.error(error);
//       return res.status(401).send({ success: false, error });
//     }
//   }else {
//     return res.status(401).json({ error: "Unauthorized" });
//   }
// };

// module.exports = userAuthorization;








const passport = require("passport");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const User = require("../../models/userModel");

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey:  process.env.SECRET_KEY,  
}

passport.use(
  new JwtStrategy(opts, async (jwt_payload, done)=>{
    try{
      const user = await User.findById(jwt_payload.id);
      if(user){
        return done(null, user);
      } 
      else{
        return done(null, false);
      }
    }
    catch(err){
      return done(err, false);
    }
  })
);

const userAuthorization = passport.authenticate("jwt", {session: false});

module.exports =  {userAuthorization};