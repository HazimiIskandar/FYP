const express = require("express");
const router = express.Router();
const db = require("../config/db");
const caregiverServiceNow = require("../services/caregiverServiceNow.dev316146");

function fetchAssigneeByUserId(userId) {
  return new Promise((resolve) => {
    if (!userId) return resolve(null);
    const sql = `
      SELECT user_id, full_name, email
      FROM User_Account
      WHERE user_id = ?
      LIMIT 1
    `;
    db.query(sql, [userId], (err, rows) => {
      if (err || !Array.isArray(rows) || rows.length === 0) {
        return resolve(null);
      }
      resolve(rows[0]);
    });
  });
}

const ASSIGNED_CASES_SQL = `
        SELECT
            ee.senior_id,
            ee.event_id,
            ee.event_status,
            ee.event_type,
            ee.escalation_level,
            ee.created_at,
            MAX(eh.escalation_time) AS assigned_at,
            GROUP_CONCAT(DISTINCT ua2.full_name SEPARATOR ', ') AS assigned_staff_names,
            GROUP_CONCAT(DISTINCT ua2.user_id SEPARATOR ',') AS assigned_staff_user_ids
        FROM Escalation_History eh
        JOIN Emergency_Event ee
            ON eh.event_id = ee.event_id
        JOIN Senior s
            ON ee.senior_id = s.senior_id
        JOIN User_Account ua
            ON s.user_id = ua.user_id
        LEFT JOIN Escalation_Assignment ea
            ON eh.escalation_id = ea.escalation_id
        LEFT JOIN AIC_Staff aic
            ON ea.staff_id = aic.staff_id
        LEFT JOIN User_Account ua2
            ON aic.user_id = ua2.user_id
        WHERE ua.full_name IS NOT NULL
          AND TRIM(ua.full_name) <> ''
          AND ua.role_id = 1
          AND ee.event_type != 'Missed Check-In'
        GROUP BY
            ee.event_id,
            ee.senior_id,
            ee.event_status,
            ee.event_type,
            ee.escalation_level,
            ee.created_at
        ORDER BY assigned_at DESC, ee.senior_id ASC
`;

router.get("/", (req, res) => {
  db.query("SELECT * FROM AIC_Staff", (err, result) => {
    if (err) return res.send(err);
    res.json(result);
  });
});

router.get("/assigned-cases/by-user/:user_id", (req, res) => {
  const userId = req.params.user_id;

  const staffSql = `
        SELECT staff_id
        FROM AIC_Staff
        WHERE user_id = ?
        LIMIT 1
    `;

  db.query(staffSql, [userId], (staffErr, staffRows) => {
    if (staffErr) return res.status(500).json({ error: staffErr.message || staffErr });

    const staffId =
      Array.isArray(staffRows) && staffRows.length ? staffRows[0].staff_id : null;

    db.query(ASSIGNED_CASES_SQL, (casesErr, casesRows) => {
      if (casesErr) return res.status(500).json({ error: casesErr.message || casesErr });
      res.json({ staff_id: staffId, cases: Array.isArray(casesRows) ? casesRows : [] });
    });
  });
});

router.post("/case/:event_id/status", (req, res) => {
  const eventId = Number(req.params.event_id);
  const { status, comment, staff_user_id } = req.body;
  const validStatuses = [
    "Open",
    "New",
    "In Progress",
    "On Hold",
    "Resolved",
    "Closed",
    "Cancelled",
  ];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: `status is required and must be one of ${validStatuses.join(", ")}`,
    });
  }

  const updateEventSql = `
        UPDATE Emergency_Event
        SET event_status = ?
        WHERE event_id = ?
    `;

  db.query(updateEventSql, [status, eventId], (updateErr, updateResult) => {
    if (updateErr) return res.status(500).json({ error: updateErr.message || updateErr });
    if (!updateResult || updateResult.affectedRows === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const escalatedTo = staff_user_id ? `AIC Staff ${staff_user_id}` : "AIC Staff";
    const escalationStatus = comment ? `${status} - ${String(comment).trim()}` : status;
    const insertHistorySql = `
            INSERT INTO Escalation_History
            (event_id, escalated_to, escalation_status)
            VALUES (?, ?, ?)
        `;

    db.query(insertHistorySql, [eventId, escalatedTo, escalationStatus], (historyErr) => {
      if (historyErr) {
        console.error("Failed to insert escalation history:", historyErr.message || historyErr);
      }

      const seniorSql = `
                SELECT s.senior_id, ua.full_name, ee.event_type
                FROM Emergency_Event ee
                JOIN Senior s ON ee.senior_id = s.senior_id
                JOIN User_Account ua ON s.user_id = ua.user_id
                WHERE ee.event_id = ?
                LIMIT 1
            `;

      db.query(seniorSql, [eventId], async (seniorErr, seniorRows) => {
        if (seniorErr) {
          return res.status(500).json({ error: seniorErr.message || seniorErr });
        }

        const seniorName =
          Array.isArray(seniorRows) && seniorRows[0] ? seniorRows[0].full_name : null;
        const eventType =
          Array.isArray(seniorRows) && seniorRows[0] ? seniorRows[0].event_type : null;
        const assignee = await fetchAssigneeByUserId(staff_user_id || null);

        if (!seniorName) {
          return res.json({ ok: true, event_id: eventId, status, serviceNowUpdated: false });
        }

        try {
          const serviceNowUpdated = await caregiverServiceNow.updateIncidentState(
            seniorName,
            status,
            comment || `Case updated to ${status}`,
            {
              eventType,
              assignee: assignee
                ? {
                    userId: assignee.user_id,
                    fullName: assignee.full_name,
                    email: assignee.email,
                  }
                : null,
            }
          );
          res.json({ ok: true, event_id: eventId, status, serviceNowUpdated });
        } catch (snErr) {
          console.error("ServiceNow update failed:", snErr);
          res.json({ ok: true, event_id: eventId, status, serviceNowUpdated: false });
        }
      });
    });
  });
});

