// One-shot diagnostic: proves whether Amanda / any caregiver with linked
// seniors actually has rows in Senior_has_Caregiver and whether the join
// query behind GET /caregiver/:id/seniors would return those rows.
//
// Uses the same connection config as the live server, but opens its own
// pool + closes it when finished, so it never stalls the running
// express process.
const pool = require('./config/db');

const q = (sql, params = []) =>
  new Promise((resolve, reject) =>
    pool.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

(async () => {
  try {
    // 1) Find all caregivers with a full_name so we can spot "Amanda".
    const allCaregivers = await q(
      `SELECT user_id, full_name, email, role_id
       FROM User_Account
       WHERE role_id = 2 OR LOWER(role) LIKE '%caregiver%'`
    );
    console.log('--- caregivers in User_Account ---');
    console.log(JSON.stringify(allCaregivers, null, 2));

    // 2) Count linkages per caregiver so we can identify the 5-linked one
    //    + verify any "Amanda" actually has rows.
    const linkageCounts = await q(
      `SELECT shc.caregiver_id, ua.full_name, ua.email, COUNT(*) AS linked_seniors
       FROM Senior_has_Caregiver shc
       JOIN User_Account ua ON ua.user_id = shc.caregiver_id
       GROUP BY shc.caregiver_id, ua.full_name, ua.email
       ORDER BY linked_seniors DESC`
    );
    console.log('--- linkage counts per caregiver ---');
    console.log(JSON.stringify(linkageCounts, null, 2));

    // 3) For the caregiver with the most linked seniors, run the exact
    //    SELECT the caregiverRoutes.js handler runs and dump it. This is
    //    the single best signal that the SQL is sound.
    if (linkageCounts.length > 0) {
      const top = linkageCounts[0];
      const rows = await q(
        `SELECT
            s.senior_id,
            s.user_id,
            s.preferred_checkin_time,
            YEAR(CURDATE()) - YEAR(ua.dob)
              - (DATE_FORMAT(ua.dob, '%m%d') > DATE_FORMAT(CURDATE(), '%m%d')) AS age,
            ua.full_name,
            ua.phone_number,
            ua.email,
            ua.dob,
            ua.gender,
            ua.address,
            ua.postal_code,
            ua.unit_number
          FROM Senior s
          JOIN Senior_has_Caregiver shc ON s.senior_id = shc.senior_id
          JOIN User_Account ua         ON s.user_id   = ua.user_id
          WHERE shc.caregiver_id = ?
          ORDER BY ua.full_name ASC`,
        [top.caregiver_id]
      );
      console.log(
        `--- caregiver endpoint rows for caregiver_id=${top.caregiver_id} (${top.full_name}, ${top.linked_seniors} linked) ---`
      );
      console.log(JSON.stringify(rows, null, 2));
      console.log(`row count: ${rows.length}`);
    } else {
      console.log('--- no rows in Senior_has_Caregiver ---');
    }
  } catch (err) {
    console.error('diagnostic failed:', err && err.message ? err.message : err);
  } finally {
    pool.end();
  }
})();
