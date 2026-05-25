const express = require("express");
const router = express.Router();
const db = require("../config/db");

// CHECK-IN
router.post("/", (req, res) => {
    const { senior_id } = req.body;

    // 1. Insert into Daily_CheckIn
    const insertCheckIn = `
        INSERT INTO Daily_CheckIn (senior_id, checkin_status)
        VALUES (?, 'Completed')
    `;

    db.query(insertCheckIn, [senior_id], (err, result) => {
        if (err) return res.send(err);

        const checkin_id = result.insertId;

        // 2. Update Reward_Streak 
        const getReward = `
            SELECT * FROM Reward_Streak WHERE senior_id = ?
        `;

        db.query(getReward, [senior_id], (err2, rows) => {
            if (err2) return res.send(err2);

            let today = new Date();

            if (rows.length === 0) {
                const insertReward = `
                    INSERT INTO Reward_Streak 
                    (senior_id, current_streak, total_points)
                    VALUES (?, 1, 10)
                `;

                db.query(insertReward, [senior_id]);
                return res.send("First check-in recorded");
            }

            let streak = rows[0].current_streak || 0;
            let points = rows[0].total_points || 0;

            let newStreak = streak + 1;
            let newPoints = points + 10;

            const updateReward = `
                UPDATE Reward_Streak
                SET current_streak = ?, total_points = ?
                WHERE senior_id = ?
            `;

            db.query(updateReward, [newStreak, newPoints, senior_id]);

            res.send("Check-in successful");
        });
    });
});


// GET THE CHECK-IN HISTORY
router.get("/:senior_id", (req, res) => {

    const sql = `
        SELECT * FROM Daily_CheckIn
        WHERE senior_id = ?
        ORDER BY checkin_timestamp DESC
    `;

    db.query(sql, [req.params.senior_id], (err, result) => {
        if (err) return res.send(err);
        res.json(result);
    });
});

module.exports = router;