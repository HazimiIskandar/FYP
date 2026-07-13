// Diagnosis: prove in DB-state terms whether Amanda (or any caregiver
// with significant roster) actually has rows in Senior_has_Caregiver,
// and run the exact JOIN the /caregiver/:id/seniors handler runs.
//
// Schema-safe: probes User_Account columns first, then only references
// columns that ARE present. Earlier version assumed a textual `role`
// column which this DB doesn't have — that was the failure mode on
// first run; this version probes first and falls back gracefully.
//
// Uses the same shared pool as the running server. If max_user_connections
// is exhausted the probe query will fail and the script will exit with
// a clear diagnostic message.
const db = require('./config/db');

const q = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

const safeRun = async (label, fn) => {
  try {
    const rows = await fn();
    console.log(`--- ${label} ---`);
    console.log(JSON.stringify(rows, null, 2));
    return rows;
  } catch (err) {
    console.log(`--- ${label} (FAILED) ---`);
    console.log('error:', err && err.message ? err.message : err);
    return null;
  }
};

(async () => {
  try {
    // -- Schema probe so we know which role columns exist --
    const userCols = await safeRun('User_Account columns', () =>
      q('SHOW COLUMNS FROM User_Account')
    );

    const userColNames = new Set(
      (Array.isArray(userCols) ? userCols : []).map((c) => c.Field)
    );
    const hasFullName = userColNames.has('full_name');
    const hasEmail = userColNames.has('email');
    const hasRoleId = userColNames.has('role_id');
    const hasDob = userColNames.has('dob');

    console.log('\n=== SCHEMA AVAILABILITY ===');
    console.log(`User_Account.full_name : ${hasFullName}`);
    console.log(`User_Account.email     : ${hasEmail}`);
    console.log(`User_Account.role_id   : ${hasRoleId}`);
    console.log(`User_Account.dob       : ${hasDob}`);
    if (!hasRoleId) {
      console.log('\nNo role_id column found — cannot identify caregivers. Aborting.');
      return;
    }

    // Build the SELECT list defensively. full_name / email / dob are
    // referenced by other queries in this codebase, but we still gate
    // them on actual presence so a future schema change can't crash the
    // probe.
    const selectFullName = hasFullName ? 'ua.full_name' : 'NULL AS full_name';
    const selectEmail = hasEmail ? 'ua.email' : 'NULL AS email';
    const selectDob = hasDob ? 'ua.dob' : 'NULL AS dob';

    // -- 1. All caregivers (role_id = 2) --
    const allCaregivers = await safeRun(
      'All caregiver User_Account rows (role_id = 2)',
      () => q(
        `SELECT user_id, ${selectFullName.replace('ua.', '')}, ${selectEmail.replace('ua.', '')}, role_id
         FROM User_Account
         WHERE role_id = 2
         ORDER BY ${hasFullName ? 'full_name' : 'user_id'} ASC`
      )
    );

    // -- 2. Linkage counts per caregiver, ordered desc --
    const linkageCounts = await safeRun(
      'Senior_has_Caregiver linkage counts per caregiver, ordered desc',
      () => q(
        `SELECT shc.caregiver_id,
                ${selectFullName},
                ${selectEmail},
                COUNT(*) AS linked_seniors
         FROM Senior_has_Caregiver shc
         JOIN User_Account ua ON ua.user_id = shc.caregiver_id
         GROUP BY shc.caregiver_id, ${hasFullName ? 'ua.full_name' : 'ua.user_id'}, ${hasEmail ? 'ua.email' : 'ua.user_id'}
         ORDER BY linked_seniors DESC`
      )
    );

    // -- 3. Run the EXACT /caregiver/:id/seniors join for top caregiver --
    const topCaregiver = Array.isArray(linkageCounts) && linkageCounts.length > 0
      ? linkageCounts[0]
      : null;

    if (topCaregiver) {
      await safeRun(
        `Endpoint-equivalent rows for caregiver_id=${topCaregiver.caregiver_id} (${topCaregiver.full_name}, ${topCaregiver.linked_seniors} linked)`,
        () => q(
          `SELECT
              s.senior_id,
              s.user_id,
              s.preferred_checkin_time,
              YEAR(CURDATE()) - YEAR(${selectDob})
                - (DATE_FORMAT(${selectDob}, '%m%d') > DATE_FORMAT(CURDATE(), '%m%d')) AS age,
              ${selectFullName},
              ua.phone_number,
              ${selectEmail},
              ${selectDob},
              ua.gender,
              ua.address,
              ua.postal_code,
              ua.unit_number
            FROM Senior s
            JOIN Senior_has_Caregiver shc ON s.senior_id = shc.senior_id
            JOIN User_Account ua         ON s.user_id   = ua.user_id
            WHERE shc.caregiver_id = ?
            ORDER BY ${hasFullName ? 'ua.full_name' : 'ua.user_id'} ASC`,
          [topCaregiver.caregiver_id]
        )
      );
    } else {
      console.log('\n--- Top caregiver roster ---');
      console.log('NO LINKAGE ROWS in Senior_has_Caregiver at all.');
    }

    // -- 4. Specifically find any caregiver with 'amanda' in the name --
    const amandaCandidates = Array.isArray(allCaregivers)
      ? allCaregivers.filter((row) =>
          String(row.full_name || '').toLowerCase().includes('amanda')
        )
      : [];

    for (const amanda of amandaCandidates) {
      await safeRun(
        `Amanda candidate — caregiver_id=${amanda.user_id} (${amanda.full_name}) roster`,
        () => q(
          `SELECT s.senior_id, s.user_id,
                  ${selectFullName},
                  shc.caregiver_id
           FROM Senior_has_Caregiver shc
           JOIN Senior s        ON s.senior_id = shc.senior_id
           JOIN User_Account ua ON ua.user_id  = s.user_id
           WHERE shc.caregiver_id = ?
           ORDER BY ${hasFullName ? 'ua.full_name' : 'ua.user_id'} ASC`,
          [amanda.user_id]
        )
      );
    }

    // -- 5. Orphan linkage sanity (rows pointing to ghosts) --
    const orphans = await safeRun(
      'Orphan linkage sanity check (senior_id or caregiver_id no longer exists)',
      () => q(
        `SELECT shc.senior_id, shc.caregiver_id,
                (SELECT COUNT(*) FROM Senior s WHERE s.senior_id = shc.senior_id) AS senior_exists,
                (SELECT COUNT(*) FROM User_Account u WHERE u.user_id = shc.caregiver_id) AS caregiver_exists
         FROM Senior_has_Caregiver shc
         HAVING senior_exists = 0 OR caregiver_exists = 0`
      )
    );

    // -- 6. Human-readable summary --
    console.log('\n=== SUMMARY ===');
    console.log(`caregivers (role_id = 2) total: ${Array.isArray(allCaregivers) ? allCaregivers.length : 0}`);
    const totalLinks = Array.isArray(linkageCounts)
      ? linkageCounts.reduce((acc, row) => acc + Number(row.linked_seniors || 0), 0)
      : 0;
    console.log(`Senior_has_Caregiver rows total: ${totalLinks}`);
    if (Array.isArray(linkageCounts) && linkageCounts.length > 0) {
      console.log('Top 5 caregivers by linked senior count:');
      linkageCounts.slice(0, 5).forEach((row, i) => {
        console.log(
          `  #${i + 1}: caregiver_id=${row.caregiver_id} ${row.full_name} ` +
          `<${row.email}> -> ${row.linked_seniors} linked senior(s)`
        );
      });
    } else {
      console.log('No caregivers have any linkages in Senior_has_Caregiver.');
    }
    console.log(`Amanda candidate rows: ${amandaCandidates.length}`);
    if (amandaCandidates.length > 0) {
      amandaCandidates.forEach((row) => {
        console.log(`  -> user_id=${row.user_id} full_name=${row.full_name} email=${row.email}`);
      });
    }
    console.log(`Orphan linkages (pointing to deleted senior or user): ${Array.isArray(orphans) ? orphans.length : 0}`);
  } catch (err) {
    console.error('diagnostic failed at top-level:', err && err.message ? err.message : err);
  } finally {
    try {
      db.end();
    } catch {}
  }
})();
