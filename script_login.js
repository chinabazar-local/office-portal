// script_login.js

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8Gfc3JhMfTl4U6QSp81FnTGNRxksL17dSzsxY0OJz3qBpTbQONpevulpat7HFI6G-/exec';

const $ = s => document.querySelector(s);

$('#sh').addEventListener('click', () => {
  const p = $('#p');
  p.type = p.type === 'password' ? 'text' : 'password';
});

$('#loginBtn').addEventListener('click', onLogin);
$('#p').addEventListener('keydown', e => { if (e.key === 'Enter') onLogin(); });

/**
 * Store session exactly how script_clock.js expects it:
 * localStorage["cb_user"] = JSON.stringify({ employeeName, createdAt, expiresAt })
 */
function setSession(employeeName, remember) {
  const now = Date.now();
  const ttl = remember ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000; // 30d or 12h

  const session = {
    employeeName,
    createdAt: now,
    expiresAt: now + ttl
  };

  localStorage.setItem('cb_user', JSON.stringify(session));
}

/**
 * Login handler
 */
async function onLogin() {
  $('#err').textContent = '';

  const username = $('#u').value.trim();
  const password = $('#p').value;

  if (!username || !password) {
    $('#err').textContent = 'Enter username & password';
    return;
  }

  try {
    if (!APPS_SCRIPT_URL || !/^https:/.test(APPS_SCRIPT_URL)) {
      throw new Error('APPS_SCRIPT_URL is missing or not https');
    }

    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      // IMPORTANT: no custom headers = no preflight
      body: JSON.stringify({ action: 'login', username, password })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();

    // 1) Basic ok flag
    if (!json.ok) {
      throw new Error(json.error || 'Login failed');
    }

    // 2) Support both shapes:
    //    a) { ok:true, employeeName:'...' }
    //    b) { ok:true, data:{ ok:true, employeeName:'...' } }
    let employeeName = null;

    if (json.data) {
      if (json.data.ok === false) {
        throw new Error(json.data.error || 'Login failed');
      }
      employeeName = json.data.employeeName || json.data.name || null;
    } else {
      employeeName = json.employeeName || json.name || null;
    }

    if (!employeeName) {
      // last fallback – use username as display name
      employeeName = username;
    }

    setSession(employeeName, $('#rm').checked);

    // Go to clock page (your clock HTML route)
    // If your clock page is at "/" this is correct.
    // If it is at "/clock/" then change this to "/clock/".
    location.href = '/';
  } catch (err) {
    $('#err').textContent = String(err.message || err || 'Login failed');
  }
}
