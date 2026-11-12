const fetch = require("node-fetch");
const moment = require("moment");

const apiToken = async () => {
  const requestOptions = {
    method: "GET",
    headers: {
      Accept: "application/json",
      "api-token":
        "Einq8KZaJLfI1NeOpLIoMJ1-EOW56DzelUxTFDoQ_QhKOdiaOfpiQncAgM9BJ98bClQ",
      "user-email": "rahuljha3246@gmail.com",
    },
  };

  const response = await fetch(
    `https://www.universal-tutorial.com/api/getaccesstoken`,
    requestOptions
  );

  if (!response.ok) {
    return false;
  } else {
    const data = await response.json();
    return `Bearer ${data?.auth_token}`;
  }
};
const getMonthName = (monthIndex) => {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return monthNames[monthIndex];
};

// Helper function to get the start and end dates of a month
const getMonthDateRange = (year, month) => {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999); // Last second of the month
  return { startDate, endDate };
};

// Helper function to get day name
const getDayName = (date) => {
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return dayNames[date.getDay()];
};

// Helper function to get the start and end of the day
const getDayDateRange = (date) => {
  const startDate = new Date(date.setHours(0, 0, 0, 0)); // Start of the day
  const endDate = new Date(date.setHours(23, 59, 59, 999)); // End of the day
  return { startDate, endDate };
};

// Helper function to get the last Sunday
const getLastSunday = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const lastSunday = new Date(today.setDate(today.getDate() - dayOfWeek));
  return lastSunday;
};

const dateDifference = async (date) => {
  console.log(date);
  const date1 = moment(date, "YYYY-MM-DD"); // Example date
  const today = moment(new Date(), "YYYY-MM-DD"); // Current date
  console.log(today);
  const daysDifference = today.diff(date1, "days");
  console.log(`Difference: ${daysDifference} days`);
  return daysDifference;
};
module.exports = {
  apiToken,
  getMonthName,
  getMonthDateRange,
  getDayDateRange,
  getDayName,
  getLastSunday,
  dateDifference,
};
