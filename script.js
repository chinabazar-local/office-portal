// 1) Paste your Apps Script Web App URL (must end with /exec and be HTTPS)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby8Gfc3JhMfTl4U6QSp81FnTGNRxksL17dSzsxY0OJz3qBpTbQONpevulpat7HFI6G-/exec";

// Elements
const $time = document.getElementById("live-time");
const $today = document.getElementById("today");
const $employee = document.getElementById("employee");
const $btnIn = document.getElementById("btn-in");
const $btnOut = document.getElementById("btn-out");
const $status = document.getElementById("status");

// Live KTM date/time
function tick() {
  const now = new Date();
  $time.textContent = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Kathmandu"
  }).format(now);
  $today.textContent = new Intl.DateTimeFormat("en-GB", {
    weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Kathmandu"
  }).format(now);
}
tick(); setInterval(tick, 1000);

// Load employees
async function loadEmployees() {
  try {
    const r = await fetch(APPS_SCRIPT_URL, { method: "GET", cache: "no-store" });
    const data = await r.json();
    const list = (data.employees || []).filter(Boolean);
    $employee.innerHTML = "";
    if (list.length === 0) {
      $employee.innerHTML = `<option>No employees found</option>`;
      return;
    }
    for (const name of list) {
      const opt = document.createElement("option");
      opt.value = name; opt.textContent = name;
      $employee.appendChild(opt);
    }
  } catch (e) {
    console.error(e);
    $employee.innerHTML = `<option>Failed to load</option>`;
    $status.textContent = "Could not load employees.";
  }
}
loadEmployees();

// Geolocation (best-effort)
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: "", lng: "" });
    const ok = (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    const fail = () => resolve({ lat: "", lng: "" });
    navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
  });
}

// Send event (CORS-safe POST using text/plain)
async function submitEvent(event) {
  const employee = $employee.value;
  if (!employee || employee === "Loading…") {
    $status.textContent = "Please select an employee.";
    return;
  }

  $status.textContent = "Saving…";
  $btnIn.disabled = true; $btnOut.disabled = true;

  try {
    const loc = await getLocation();
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // simple request → no preflight
      body: JSON.stringify({
        employee,
        event,         // "CLOCK_IN" | "CLOCK_OUT"
        lat: loc.lat,
        lng: loc.lng,
        ua: navigator.userAgent
      }),
    });
    const json = await res.json();
    if (!res.ok || json.ok === false) throw new Error(json.error || "Failed");

    // Thank you + clear
    $status.textContent = `Thank you for ${event === "CLOCK_IN" ? "Clocking In" : "Clocking Out"}.`;
    if ($employee.options.length > 0) $employee.selectedIndex = 0;
  } catch (e) {
    console.error(e);
    $status.textContent = "Error: " + e.message;
  } finally {
    $btnIn.disabled = false; $btnOut.disabled = false;
  }
}

$btnIn.addEventListener("click", () => submitEvent("CLOCK_IN"));
$btnOut.addEventListener("click", () => submitEvent("CLOCK_OUT"));