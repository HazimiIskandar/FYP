const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "cplofo.h.filess.io",
  user: "senior_connect_curiousago",
  password: "fe9c8311734fbb029d7fec8b715366ee54ec0751",
  database: "senior_connect_curiousago",
  port: 61032,
  timezone: "+08:00", // Singapore Time (SGT). Applied to every query on this connection.
});

db.connect((err) => {
  if (err) {
    console.log("Database connection failed:", err);
    return;
  }
  console.log("MySQL Database Connected Successfully");
});

module.exports = db;