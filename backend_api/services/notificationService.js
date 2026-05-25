const db = require("../config/db");

// ================= CREATE NOTIFICATION =================
const createNotification = (
    recipient_type,
    recipient_name,
    senior_id,
    event_id = null,
    checkin_id = null
) => {

    const sql = `
        INSERT INTO Notification
        (
            recipient_type,
            recipient_name,
            notification_status,
            senior_id,
            event_id,
            checkin_id
        )
        VALUES (?, ?, 'Sent', ?, ?, ?)
    `;

    db.query(
        sql,
        [
            recipient_type,
            recipient_name,
            senior_id,
            event_id,
            checkin_id
        ],
        (err) => {
            if (err) {
                console.log(err);
            } else {
                console.log("Notification created");
            }
        }
    );
};

module.exports = {
    createNotification
};