router.post("/case/:event_id/assign", (req, res) => {
  const eventId = Number(req.params.event_id);
  const { user_id, comment } = req.body;

  if (!eventId) {
    return res.status(400).json({ error: "event_id is required" });
  }
  if (!user_id) {
    return res.status(400).json({ error: "user_id is required to assign case" });
  }

  const staffSql = `
        SELECT staff_id
        FROM AIC_Staff
        WHERE user_id = ?
        LIMIT 1
    `;

  db.query(staffSql, [user_id], (staffErr, staffRows) => {
    if (staffErr) return res.status(500).json({ error: staffErr.message || staffErr });
    if (!Array.isArray(staffRows) || staffRows.length === 0) {
      return res.status(400).json({ error: "AIC staff record not found for this user" });
    }

    const staffId = staffRows[0].staff_id;
    const updateEventSql = `
            UPDATE Emergency_Event
            SET event_status = 'In Progress'
            WHERE event_id = ?
        `;

    db.query(updateEventSql, [eventId], (updateErr, updateResult) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message || updateErr });
      if (!updateResult || updateResult.affectedRows === 0) {
        return res.status(404).json({ error: "Event not found" });
      }

      const escalationNote = comment
        ? `Assigned to staff ${staffId}: ${String(comment).trim()}`
        : `Assigned to staff ${staffId}`;
      const insertHistorySql = `
                INSERT INTO Escalation_History
                (event_id, escalated_to, escalation_status)
                VALUES (?, ?, ?)
            `;

      db.query(insertHistorySql, [eventId, `AIC Staff ${staffId}`, escalationNote], (historyErr, historyResult) => {
        if (historyErr) {
          console.error("Failed to insert escalation history:", historyErr.message || historyErr);
        }

        const escalationId = historyResult?.insertId;
        if (escalationId) {
          const insertAssignmentSql = `
                        INSERT IGNORE INTO Escalation_Assignment
                        (staff_id, escalation_id)
                        VALUES (?, ?)
                    `;

          db.query(insertAssignmentSql, [staffId, escalationId], (assignErr) => {
            if (assignErr) {
              console.error("Failed to insert escalation assignment:", assignErr.message || assignErr);
            }
          });
        }

        const seniorSql = `
                    SELECT s.senior_id, ua.full_name, ee.event_type
                    FROM Emergency_Event ee
                    JOIN Senior s ON ee.senior_id = s.senior_id
                    JOIN User_Account ua ON s.user_id = ua.user_id
                    WHERE ee.event_id = ?
                    LIMIT 1
                `;

        db.query(seniorSql, [eventId], async (seniorErr, seniorRows) => {
          if (seniorErr) {
            return res.status(500).json({ error: seniorErr.message || seniorErr });
          }

          const seniorName =
            Array.isArray(seniorRows) && seniorRows[0] ? seniorRows[0].full_name : null;
          const eventType =
            Array.isArray(seniorRows) && seniorRows[0] ? seniorRows[0].event_type : null;
          const assignee = await fetchAssigneeByUserId(user_id);

          if (!seniorName) {
            return res.json({
              ok: true,
              event_id: eventId,
              assigned_staff_id: staffId,
              status: "In Progress",
              serviceNowUpdated: false,
            });
          }

          try {
            const serviceNowUpdated = await caregiverServiceNow.updateIncidentState(
              seniorName,
              "In Progress",
              comment || `Case assigned to staff ${staffId}`,
              {
                eventType,
                assignee: assignee
                  ? {
                      userId: assignee.user_id,
                      fullName: assignee.full_name,
                      email: assignee.email,
                    }
                  : null,
              }
            );
            res.json({
              ok: true,
              event_id: eventId,
              assigned_staff_id: staffId,
              status: "In Progress",
              serviceNowUpdated,
            });
          } catch (snErr) {
            console.error("ServiceNow assign update failed:", snErr);
            res.json({
              ok: true,
              event_id: eventId,
              assigned_staff_id: staffId,
              status: "In Progress",
              serviceNowUpdated: false,
            });
          }
        });
      });
    });
  });
});

router.get("/:staff_id/assigned-cases", (req, res) => {
  db.query(ASSIGNED_CASES_SQL, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message || err });
    res.json(Array.isArray(rows) ? rows : []);
  });
});

router.get("/:staff_id", (req, res) => {
  const sql = `
        SELECT * FROM AIC_Staff
        WHERE staff_id = ?
    `;

  db.query(sql, [req.params.staff_id], (err, result) => {
    if (err) return res.send(err);
    res.json(result[0]);
  });
});

module.exports = router;
