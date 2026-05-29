const express = require("express");
const router = express.Router();
const db = require("../config/db");


// RECEIVE SENSOR DATA 
router.post("/", (req, res) => {

    const {
        senior_id,
        sensor_type,
        sensor_value,
        sensor_status
    } = req.body;

    console.log("Sensor Data Received:", req.body);

    // Example logic
    if (sensor_status === "ALERT") {

        console.log("Sensor alert triggered");

        // future:
        // createEmergencyEvent()
        // sendNotification()
    }

    res.send("Sensor data received");
});


// GET SENSOR LOGS 
router.get("/:senior_id", (req, res) => {

    // demo response
    res.json({
        senior_id: req.params.senior_id,
        sensor_status: "Normal",
        last_updated: new Date()
    });
});

module.exports = router;