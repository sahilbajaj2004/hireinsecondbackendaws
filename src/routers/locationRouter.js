const express = require("express");
const {
  getAddressFromCoOrdintes,
  getCountries,
  getStates,
  getLocalities,
  detectIpLocation,
} = require("../controllers/locationcontroller");

const router = express.Router();

router.get("/getAddress", getAddressFromCoOrdintes);
router.get("/getCountries", getCountries);
router.get("/getStates", getStates);
router.get("/location/getLocalities", getLocalities);
router.get("/getLocalities", getLocalities);
router.get("/location/detectIpLocation", detectIpLocation);
router.get("/detectIpLocation", detectIpLocation);

module.exports = router;
