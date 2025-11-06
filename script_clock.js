/* ===== Clock page script (drop-in) ===== */

/** 1) CONFIG **/
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw210-ui_G8-sZOTbrmgX8FEqfcRoe17jRJRDVl8hxoHnxcifcPX-FnMIkZhEnqDLBT/exec';  // same URL used by login
const EMP = JSON.parse(localStorage.getItem('cb_user') || '{}'); // {name, username, token...}
const EMPLOYEE_NAME = EMP && EMP.employeeName ? EMP.employeeName : (EMP.name || ''); // fallback

/** 2) DOM refs **/
const statusLine = document.getElementById('statusLine');
const sinceLine  = document.getElementById('sinceLine');
const durLine    = document.getElementById('durLine');
const errBox     = document.getElementById('errorBox');       // <div id="errorBox">…</div> optional
const btnIn      = document.getElementById('btnClockIn');
const btnOut     = document.getElementById('btnClockOut');

/** 3) Helpers **/
function showErr(msg){ if(errBox){ errBox.textContent = msg; errBox.style.display='block'; } }
function clearErr(){ if(errBox){ errBox.textContent = ''; errBox.style.display='none'; } }
function pad(n){ return String(n).padStart(2,'0'); }
function fmtLocal(ts){
  try{
    const d = new Date(ts);
    return isFinite(d) ? `${d.toLocaleDateString()} ${d.toLocaleTimeString()}` : '—';
  }catch(_){ return '—'; }
}

/** Simple POST without headers (avoids preflight) **/
async function api(payload){
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if(!json.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

/** 4) Status polling + render **/
let durTimer = null;
function stopDurTimer(){ if(durTimer){ clearInterval(durTimer); durTimer = null; } }

function renderStatus(data){
  // expected from backend: { state:'IN'|'OUT', sinceISO:'...', lastISO:'...' }
  const state = data && data.state ? String(data.state).toUpperCase() : '—';
  const sinceISO = data && data.sinceISO || null;

  statusLine.textContent = `STATUS: ${state === 'IN' ? 'CLOCKED IN' : (state === 'OUT' ? 'CLOCKED OUT' : '—')}`;
  sinceLine.textContent  = `Since: ${sinceISO ? fmtLocal(sinceISO) : '—'}`;

  stopDurTimer();
  if (state === 'IN' && sinceISO){
    const start = new Date(sinceISO).getTime();
    const tick = () => {
      const ms = Date.now() - start;
      const h = Math.floor(ms/3600000);
      const m = Math.floor((ms%3600000)/60000);
      const s = Math.floor((ms%60000)/1000);
      durLine.textContent = `Duration: ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
    };
    tick();
    durTimer = setInterval(tick, 1000);
  } else {
    durLine.textContent = 'Duration: —';
  }
}

async function loadStatus(){
  try{
    clearErr();
    const data = await api({ action:'status', employeeName: EMPLOYEE_NAME });
    renderStatus(data || {});
  }catch(err){
    showErr('Failed to fetch status');
    renderStatus(null);
  }
}

/** 5) Geolocation (best-effort) **/
function getLocation(timeout=6000){
  return new Promise((res, rej)=>{
    if(!navigator.geolocation) return rej(new Error('No geolocation'));
    navigator.geolocation.getCurrentPosition(
      p => res({lat:p.coords.latitude, lng:p.coords.longitude}),
      _ => rej(new Error('Geo denied')),
      { enableHighAccuracy:false, maximumAge:60000, timeout }
    );
  });
}

/** 6) Clock actions **/
async function clock(kind){ // kind: 'CLOCK_IN' | 'CLOCK_OUT'
  try{
    clearErr();
    btnIn && (btnIn.disabled = true);
    btnOut && (btnOut.disabled = true);

    let loc = {lat:null, lng:null};
    try { loc = await getLocation(); } catch(_){}

    await api({
      action: 'clock',
      employeeName: EMPLOYEE_NAME,
      event: kind,                 // EXACT string expected by backend
      lat: loc.lat,
      lng: loc.lng,
      ua: navigator.userAgent
    });

    await loadStatus();
  }catch(err){
    showErr('Failed to fetch'); // keep same user-facing message you showed
  }finally{
    btnIn && (btnIn.disabled = false);
    btnOut && (btnOut.disabled = false);
  }
}

/** 7) Wire UI **/
window.addEventListener('DOMContentLoaded', ()=>{
  // Attach buttons
  if (btnIn)  btnIn.addEventListener('click',  ()=> clock('CLOCK_IN'));
  if (btnOut) btnOut.addEventListener('click', ()=> clock('CLOCK_OUT'));
  // Initial status load
  loadStatus();
});
