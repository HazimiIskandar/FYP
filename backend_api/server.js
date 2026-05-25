const express = require("express");
const cors = require("cors");
const db = require("./config/db");

const { monitorCheckIns } = require("./routes/escalationRoutes");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const checkinRoutes = require("./routes/checkInRoutes");
const emergencyRoutes = require("./routes/emergencyRoutes");
const rewardRoutes = require("./routes/rewardRoutes");
const seniorRoutes = require("./routes/seniorRoutes");

app.use("/checkin", checkinRoutes);
app.use("/emergency", emergencyRoutes);
app.use("/rewards", rewardRoutes);
app.use("/seniors", seniorRoutes);

// MySQL Connection is handled in config/db.js

// Test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Example API route (test query)
app.get("/test", (req, res) => {
  db.query("SELECT 1 + 1 AS result", (err, results) => {
    if (err) {
      res.status(500).send(err);
      return;
    }
    res.json(results);
  });
});

// Emergency Event
app.get("/emergency-events", (req, res) => {
  db.query("SELECT * FROM Emergency_Event", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});


// Daily CheckIn
app.get("/checkins", (req, res) => {
  db.query("SELECT * FROM Daily_CheckIn", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});


// User Account
app.get("/users", (req, res) => {
  db.query("SELECT * FROM User_Account", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// Escalation Timer
// runs every 10 minutes (real system)
setInterval(() => {
    console.log("Checking missed check-ins...");
    monitorCheckIns();
}, 600000);

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});