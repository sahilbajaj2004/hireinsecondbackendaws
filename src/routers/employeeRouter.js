const express = require("express");
const { userAuthorization } = require("../middlewares/user/jwtMiddleware");
const {
  addEmployee,
  getEmployees,
  updateEmployee,
  getAdminEmployees,
  deactivateEmployee,
  getEmployeeById,
  updateEmployeeStatus
} = require("../controllers/employeeController");
const router = express.Router();

router.post("/addEmployee", userAuthorization, addEmployee);
router.get("/getEmployees", getEmployees);
router.post("/updateEmployee", userAuthorization, updateEmployee);
router.get("/getAdminEmployees", userAuthorization, getAdminEmployees);
router.post("/deactivateEmployee", userAuthorization, deactivateEmployee);
router.get("/getEmployeeById/:id", userAuthorization, getEmployeeById);
router.post("/updateEmployeeStatus", userAuthorization, updateEmployeeStatus);

module.exports = router;
