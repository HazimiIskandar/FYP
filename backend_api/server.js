const express = require("express");
const cors = require("cors");
const db = require("./config/db");

const { monitorCheckIns } = require("./routes/escalationRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
// ROUTES (MODULAR)
// =========================
app.use("/checkin", require("./routes/checkInRoutes"));
app.use("/emergency", require("./routes/emergencyRoutes"));
app.use("/rewards", require("./routes/rewardRoutes"));
app.use("/seniors", require("./routes/seniorRoutes"));
app.use("/escalation", require("./routes/escalationRoutes"));
app.use("/nok", require("./routes/nokRoutes"));
app.use("/notifications", require("./routes/notificationRoutes"));
app.use("/medical", require("./routes/medicalConditionRoutes"));
app.use("/staff", require("./routes/staffRoutes"));
app.use("/users", require("./routes/userAccountRoutes"));
app.use("/sensors", require("./routes/sensorRoutes"));
app.use("/caregiver", require("./routes/caregiverRoutes"));

const createAccountRoutes = require("./routes/createaccountroutes");
app.use("/api/create-account", createAccountRoutes);

// =========================
// HEALTH CHECK
// =========================
app.get("/", (req, res) => {
  res.send("API is running...");
});

// =========================
// TEST ROUTE
// =========================
app.get("/test", (req, res) => {
  db.query("SELECT 1 + 1 AS result", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// =========================
// EMERGENCY EVENTS
// =========================
app.get("/emergency-events", (req, res) => {
  db.query(
    "SELECT * FROM Emergency_Event ORDER BY created_at DESC",
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

// =========================
// DAILY CHECK-INS
// =========================
app.get("/checkins", (req, res) => {
  db.query(
    "SELECT * FROM Daily_CheckIn ORDER BY checkin_timestamp DESC",
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

// =========================
// USER ACCOUNTS
// =========================
app.get("/users", (req, res) => {
  db.query(
    "SELECT * FROM User_Account",
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

// =========================
// ESCALATION MONITOR
// =========================
// runs every 10 minutes
setInterval(() => {
  console.log("[ESCALATION] Checking missed check-ins...");
  monitorCheckIns();
}, 600000);

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});