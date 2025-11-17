// ==== 1) CONFIG: Timesheet Login Apps Script URL ====
// Replace this with the Web App URL from your *Timesheet Login* Apps Script
// (the project with SPREADSHEET_ID = '1xpY-_WOp_BAJhpTucnUKnK8doxsRgWgHwPPmP2HoHPw')
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz94leF_gCFo-F5Etuo4sHmKwZvWGjjuWNP_ZrvycBCg24voQwDSLkU25oqffuT511LLA/exec";

const $ = (sel) => document.querySelector(sel);

// Toggle password visibility
$("#sh")?.addEventListener("click", () => {
  const p = $("#p");
  if (!p) return;
  p.type = p.type === "password" ? "text" : "password";
});

// Click + Enter handlers
$("#loginBtn")?.addEventListener("click", onLogin);
$("#p")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onLogin();
});

// ==== 2) Session storage ====
// Save both old keys (for leave-request) and new JSON (for clock page)
function setSession(name, username, remember) {
  const now = Date.now();
  const ttl = remember ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000; // 30d or 12h
  const exp = now + ttl;

  // Old keys (used by existing code / wrappers)
  localStorage.setItem("employeeName", name);
  localStorage.setItem("loginExpiry", String(exp));

  // New JSON session used by script_clock.js
  localStorage.setItem(
    "cb_user",
    JSON.stringify({
      employeeName: name,
      username,
      exp,
    })
  );
}

// ==== 3) Login handler with loading state ====
async function onLogin() {
  const errEl = $("#err");
  if (errEl) errEl.textContent = "";

  const btn = $("#loginBtn");
  const btnText = $("#loginBtnText");

  const username = ($("#u")?.value || "").trim();
  const password = $("#p")?.value || "";
  const remember = !!$("#rm")?.checked;

  if (!username || !password) {
    if (errEl) errEl.textContent = "Username and password are required";
    return;
  }

  try {
    // Set loading state
    if (btn) {
      btn.disabled = true;
      btn.classList.add("loading");
      if (btnText) btnText.textContent = "Signing in…";
    }

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      // no custom headers to avoid CORS preflight
      body: JSON.stringify({ action: "login", username, password }),
    });

    if (!res.ok) {
      throw new Error("Network error " + res.status);
    }

    const json = await res.json();

    // Timesheet Login doPost returns: { ok:true, data:{ ok:true, employeeName:'...' } }
    if (!json.ok) {
      throw new Error(json.error || "Login failed");
    }

    const data = json.data || {};
    if (!data.ok) {
      throw new Error(data.error || "Invalid username or password");
    }

    const empName = (data.employeeName || "").trim() || username;

    // Save session and go to clock page
    setSession(empName, username, remember);
    location.href = "/";

  } catch (err) {
    if (errEl) errEl.textContent = String(err.message || err);
  } finally {
    // Clear loading state
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("loading");
      if (btnText) btnText.textContent = "Login";
    }
  }
}
