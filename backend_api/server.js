const express = require("express");
const cors = require("cors");
const db = require("./config/db");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------------
// DEBUG STARTUP LOG
// -------------------------
console.log("🔥 SERVER FILE LOADED");

// -------------------------
// ROUTES
// -------------------------
const checkinRoutes = require("./routes/checkInRoutes");
const emergencyRoutes = require("./routes/emergencyRoutes");
const rewardRoutes = require("./routes/rewardRoutes");
const seniorRoutes = require("./routes/seniorRoutes");
const escalationRoutes = require("./routes/escalationRoutes");
const nokRoutes = require("./routes/nokRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const medicalConditionRoutes = require("./routes/medicalConditionRoutes");
const staffRoutes = require("./routes/staffRoutes");
const userAccountRoutes = require("./routes/userAccountRoutes");

// -------------------------
// ROUTE DEBUG LOGS
// -------------------------
console.log("checkinRoutes type:", typeof checkinRoutes);
console.log("emergencyRoutes type:", typeof emergencyRoutes);
console.log("rewardRoutes type:", typeof rewardRoutes);
console.log("seniorRoutes type:", typeof seniorRoutes);
console.log("escalationRoutes type:", typeof escalationRoutes);
console.log("nokRoutes type:", typeof nokRoutes);
console.log("notificationRoutes type:", typeof notificationRoutes);
console.log("medicalConditionRoutes type:", typeof medicalConditionRoutes);
console.log("staffRoutes type:", typeof staffRoutes);
console.log("userAccountRoutes type:", typeof userAccountRoutes);

// -------------------------
// USE ROUTES
// -------------------------
app.use("/checkin", checkinRoutes);
app.use("/emergency", emergencyRoutes);
app.use("/rewards", rewardRoutes);
app.use("/seniors", seniorRoutes);
app.use("/escalation", escalationRoutes);
app.use("/nok", nokRoutes);
app.use("/notifications", notificationRoutes);
app.use("/medical", medicalConditionRoutes);
app.use("/staff", staffRoutes);
app.use("/users", userAccountRoutes);

// -------------------------
// TEST ROUTE
// -------------------------
app.get("/", (req, res) => {
  res.send("API is running...");
});

app.get("/test", (req, res) => {
  db.query("SELECT 1 + 1 AS result", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// -------------------------
// EMERGENCY EVENTS
// -------------------------
app.get("/emergency-events", (req, res) => {
  db.query("SELECT * FROM Emergency_Event", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// -------------------------
// DAILY CHECKINS
// -------------------------
app.get("/checkins", (req, res) => {
  db.query("SELECT * FROM Daily_CheckIn", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// -------------------------
// USERS
// -------------------------
app.get("/users", (req, res) => {
  db.query("SELECT * FROM User_Account", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// -------------------------
// ESCALATION TIMER
// -------------------------
setInterval(() => {
  console.log("⏰ Checking missed check-ins...");
}, 600000);

// -------------------------
// START SERVER
// -------------------------
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});