// 1) Paste your Apps Script Web App URL (must end with /exec and be HTTPS)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbymYW5sH9x-IJO_KoZfSi9ZLi9izXvB8Q9IJj4K8yXpDqWZKOWoMebATLX_yv9L8bZZFA/exec";

// Grab elements
const $time   = document.getElementById("live-time");
const $ampm   = document.getElementById("ampm");
const $today  = document.getElementById("today");      // optional if present
const $emp    = document.getElementById("employee");
const $btnIn  = document.getElementById("btn-in");
const $btnOut = document.getElementById("btn-out");
const $status = document.getElementById("status");

// ---- helpers ----
function setStatus(msg) {
  if ($status) $status.textContent = msg || "";
}

function tick() {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: true, timeZone: "Asia/Kathmandu"
    }).formatToParts(now);

    const hhmmss = parts
      .filter(p => ["hour","minute","second"].includes(p.type))
      .map(p => p.value.padStart(2, "0"))
      .join(":");
    const period = parts.find(p => p.type === "dayPeriod")?.value?.toUpperCase() || "";

    if ($time) $time.textContent = hhmmss;
    if ($ampm) $ampm.textContent = " " + period;

    if ($today) {
      $today.textContent = new Intl.DateTimeFormat("en-GB", {
        weekday:"long", month:"short", day:"numeric", year:"numeric",
        timeZone:"Asia/Kathmandu"
      }).format(now);
    }
  } catch (e) {
    console.error("tick error", e);
  }
}

// Load employee names from Apps Script
async function loadEmployees() {
  try {
    if (!APPS_SCRIPT_URL || !/^https:/.test(APPS_SCRIPT_URL)) {
      throw new Error("APPS_SCRIPT_URL missing or not https");
    }
    const r = await fetch(APPS_SCRIPT_URL, { method: "GET", cache: "no-store" });
    const data = await r.json();
    const list = (data.employees || []).filter(Boolean);

    // Reset options
    $emp.innerHTML = `<option value="" selected disabled>Choose your name</option>`;
    for (const name of list) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      $emp.appendChild(opt);
    }
    setStatus(""); // clear any prior error
  } catch (e) {
    console.error("loadEmployees failed", e);
    setStatus("Could not load employees. Check deployment URL & access.");
  }
}

// Geolocation (optional; best effort)
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat:"", lng:"" });
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()  => resolve({ lat:"", lng:"" }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

// POST event (use text/plain to avoid CORS preflight)
async function submitEvent(kind) {
  const employee = $emp.value;
  if (!employee) {
    setStatus("Please choose your name first.");
    $emp.focus();
    return;
  }

  setStatus("Saving…");
  $btnIn.disabled = true; $btnOut.disabled = true;

  try {
    const loc = await getLocation();
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // simple request
      body: JSON.stringify({
        employee,
        event: kind,    // "CLOCK_IN" | "CLOCK_OUT"
        lat: loc.lat,
        lng: loc.lng,
        ua: navigator.userAgent
      })
    });

    const json = await res.json();
    if (!res.ok || json.ok === false) {
      throw new Error(json.error || "Failed");
    }

    setStatus(`Thank you for ${kind === "CLOCK_IN" ? "Clocking In" : "Clocking Out"}.`);
    $emp.selectedIndex = 0; // reset
  } catch (e) {
    console.error("submitEvent failed", e);
    setStatus("Error: " + e.message);
  } finally {
    $btnIn.disabled = false; $btnOut.disabled = false;
  }
}

// Wire up (the script is deferred; DOM is ready)
tick(); setInterval(tick, 1000);
loadEmployees();
$btnIn.addEventListener("click", () => submitEvent("CLOCK_IN"));
$btnOut.addEventListener("click", () => submitEvent("CLOCK_OUT"));
