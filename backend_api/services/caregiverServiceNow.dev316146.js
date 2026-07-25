const axios = require("axios");

// Dedicated ServiceNow Incident sync for the owner's PDI only.
// Intentionally scoped to dev316146; do not point this helper at teammate PDIs.
const INSTANCE_URL = String(
  process.env.SN_INSTANCE_URL || "https://dev316146.service-now.com/"
).replace(/\/+$/, "");
const OAUTH_CLIENT_ID = process.env.SN_OAUTH_CLIENT_ID || "283676f31af146e99b3ea8a9d1140f2d";
const OAUTH_CLIENT_SECRET = process.env.SN_OAUTH_CLIENT_SECRET || "mAde1WxSFt6fWfKf#dmFi[oPpUr&:*Ov";
const REQUEST_TIMEOUT_MS = Number(process.env.SN_TIMEOUT_MS) || 5000;
const TOKEN_REFRESH_SAFETY_MS = 60_000;

const STATE_CODE_MAP = {
  New: "1",
  Open: "1",
  "In Progress": "2",
  "On Hold": "3",
  Resolved: "6",
  Closed: "7",
  Cancelled: "8",
};

let cachedToken = null;
let tokenExpiry = 0;
let tokenPromise = null;

function isConfigured() {
  return Boolean(INSTANCE_URL && OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET);
}

function clearTokenCache() {
  cachedToken = null;
  tokenExpiry = 0;
}

