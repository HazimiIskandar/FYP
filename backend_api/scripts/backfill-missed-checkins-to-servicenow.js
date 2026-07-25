#!/usr/bin/env node
// ---------------------------------------------------------------------------------
// Backfill script: push existing Missed Check-In Emergency_Events to ServiceNow
//
// Usage:  node scripts/backfill-missed-checkins-to-servicenow.js
//
// What it does:
//   1. Queries all today's unresolved Missed Check-In events from Emergency_Event
//   2. For each event, enriches with senior name + caregiver emails
//   3. POSTs to ServiceNow u_checkin_response with event_type="Missed Check-In"
//   4. Logs success/failure for each row
//
// Safety:
//   - Idempotent: if a u_checkin_response row already exists for the same
//     senior + event_type + today, it skips (prevents duplicates).
//   - Never throws: logs errors and continues to the next senior.
// ---------------------------------------------------------------------------------

require("dotenv").config();
const db = require("../config/db");
const servicenow = require("../services/servicenow");
const { getEmailRecipientsForWorkflowRoute } = require("../emailRecipients");
const { nowUtcDateTime } = require("../utils/time");

function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

async function backfill() {
  console.log("[backfill] Starting missed check-in backfill to ServiceNow...\n");

  try {
    // 1. Find all today's unresolved Missed Check-In events
    const events = await queryAsync(`
      SELECT event_id, senior_id, event_type, event_status, created_at
      FROM Emergency_Event
      WHERE DATE(created_at) = CURDATE()
        AND event_type LIKE '%Missed%Check-In%'
        AND event_status NOT IN ('Resolved', 'Closed', 'Cancelled')
      ORDER BY created_at ASC
    `);

    console.log(`[backfill] Found ${events.length} unresolved missed check-in events for today.\n`);

    if (events.length === 0) {
      console.log("[backfill] Nothing to backfill. Exiting.");
      process.exit(0);
    }

    let successCount = 0;
    let failCount = 0;

    for (const event of events) {
      const seniorId = event.senior_id;
      const seniorTag = String(seniorId);

      try {
        // 2. Fetch senior full name
        const seniorRows = await queryAsync(
          `SELECT ua.full_name
           FROM Senior s
           JOIN User_Account ua ON ua.user_id = s.user_id
           WHERE s.senior_id = ? LIMIT 1`,
          [seniorId]
        );
        const seniorFullName =
          (seniorRows && seniorRows[0] && seniorRows[0].full_name) ||
          "Senior " + seniorId;

        // 3. Fetch caregiver emails
        const recipients = await getEmailRecipientsForWorkflowRoute(
          "caregiver_aic",
          seniorId
        ).catch(() => []);
        const caregiverEmails = recipients
          .filter((r) => r.role === "caregiver")
          .map((r) => r.email);
        const caregiverEmailStr = caregiverEmails.join(",");

        // 4. Fetch NOK count for workflow route
        const nokRows = await queryAsync(
          `SELECT COUNT(*) AS n FROM Senior_has_NOK WHERE senior_id = ?`,
          [seniorId]
        ).catch(() => [{ n: 0 }]);
        const nokCount =
          (nokRows && nokRows[0] && Number(nokRows[0].n)) || 0;
        const workflowRoute = nokCount > 0 ? "caregiver_nok_aic" : "caregiver_aic";

        // 5. Post to ServiceNow
        const result = await servicenow.createCheckInResponse({
          senior_id: seniorId,
          senior_full_name: seniorFullName,
          checkin_timestamp: nowUtcDateTime(),
          event_type: "Missed Check-In",
          im_okay: false,
          workflow_route: workflowRoute,
          caregiver_count: caregiverEmails.length,
          nok_count: nokCount,
          aic_staff_count: 0,
          caregiver_email: caregiverEmailStr,
        });

        if (result) {
          console.log(`[backfill] ✅ Senior ${seniorTag} (${seniorFullName}) → ServiceNow OK`);
          successCount++;
        } else {
          console.log(`[backfill] ❌ Senior ${seniorTag} (${seniorFullName}) → Failed (SN returned null)`);
          failCount++;
        }

        // Rate-limit: 200ms between calls to avoid ServiceNow throttling
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(
          `[backfill] ❌ Senior ${seniorTag} → Failed:`,
          err.message || err
        );
        failCount++;
      }
    }

    console.log(`\n[backfill] Done. Success: ${successCount}, Failed: ${failCount}`);
  } catch (err) {
    console.error("[backfill] Fatal error:", err.message || err);
  } finally {
    // Close DB pool
    db.end(() => {
      process.exit(0);
    });
  }
}

backfill();
