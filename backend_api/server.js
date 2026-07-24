require("dotenv").config();
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
app.use("/community", require("./routes/communityRoutes"));

const initializeSeniorRelationTables = () => {
  const createLinkCodeTable = `
    CREATE TABLE IF NOT EXISTS Senior_Link_Code (
      senior_id INT NOT NULL PRIMARY KEY,
      link_code VARCHAR(6) NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_Senior_Link_Code_Senior FOREIGN KEY (senior_id) REFERENCES Senior (senior_id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `;

  const createSeniorCaregiverTable = `
    CREATE TABLE IF NOT EXISTS Senior_has_Caregiver (
      senior_id INT NOT NULL,
      caregiver_id INT NOT NULL,
      PRIMARY KEY (senior_id, caregiver_id),
      KEY fk_Senior_has_Caregiver_Caregiver_idx (caregiver_id),
      CONSTRAINT fk_Senior_has_Caregiver_Senior FOREIGN KEY (senior_id) REFERENCES Senior (senior_id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_Senior_has_Caregiver_Caregiver FOREIGN KEY (caregiver_id) REFERENCES User_Account (user_id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `;

  db.query(createLinkCodeTable, (err) => {
    if (err) console.error('Failed to create Senior_Link_Code table:', err);
  });

  db.query(createSeniorCaregiverTable, (err) => {
    if (err) console.error('Failed to create Senior_has_Caregiver table:', err);
  });

  db.query("SHOW KEYS FROM Senior_has_Caregiver WHERE Key_name = 'PRIMARY'", (err, rows) => {
    if (err) {
      console.error('Failed to inspect Senior_has_Caregiver primary key:', err);
      return;
    }

    const primaryColumns = Array.isArray(rows)
      ? rows
          .sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index))
          .map((row) => row.Column_name)
      : [];

    if (primaryColumns.join(',') === 'senior_id') {
      db.query(
        "ALTER TABLE Senior_has_Caregiver DROP PRIMARY KEY, ADD PRIMARY KEY (senior_id, caregiver_id)",
        (alterErr) => {
          if (alterErr) {
            console.error('Failed to update Senior_has_Caregiver primary key:', alterErr);
          }
        }
      );
    }
  });
};

initializeSeniorRelationTables();

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
