// ---------------------------------------------------------------------------------
// One-shot migration runner for `sql script/SQL Migration - add event_type.sql`.
//
// Re-uses connection credentials from `backend_api/config/db.js` (single
// source of truth). Opens its OWN connection so we can enable
// `multipleStatements: true` while the existing backend connection stays
// tuned for single-statement OLTP work.
//
// Uses mysql2's `multipleStatements: true` so the SERVER tokenizes the SQL
// (it skips `--` line comments and respects string literals). This avoids
// the previous naive client-side `split(';')` mis-aligning on semicolons
// that lived inside -- comments.
//
// Safe to re-run: every ALTER in the migration is guarded by an
// INFORMATION_SCHEMA check, so re-running on a partially-migrated DB
// converges to the same final state.
//
// Usage:  node _run_migration.js
// ---------------------------------------------------------------------------------

const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");

const { dbConfig } = require("./config/db");
const CONN_OPTS = { ...dbConfig, multipleStatements: true };

const SQL_FILE = path.join(
    __dirname, "..",
    "sql script", "SQL Migration - add event_type.sql"
);

function runProbe(conn, sql, label) {
    return new Promise((resolve) => {
        conn.query(sql, (err, rows) => {
            if (err) {
                console.error("    " + label + " PROBE FAIL:", err.message);
                return resolve(null);
            }
            console.log("    " + label + ":");
            console.log(JSON.stringify(rows, null, 2));
            resolve(rows);
        });
    });
}

async function precheck(conn) {
    console.log("\n=== PRE-MIGRATION STATE ===");
    await runProbe(conn, "SELECT VERSION() AS v", "MySQL version");

    const hasEventType = await runProbe(conn,
        "SHOW COLUMNS FROM Emergency_Event LIKE 'event_type'",
        "Emergency_Event.event_type");
    await runProbe(conn,
        "SHOW COLUMNS FROM Emergency_Event LIKE 'alert_id'",
        "Emergency_Event.alert_id");

    await runProbe(conn,
        "SHOW COLUMNS FROM Escalation_History LIKE 'escalated_to'",
        "Escalation_History.escalated_to");

    await runProbe(conn,
        "SHOW COLUMNS FROM Notification LIKE 'recipient_type'",
        "Notification.recipient_type");

    await runProbe(conn,
        "SHOW COLUMNS FROM Notification LIKE 'recipient_name'",
        "Notification.recipient_name");

    await runProbe(conn,
        "SELECT COUNT(*) AS total FROM Notification",
        "Notification.total_rows");

    // CRITICAL pre-flight: the chk_Notification_one_link add is GATED on this
    // being zero. If we see >0 here, we WARN but still attempt the migration
    // (the migration script will SKIP the constraint add and emit a clear
    // SKIPPED message in the migration output stream).
    const orphanRows = await runProbe(conn,
        "SELECT COUNT(*) AS orphans_no_link FROM Notification " +
        " WHERE event_id IS NULL AND checkin_id IS NULL AND alert_id IS NULL",
        "Notification.orphans_gating_chk_Notification_one_link");

    await runProbe(conn,
        "SELECT COUNT(*) AS total FROM Emergency_Event",
        "Emergency_Event.total_rows");

    if (hasEventType && hasEventType[0] && hasEventType[0].Field) {
        // event_type column already exists => show its current distribution
        await runProbe(conn,
            "SELECT IFNULL(event_type,'<NULL>') AS event_type, COUNT(*) AS n " +
            " FROM Emergency_Event GROUP BY event_type ORDER BY n DESC",
            "Emergency_Event.event_type_distribution");
    } else {
        console.log("    (event_type does not yet exist - will be added with NULLs");
        console.log("     that the migration will backfill based on alert_id presence)");
    }

    if (orphanRows && orphanRows[0] && orphanRows[0].orphans_no_link > 0) {
        console.warn(
            "\nWARNING: " + orphanRows[0].orphans_no_link +
            " Notification row(s) have neither event_id, checkin_id, nor alert_id set.\n" +
            "         The migration will SKIP adding chk_Notification_one_link and emit\n" +
            "         a SKIPPED message. After the migration completes, decide:\n" +
            "           - acceptable: leave them, the CHECK is unenforced (bad).\n" +
            "           - fix: UPDATE Notification SET event_id = <one of three> WHERE ...;\n" +
            "             then re-run this script to add the CHECK.\n"
        );
    }
}

