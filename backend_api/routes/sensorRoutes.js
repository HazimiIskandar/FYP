const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { processSensorAlert } = require("../services/sensorService");


// RECEIVE SENSOR DATA
//
// When sensor_status === "ALERT", hand off to sensorService.processSensorAlert
// which inserts Sensor_Alert → Emergency_Event → Notification. The HTTP
// response is immediate; the chain runs in the background and logs any
// failures via console.warn.
router.post("/", (req, res) => {

    const {
        senior_id,
        sensor_id,
        sensor_type,
        sensor_value,
        sensor_status,
        message,
    } = req.body;

    console.log("Sensor Data Received:", req.body);

    if (sensor_status === "ALERT") {
        console.log("Sensor alert triggered");

        // Fire-and-forget. Logged inside processSensorAlert for full audit.
        processSensorAlert({
            senior_id,
            sensor_id,
            sensor_type,
            sensor_value,
            sensor_status,
            message,
        });
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