async function fetchAccessToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET,
  }).toString();

  const res = await axios.post(`${INSTANCE_URL}/oauth_token.do`, body, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
  });

  const token = res?.data?.access_token ? String(res.data.access_token) : null;
  const expiresInSec = Number(res?.data?.expires_in) || 1800;
  if (!token) {
    throw new Error("/oauth_token.do returned no access_token");
  }

  cachedToken = token;
  tokenExpiry = Date.now() + expiresInSec * 1000 - TOKEN_REFRESH_SAFETY_MS;
  return token;
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  if (tokenPromise) {
    return tokenPromise;
  }

  tokenPromise = (async () => {
    try {
      return await fetchAccessToken();
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

async function requestNow(method, path, { params, data } = {}) {
  const token = await getAccessToken();
  return axios({
    method,
    url: `${INSTANCE_URL}${path}`,
    params,
    data,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

function pickBestSysUser(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const rank = (row) => {
    const active = String(row?.active || "").toLowerCase() === "true" ? 1 : 0;
    const hasName = String(row?.name || "").trim() ? 1 : 0;
    const hasUserName = String(row?.user_name || "").trim() ? 1 : 0;
    return active * 100 + hasName * 10 + hasUserName;
  };

  return rows
    .slice()
    .sort((a, b) => rank(b) - rank(a))[0];
}

async function resolveAssigneeSysId(assignee = null) {
  if (!assignee || typeof assignee !== "object") return null;

  const email = String(assignee.email || "").trim();
  const fullName = String(assignee.fullName || "").trim();

  // Prefer email lookup because it is typically unique in sys_user.
  if (email) {
    try {
      const byEmail = await requestNow("get", "/api/now/table/sys_user", {
        params: {
          sysparm_query: `email=${email}`,
          sysparm_fields: "sys_id,name,user_name,email,active",
          sysparm_limit: 10,
        },
      });
      const candidates = Array.isArray(byEmail?.data?.result) ? byEmail.data.result : [];
      const row = pickBestSysUser(candidates);
      if (row?.sys_id) return String(row.sys_id);
    } catch (err) {
      console.warn(
        "[Caregiver ServiceNow dev316146] sys_user email lookup failed:",
        err?.response?.data || err?.message || err
      );
    }
  }

  if (fullName) {
    try {
      const byName = await requestNow("get", "/api/now/table/sys_user", {
        params: {
          sysparm_query: `name=${fullName}`,
          sysparm_fields: "sys_id,name,user_name,email,active",
          sysparm_limit: 10,
        },
      });
      const candidates = Array.isArray(byName?.data?.result) ? byName.data.result : [];
      const row = pickBestSysUser(candidates);
      if (row?.sys_id) return String(row.sys_id);
    } catch (err) {
      console.warn(
        "[Caregiver ServiceNow dev316146] sys_user name lookup failed:",
        err?.response?.data || err?.message || err
      );
    }
  }

  return null;
}

function mapStatusToStateCode(statusName) {
  return STATE_CODE_MAP[statusName] || "2";
}

function enrichPayloadForTerminalStates(payload, statusName, workNotes = "") {
  const normalized = String(statusName || "").trim().toLowerCase();
  const note =
    String(workNotes || "").trim() ||
    `Case updated from mobile app with status: ${statusName}.`;

  // Some ServiceNow instances enforce Data Policies for terminal states.
  // Set common mandatory fields so updates to Resolved/Closed do not fail.
  if (normalized === "resolved" || normalized === "closed") {
    payload.close_code = payload.close_code || "Solution provided";
    payload.close_notes = payload.close_notes || note;
  }

  return payload;
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function incidentMatches(incident, seniorName, eventType) {
  const blob = [incident?.short_description, incident?.description]
    .map((v) => String(v || ""))
    .join(" ")
    .toLowerCase();

  if (!blob.includes(normalizeText(seniorName))) return false;
  if (!eventType) return true;

  const eventHint = normalizeText(eventType)
    .replace(/check-?in/g, "check in")
    .replace(/\s+/g, " ")
    .trim();

  if (!eventHint) return true;

  return (
    blob.includes(eventHint) ||
    blob.includes("missed check-in") ||
    blob.includes("missed check in")
  );
}

async function findLatestIncidentForSenior(seniorName = "Unknown", eventType = null) {
  const fields = "sys_id,number,short_description,description,state,sys_created_on";
  const query = "active=true^ORDERBYDESCsys_created_on";
  const response = await requestNow("get", "/api/now/table/incident", {
    params: {
      sysparm_query: query,
      sysparm_fields: fields,
      sysparm_limit: 50,
    },
  });
  const incidents = Array.isArray(response?.data?.result) ? response.data.result : [];
  return incidents.find((item) => incidentMatches(item, seniorName, eventType)) || null;
}

async function createIncidentForSenior({
  seniorName = "Unknown",
  statusName = "In Progress",
  workNotes = "",
  eventType = null,
  assignedToSysId = null,
}) {
  const eventLabel = eventType || "Caregiver Escalation";
  const payload = {
    short_description: `${eventLabel} - ${seniorName}`,
    description:
      workNotes ||
      `Case synchronized from mobile app for ${seniorName}. Event type: ${eventLabel}.`,
    urgency: "1",
    impact: "2",
    state: mapStatusToStateCode(statusName),
    work_notes: workNotes || `Case created from app and set to ${statusName}.`,
  };
  enrichPayloadForTerminalStates(payload, statusName, workNotes);
  if (assignedToSysId) {
    payload.assigned_to = assignedToSysId;
  }

  const created = await requestNow("post", "/api/now/table/incident", {
    data: payload,
  });

  return created?.data?.result || null;
}

async function updateIncidentToInProgress(seniorName = "Unknown") {
  return updateIncidentState(
    seniorName,
    "In Progress",
    "Caregiver has triggered the emergency contact workflow from the mobile app. Calling Next of Kin...",
    { eventType: "Missed Check-In" }
  );
}

async function updateIncidentState(
  seniorName = "Unknown",
  statusName = "In Progress",
  workNotes = "",
  options = {}
) {
  try {
    if (!isConfigured()) {
      console.warn(
        "[Caregiver ServiceNow dev316146] Missing SN config: " +
          "SN_INSTANCE_URL/SN_OAUTH_CLIENT_ID/SN_OAUTH_CLIENT_SECRET"
      );
      return false;
    }

    const eventType = options?.eventType || null;
    const assignedToSysId = await resolveAssigneeSysId(options?.assignee || null);

    console.log(
      `[Caregiver ServiceNow dev316146] Searching incident for ${seniorName} ` +
        `(eventType=${eventType || "any"})...`
    );

    let incident = await findLatestIncidentForSenior(seniorName, eventType);

    if (!incident) {
      console.log(
        `[Caregiver ServiceNow dev316146] No matching incident found for ${seniorName}. Creating one...`
      );
      incident = await createIncidentForSenior({
        seniorName,
        statusName,
        workNotes,
        eventType,
        assignedToSysId,
      });

      if (!incident?.sys_id) {
        return false;
      }

      console.log(
        `[Caregiver ServiceNow dev316146] Created Incident ${incident.number || "Unknown"} for ${seniorName}.`
      );
      return true;
    }

    const sysId = incident.sys_id;
    const incidentNumber = incident.number;
    const payload = { state: mapStatusToStateCode(statusName) };
    if (workNotes) payload.work_notes = workNotes;
    if (assignedToSysId) payload.assigned_to = assignedToSysId;
    enrichPayloadForTerminalStates(payload, statusName, workNotes);

    await requestNow("put", `/api/now/table/incident/${sysId}`, {
      data: payload,
    });

    console.log(
      `[Caregiver ServiceNow dev316146] SUCCESS! Incident ${incidentNumber} updated to state ${statusName}.`
    );
    return true;
  } catch (error) {
    if (Number(error?.response?.status) === 401) {
      clearTokenCache();
    }
    console.error(
      "[Caregiver ServiceNow dev316146] Failed to update Incident state:",
      error?.response?.data || error.message
    );
    return false;
  }
}

module.exports = {
  updateIncidentToInProgress,
  updateIncidentState,
};
