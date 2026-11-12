const express = require("express");
const {
  addContacts,
  addNewsLetter,
} = require("../controllers/contactController");
const { addQueries } = require("../controllers/queriesController");

const router = express.Router();

router.post("/addContacts", addContacts);
router.post("/addNewsLetter", addNewsLetter);
router.post("/addQueries", addQueries);

module.exports = router;