async function postcheck(conn) {
    console.log("\n=== POST-MIGRATION STATE ===");
    await runProbe(conn,
        "SHOW COLUMNS FROM Emergency_Event",
        "Emergency_Event.full_columns");
    await runProbe(conn,
        "SHOW COLUMNS FROM Escalation_History",
        "Escalation_History.full_columns");
    await runProbe(conn,
        "SHOW COLUMNS FROM Notification",
        "Notification.full_columns");

    await runProbe(conn,
        "SELECT CONSTRAINT_NAME, CHECK_CLAUSE " +
        "  FROM information_schema.CHECK_CONSTRAINTS " +
        " WHERE CONSTRAINT_SCHEMA = DATABASE()",
        "all_CHECK_constraints_in_db");

    await runProbe(conn,
        "SELECT COUNT(*) AS orphans_after FROM Notification " +
        " WHERE event_id IS NULL AND checkin_id IS NULL AND alert_id IS NULL",
        "Notification.orphans_post_migration");

    await runProbe(conn,
        "SELECT IFNULL(event_type,'<NULL>') AS event_type, COUNT(*) AS n " +
        " FROM Emergency_Event GROUP BY event_type ORDER BY n DESC",
        "Emergency_Event.event_type_distribution_after");

    // Verify the critical pair-parity check by attempting a deliberately invalid
    // INSERT into Emergency_Event (with alert_id set but sensor_id NULL), which
    // SHOULD be rejected if the CHECK is in place and active.
    //
    // Safety: looks up a real senior_id first (FK to Senior), wraps the probe
    // in START TRANSACTION ... ROLLBACK so no TEST row ever persists; if
    // ROLLBACK is also unavailable (autocommit racing) the cleanup DELETE
    // runs unconditionally after the probe.
    console.log("\n=== CONSTRAINT ACTIVATION PROBE ===");
    await new Promise((resolve) => {
        const probe = async () => {
            const senior = await new Promise((res) =>
                conn.query(
                    "SELECT senior_id FROM Senior ORDER BY senior_id ASC LIMIT 1",
                    (e, rows) => res({ err: e, row: rows && rows[0] })
                )
            );
            if (senior.err || !senior.row) {
                console.warn("    probe skipped: cannot resolve a real Senior.senior_id",
                    senior.err && senior.err.message);
                return resolve(null);
            }
            const probeSeniorId = senior.row.senior_id;

            await new Promise((res) =>
                conn.query("START TRANSACTION", (e) => res({ err: e }))
            );

            const insert = await new Promise((res) =>
                conn.query(
                    "INSERT INTO Emergency_Event " +
                    "(senior_id, event_type, escalation_level, alert_id, sensor_id) " +
                    "VALUES (?, 'PROBE_TEST', 'Level 1', 1, NULL)",
                    [probeSeniorId],
                    (e, r) => res({ err: e, result: r })
                )
            );

            if (insert.err) {
                const ok = insert.err.code === "ER_CHECK_CONSTRAINT_VIOLATED";
                console.log("    CHECK ACTIVATION: " + (ok ? "PASS" : "OTHER-ERROR") +
                    " (" + insert.err.code + " " + insert.err.errno + " - " + insert.err.sqlMessage + ")");
                // ROLLBACK is moot since the INSERT failed, but issue it so we
                // leave the connection in a clean state.
                await new Promise((res) =>
                    conn.query("ROLLBACK", () => res(null))
                );
                return resolve(null);
            }

            // INSERT succeeded: CHECK did NOT reject the half-populated pair.
            console.error("    CHECK ACTIVATION: FAIL - half-populated (alert_id, sensor_id) was ACCEPTED");
            await new Promise((res) =>
                conn.query("ROLLBACK", () => res(null))
            );
            // Belt-and-suspenders cleanup in case ROLLBACK was silently ignored.
            await new Promise((res) =>
                conn.query(
                    "DELETE FROM Emergency_Event WHERE event_type='PROBE_TEST'",
                    (e, r) => {
                        if (e) {
                            console.error("    belt-and-suspenders cleanup FAILED:", e.message);
                            console.error("        RUN MANUALLY: DELETE FROM Emergency_Event WHERE event_type='PROBE_TEST';");
                        } else {
                            console.log("    belt-and-suspenders cleanup: removed " + (r && r.affectedRows) + " PROBE_TEST row(s)");
                        }
                        res(null);
                    }
                )
            );
            resolve(null);
        };
        probe().catch((e) => {
            console.error("    probe crashed:", e && e.message);
            resolve(null);
        });
    });
}

