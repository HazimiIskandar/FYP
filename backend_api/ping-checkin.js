// Ping the local backend's /checkin endpoint from a Node script —
// sidesteps every PowerShell + curl quoting headache.
//
// Usage:
//   node backend_api/ping-checkin.js              # uses senior_id = 1
//   node backend_api/ping-checkin.js 5            # uses senior_id = 5
//
// Requires your backend to be running on http://localhost:10000
// (`cd backend_api && npm start`).

const seniorId = parseInt(process.argv[2] || "1", 10);
const url = "http://localhost:10000/checkin";
const body = JSON.stringify({ senior_id: seniorId });

console.log("POST " + url + "  body=" + body);

fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
  body: body,
})
  .then(async (res) => {
    const text = await res.text();
    console.log("STATUS " + res.status);
    console.log("BODY   " + text);
  })
  .catch((err) => {
    console.log("NET_ERR " + err.message);
    process.exitCode = 1;
  });
