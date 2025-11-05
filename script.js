// Replace with your Apps Script Web App URL (/exec)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby8Gfc3JhMfTl4U6QSp81FnTGNRxksL17dSzsxY0OJz3qBpTbQONpevulpat7HFI6G-/exec";

const $time = document.getElementById("live-time");
const $today = document.getElementById("today");
const $employee = document.getElementById("employee");
const $btnIn = document.getElementById("btn-in");
const $btnOut = document.getElementById("btn-out");
const $status = document.getElementById("status");

// ---- Live KTM date/time ----
function tick() {
  const optsTime = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Kathmandu" };
  const optsDate = { weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Kathmandu" };
  const now = new Date();
  $time.textContent = new Intl.DateTimeFormat("en-GB", optsTime).format(now);
  $today.textContent = new Intl.DateTimeFormat("en-GB", optsDate).format(now);
}
tick(); setInterval(tick, 1000);

// ---- Load employees from Sheet (Employee!A1:A, skipping header) ----
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

// ---- Geolocation helper (best-effort) ----
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: "", lng: "" });
    const ok = (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    const fail = () => resolve({ lat: "", lng: "" });
    navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
  });
}

// ---- Submit event ----
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee,
        event,      // "CLOCK_IN" | "CLOCK_OUT"
        lat: loc.lat,
        lng: loc.lng,
        ua: navigator.userAgent
      }),
    });
    const json = await res.json();
    if (!res.ok || json.ok === false) throw new Error(json.error || "Failed");

    // Thank you message + reset
    $status.textContent = `Thank you for ${event === "CLOCK_IN" ? "Clocking In" : "Clocking Out"}.`;
    // Reset selection to first employee (or keep as-is if you prefer)
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