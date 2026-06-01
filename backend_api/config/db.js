const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "cplofo.h.filess.io",
  user: "senior_connect_curiousago",
  password: "fe9c8311734fbb029d7fec8b715366ee54ec0751",
  database: "senior_connect_curiousago",
  port: 61032,
});

db.connect((err) => {
  if (err) {
    console.log("Database connection failed:", err);
  } else {
    console.log("✅ MySQL Connected");
  }
});

module.exports = db;