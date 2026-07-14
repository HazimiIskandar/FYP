#!/bin/bash
# Sanity-grep the edited App.js to confirm:
# 1) linkageOk removed from routing decision
# 2) profile-completeness is the senior gate
# 3) fetchLinkageSummary still called (fire-and-forget, not awaited)
# 4) Case 4 onboarding path intact
# 5) isNewAccount is the single source of truth

set +e

echo "=== linkageOk in App.js (should NOT appear in the routing branch) ==="
grep -n linkageOk App.js || echo "OK: linkageOk removed from App.js"

echo ""
echo "=== Senior routing uses isSeniorProfileComplete(loggedInSenior) ==="
grep -n "isSeniorProfileComplete(loggedInSenior)" App.js

echo ""
echo "=== fetchLinkageSummary call sites (no await prefix in handleLogin) ==="
grep -n "fetchLinkageSummary" App.js

echo ""
echo "=== handleLogin linkage fetch must NOT be await-prefixed ==="
sed -n '/if (loggedInSenior && loggedInSenior.senior_id)/,/} else {/,/^      }$/p' App.js | head -30

echo ""
echo "=== openCaregiverLinkOnSettings set on Case 4 (empty-profile) branch ==="
grep -n "openCaregiverLinkOnSettings" App.js

echo ""
echo "=== isNewAccount single source of truth ==="
grep -n "isNewAccount" App.js

echo ""
echo "=== Babel parser sanity check ==="
node -e "const p=require('@babel/parser');const fs=require('fs');try{p.parse(fs.readFileSync('App.js','utf8'),{sourceType:'module',plugins:['jsx']});console.log('App.js: OK (parses cleanly)')}catch(e){console.log('App.js: PARSE-ERROR ' + e.message)}"
