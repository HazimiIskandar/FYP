const express = require("express");
const router = express.Router();
const db = require("../config/db");


// GET REWARD STREAK 
router.get("/:senior_id", (req, res) => {

    const sql = `
        SELECT * FROM Reward_Streak
        WHERE senior_id = ?
    `;

    db.query(sql, [req.params.senior_id], (err, result) => {
        if (err) return res.send(err);

        res.json(result[0]);
    });
});


// REDEEM REWARD 
router.post("/redeem", (req, res) => {

    const { senior_id, reward_name } = req.body;

    const sql = `
        UPDATE Reward_Streak
        SET reward_redeemed = ?, redemption_date = NOW()
        WHERE senior_id = ?
    `;

    db.query(sql, [reward_name, senior_id], (err) => {
        if (err) return res.send(err);

        res.send("Reward redeemed successfully");
    });
});

module.exports = router;