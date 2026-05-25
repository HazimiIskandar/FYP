const express = require("express");
const router = express.Router();
const db = require("../config/db");

// CHECK-IN
router.post("/", (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: "Invalid request body" });
    }

    const { senior_id } = req.body;
    if (!senior_id) {
        return res.status(400).json({ error: "senior_id is required" });
    }

    const getReward = `
        SELECT reward_id, current_streak, total_points 
        FROM Reward_Streak 
        WHERE senior_id = ?
    `;

    const saveCheckIn = (rewardId) => {
        const insertCheckInReward = `
            INSERT INTO Daily_CheckIn (senior_id, checkin_status, reward_id)
            VALUES (?, 'Completed', ?)
        `;

        db.query(insertCheckInReward, [senior_id, rewardId], (err3) => {
            if (err3) return res.status(500).json(err3);

            res.json({ message: "Check-in successful" });
        });
    };

    db.query(getReward, [senior_id], (err2, rows) => {
        if (err2) return res.status(500).json(err2);

        if (rows.length === 0 || rows[0].reward_id == null) {

            const insertReward = `
                INSERT INTO Reward_Streak 
                (senior_id, current_streak, total_points)
                VALUES (?, 1, 10)
            `;

            db.query(insertReward, [senior_id], (err3, result3) => {
                if (err3) return res.status(500).json(err3);

                saveCheckIn(result3.insertId);
            });

            return;
        }

        let streak = rows[0].current_streak || 0;
        let points = rows[0].total_points || 0;
        let rewardId = rows[0].reward_id;

        let newStreak = streak + 1;
        let newPoints = points + 10;

        const updateReward = `
            UPDATE Reward_Streak
            SET current_streak = ?, total_points = ?
            WHERE senior_id = ?
        `;

        db.query(updateReward, [newStreak, newPoints, senior_id], (err3) => {
            if (err3) return res.status(500).json(err3);

            saveCheckIn(rewardId);
        });
    });
});


// GET CHECK-IN HISTORY
router.get("/:senior_id", (req, res) => {

    const sql = `
        SELECT * 
        FROM Daily_CheckIn
        WHERE senior_id = ?
        ORDER BY checkin_timestamp DESC
    `;

    db.query(sql, [req.params.senior_id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

module.exports = router;