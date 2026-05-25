const express = require("express");
const mysql = require("mysql");
const cors = require("cors");

const { monitorCheckIns } = require("./routes/escalationRoutes");

const app = express();
app.use(cors());
app.use(express.json());

// routes
const checkinRoutes = require("./routes/checkinRoutes");
const emergencyRoutes = require("./routes/emergencyRoutes");

app.use("/checkin", checkinRoutes);
app.use("/emergency", emergencyRoutes);

// MySQL Connection (filess.io)
const con = mysql.createConnection({
  host: "cplofo.h.filess.io",
  user: "senior_connect_curiousago",
  password: "fe9c8311734fbb029d7fec8b715366ee54ec0751",
  database: "senior_connect_curiousago",
  port: 61032,
});

// Connect DB
con.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("✅ Connected to MySQL database!");
});

// Test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Example API route (test query)
app.get("/test", (req, res) => {
  con.query("SELECT 1 + 1 AS result", (err, results) => {
    if (err) {
      res.status(500).send(err);
      return;
    }
    res.json(results);
  });
});

// Senior Table
app.get("/seniors", (req, res) => {
  con.query("SELECT * FROM Senior", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});


// Emergency Event
app.get("/emergency-events", (req, res) => {
  con.query("SELECT * FROM Emergency_Event", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});


// Daily CheckIn
app.get("/checkins", (req, res) => {
  con.query("SELECT * FROM Daily_CheckIn", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});


// Reward Streak
app.get("/rewards", (req, res) => {
  con.query("SELECT * FROM Reward_Streak", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});


// User Account
app.get("/users", (req, res) => {
  con.query("SELECT * FROM User_Account", (err, results) => {
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
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});