(async function main() {
    if (!fs.existsSync(SQL_FILE)) {
        console.error("ABORT: Migration file not found at:", SQL_FILE);
        process.exit(2);
    }
    const sqlText = fs.readFileSync(SQL_FILE, "utf8");

    const conn = mysql.createConnection(CONN_OPTS);

    conn.on("error", (e) => {
        console.error("CONN ERROR:", e.code || "(no-code)", e);
    });

    await new Promise((resolve) => {
        conn.connect((err) => {
            if (err) {
                console.error("CONNECT FAIL:", err.code, err.message);
                process.exit(3);
            }
            console.log("Connected to MySQL",
                CONN_OPTS.host + ":" + CONN_OPTS.port,
                "as", CONN_OPTS.user, "/", CONN_OPTS.database);
            resolve(null);
        });
    });

    await precheck(conn);

    console.log("\n=== RUNNING MIGRATION ===");
    console.log("Sending whole file as one multi-statement batch...");
    const runResult = await new Promise((resolve) => {
        conn.query(sqlText, (err, results) => {
            if (err) {
                console.error("\nMIGRATION FAILED mid-batch:");
                console.error("  code:", err.code);
                console.error("  errno:", err.errno);
                console.error("  sqlMessage:", err.sqlMessage);
                console.error("  index of failing statement (1-based):",
                    err.index != null ? (err.index + 1) : "(server did not report)");

                // Show what committed before the failure (informational).
                if (Array.isArray(results)) {
                    const before = results.slice(0, err.index || 0);
                    console.log("  Successful statements before failure: " + before.length);
                }

                console.error("\nNOTE: the migration is idempotent - every ALTER is guarded.");
                console.error("      The partially-applied state on the server is durable and");
                console.error("      safe. Re-running this script will converge to the same");
                console.error("      final schema because the INFORMATION_SCHEMA guards short-circuit");
                console.error("      already-applied changes to no-ops.\n");

                return resolve({ ok: false });
            }
            const arr = Array.isArray(results) ? results : [results];
            console.log("BATCH RESULT SETS:", arr.length);
            arr.forEach((r, i) => {
                const tag = "  [" + (i + 1) + "]";
                if (Array.isArray(r)) {
                    console.log(tag, "selectRows=" + r.length,
                        r[0] ? "sample=" + JSON.stringify(r[0]).slice(0, 160) : "");
                } else if (r && typeof r === "object" && "affectedRows" in r) {
                    console.log(tag, "affectedRows=" + (r.affectedRows || 0),
                        "fieldCount=" + r.fieldCount);
                } else {
                    console.log(tag, "OK");
                }
            });
            resolve({ ok: true });
        });
    });

    await postcheck(conn);

    conn.end();

    console.log("\n=== DONE ===");
    if (runResult.ok) {
        console.log("Migration completed cleanly.");
        process.exit(0);
    } else {
        console.error("Migration had a failure. See notes above; re-run is safe.");
        process.exit(1);
    }
})();
