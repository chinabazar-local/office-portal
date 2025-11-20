/* ===== CLOCK PAGE SCRIPT (root /) ===== */

/** 1) CONFIG: Clock Apps Script URL */
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbz94leF_gCFo-F5Etuo4sHmKwZvWGjjuWNP_ZrvycBCg24voQwDSLkU25oqffuT511LLA/exec";

/** 2) Session */
let SESS = {};
try {
  SESS = JSON.parse(localStorage.getItem("cb_user") || "{}");
} catch (_) {
  SESS = {};
}
const EMPLOYEE_NAME = SESS.employeeName || SESS.name || "";

/** 3) DOM refs */
const signedName = document.getElementById("signedName");
const linkLeave  = document.getElementById("linkLeave");
const btnLogout  = document.getElementById("btnLogout");

const statusLine = document.getElementById("statusLine");
const sinceLine  = document.getElementById("sinceLine");
const durLine    = document.getElementById("durLine");
const errBox     = document.getElementById("errorBox");

const btnIn   = document.getElementById("btnClockIn");
const btnOut  = document.getElementById("btnClockOut");
const clockEl = document.getElementById("clockText");

/** 4) Small helpers */
function showErr(msg) {
  if (!errBox) return;
  errBox.textContent = msg;
  errBox.style.display = "block";
}
function clearErr() {
  if (!errBox) return;
  errBox.textContent = "";
  errBox.style.display = "none";
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function fmtLocal(ts) {
  try {
    const d = new Date(ts);
    if (!isFinite(d)) return "—";
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  } catch (_) {
    return "—";
  }
}

/** 5) Live Kathmandu clock (works even if API is broken) */
function startClock() {
  const tz = "Asia/Kathmandu";
  const tick = () => {
    try {
      const s = new Date().toLocaleTimeString("en-US", {
        timeZone: tz,
        hour12: true,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      clockEl.textContent = s;
    } catch (_) {
      const d = new Date();
      clockEl.textContent =
        pad(d.getHours()) +
        ":" +
        pad(d.getMinutes()) +
        ":" +
        pad(d.getSeconds());
    }
  };
  tick();
  setInterval(tick, 1000);
}

/** 6) Simple POST helper (no headers → no CORS preflight) */
async function api(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Request failed");
  return json.data;
}

/** 7) Status rendering + duration timer */
let durTimer = null;
function stopDurTimer() {
  if (durTimer) {
    clearInterval(durTimer);
    durTimer = null;
  }
}

function renderStatus(data) {
  const state = data && data.state ? String(data.state).toUpperCase() : "NONE";
  const sinceISO = (data && data.sinceISO) || null;

  let statusText;
  if (state === "IN") {
    statusText = "CLOCKED IN";
  } else if (state === "OUT") {
    statusText = "CLOCKED OUT";
  } else {
    // state "NONE" or anything else → no clock events for today
    statusText = "NOT CLOCKED TODAY";
  }

  statusLine.textContent = "STATUS: " + statusText;
  sinceLine.textContent = "Since: " + (sinceISO ? fmtLocal(sinceISO) : "—");

  stopDurTimer();
  if (state === "IN" && sinceISO) {
    const startMs = new Date(sinceISO).getTime();
    const tick = () => {
      const diff = Date.now() - startMs;
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      durLine.textContent = `Duration: ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
    };
    tick();
    durTimer = setInterval(tick, 1000);
  } else {
    durLine.textContent = "Duration: —";
  }
}

async function loadStatus() {
  if (!EMPLOYEE_NAME) {
    renderStatus(null);
    return;
  }
  try {
    clearErr();
    const data = await api({ action: "status", employeeName: EMPLOYEE_NAME });
    renderStatus(data || {});
  } catch (err) {
    showErr("Failed to fetch status");
    renderStatus(null);
  }
}

/** 8) Geolocation (best-effort for clock events) */
function getLocation(timeout = 6000) {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("no geo"));
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => rej(err),
      { enableHighAccuracy: false, maximumAge: 60000, timeout }
    );
  });
}

/** 9) Clock in/out */
async function clock(eventType) {
  if (!EMPLOYEE_NAME) {
    showErr("No employee session – please log in again.");
    return;
  }

  try {
    clearErr();
    btnIn.disabled = true;
    btnOut.disabled = true;

    let loc = { lat: null, lng: null };
    try {
      loc = await getLocation();
    } catch (_) {
      // ignore geo failure
    }

    await api({
      action: "clock",
      employeeName: EMPLOYEE_NAME,
      event: eventType, // "CLOCK_IN" or "CLOCK_OUT"
      lat: loc.lat,
      lng: loc.lng,
      ua: navigator.userAgent,
    });

    await loadStatus();
  } catch (err) {
    showErr("Failed to fetch");
  } finally {
    btnIn.disabled = false;
    btnOut.disabled = false;
  }
}

/** 10) Init on load */
window.addEventListener("DOMContentLoaded", () => {
  // If no session, send to login
  if (!EMPLOYEE_NAME) {
    location.href = "/login/";
    return;
  }

  // Show name from session
  signedName.textContent = EMPLOYEE_NAME;

  // Nav: leave request gets employee in query + optional geolocation
  linkLeave.addEventListener("click", (e) => {
    e.preventDefault();
    const url = new URL("/leave-request/", location.origin);
    url.searchParams.set("employee", EMPLOYEE_NAME);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          url.searchParams.set("pf_lat", String(p.coords.latitude));
          url.searchParams.set("pf_lng", String(p.coords.longitude));
          location.href = url.toString();
        },
        () => {
          location.href = url.toString();
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 3000 }
      );
    } else {
      location.href = url.toString();
    }
  });

  // Nav: logout
  btnLogout.addEventListener("click", () => {
    localStorage.removeItem("cb_user");
    location.href = "/login/";
  });

  // Buttons
  btnIn.addEventListener("click", () => clock("CLOCK_IN"));
  btnOut.addEventListener("click", () => clock("CLOCK_OUT"));

  // Start UI
  startClock();   // live time
  loadStatus();   // API status
});