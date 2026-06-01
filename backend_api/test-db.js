const db = require("./config/db");

console.log("🧪 Testing database connection and query...\n");

// Test 1: Simple connection test
console.log("📡 Test 1: Testing connection...");
db.query("SELECT 1 + 1 AS result", (err, results) => {
  if (err) {
    console.error("❌ Connection test failed:", err.message);
    process.exit(1);
  }
  console.log("✅ Connection test passed:", results);
});

// Test 2: Check if Senior table exists
setTimeout(() => {
  console.log("\n📡 Test 2: Checking Senior table...");
  db.query("SELECT COUNT(*) as count FROM Senior", (err, results) => {
    if (err) {
      console.error("❌ Senior table query failed:", err.message);
      return;
    }
    console.log("✅ Senior table found. Total seniors:", results[0].count);
  });
}, 1000);

// Test 3: Check if User_Account table exists
setTimeout(() => {
  console.log("\n📡 Test 3: Checking User_Account table...");
  db.query("SELECT COUNT(*) as count FROM User_Account", (err, results) => {
    if (err) {
      console.error("❌ User_Account table query failed:", err.message);
      return;
    }
    console.log("✅ User_Account table found. Total users:", results[0].count);
  });
}, 2000);

// Test 4: Run the actual seniors query
setTimeout(() => {
  console.log("\n📡 Test 4: Running actual seniors query...");
  const sql = `
    SELECT 
      s.senior_id,
      s.user_id,
      s.age,
      s.has_nok,
      s.created_at,
      u.full_name,
      u.phone_number,
      u.email,
      u.dob,
      u.gender,
      u.address,
      u.postal_code,
      u.unit_number
    FROM Senior s
    LEFT JOIN User_Account u ON s.user_id = u.user_id
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Seniors query failed:", err.message);
      process.exit(1);
    }
    console.log("✅ Seniors query successful!");
    console.log(`📊 Total seniors returned: ${results.length}`);
    if (results.length > 0) {
      console.log("📋 First senior:", JSON.stringify(results[0], null, 2));
    }
    process.exit(0);
  });
}, 3000);

// Timeout if tests take too long
setTimeout(() => {
  console.error("\n⏱️ Tests timed out - no response from database");
  process.exit(1);
}, 10000);
