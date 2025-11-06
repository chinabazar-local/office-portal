/* ===== Clock page script ===== */

/** 1) CONFIG: your CLOCK web app URL */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw210-ui_G8-sZOTbrmgX8FEqfcRoe17jRJRDVl8hxoHnxcifcPX-FnMIkZhEnqDLBT/exec";

/** 2) Session */
const sessRaw = localStorage.getItem('cb_user') || '{}';
let SESS = {};
try { SESS = JSON.parse(sessRaw); } catch(_){ SESS = {}; }

const EMPLOYEE_NAME = SESS.employeeName || SESS.name || '';

/** 3) DOM refs */
const signedName = document.getElementById('signedName');
const linkLeave  = document.getElementById('linkLeave');
const btnLogout  = document.getElementById('btnLogout');
const statusLine = document.getElementById('statusLine');
const sinceLine  = document.getElementById('sinceLine');
const durLine    = document.getElementById('durLine');
const btnIn      = document.getElementById('btnClockIn');
const btnOut     = document.getElementById('btnClockOut');
const errBox     = document.getElementById('errorBox');
const clockText  = document.getElementById('clockText');

/** 4) Live KTM clock */
function startClock(){
  const tz = 'Asia/Kathmandu';
  const tick = () => {
    try{
      const s = new Date().toLocaleTimeString('en-US', {
        timeZone: tz, hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      clockText.textContent = s;
    }catch(_){
      // fallback
      const d = new Date();
      clockText.textContent = [
        String(d.getHours()).padStart(2,'0'),
        String(d.getMinutes()).padStart(2,'0'),
        String(d.getSeconds()).padStart(2,'0'),
      ].join(':');
    }
  };
  tick();
  setInterval(tick, 1000);
}

/** 5) Helpers */
function showErr(msg){ if(errBox){ errBox.textContent = msg; errBox.style.display='block'; } }
function clearErr(){ if(errBox){ errBox.textContent = ''; errBox.style.display='none'; } }
function pad(n){ return String(n).padStart(2,'0'); }
function fmtLocal(ts){
  try{
    const d = new Date(ts);
    return isFinite(d) ? `${d.toLocaleDateString()} ${d.toLocaleTimeString()}` : '—';
  }catch(_){ return '—'; }
}

/** Simple POST without headers (avoid preflight) */
async function api(payload){
  const res = await fetch(APPS_SCRIPT_URL, { method:'POST', body: JSON.stringify(payload) });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if(!json.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

/** 6) Status */
let durTimer = null;
function stopDurTimer(){ if(durTimer){ clearInterval(durTimer); durTimer=null; } }

function renderStatus(data){
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
  if(!EMPLOYEE_NAME){ renderStatus(null); return; }
  try{
    clearErr();
    const data = await api({ action:'status', employeeName: EMPLOYEE_NAME });
    renderStatus(data || {});
  }catch(err){
    showErr('Failed to fetch status');
    renderStatus(null);
  }
}

/** 7) Geo (best-effort) */
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

/** 8) Clock actions */
async function clock(kind){ // 'CLOCK_IN' | 'CLOCK_OUT'
  try{
    clearErr();
    btnIn.disabled = true; btnOut.disabled = true;

    let loc = {lat:null, lng:null};
    try { loc = await getLocation(); } catch(_){}

    await api({
      action: 'clock',
      employeeName: EMPLOYEE_NAME,
      event: kind,
      lat: loc.lat,
      lng: loc.lng,
      ua: navigator.userAgent
    });

    await loadStatus();
  }catch(err){
    showErr('Failed to fetch');
  }finally{
    btnIn.disabled = false; btnOut.disabled = false;
  }
}

/** 9) Init */
window.addEventListener('DOMContentLoaded', ()=>{
  // session guard
  if(!EMPLOYEE_NAME){
    // no session; go to login
    location.href = '/login/';
    return;
  }

  // header name
  signedName.textContent = EMPLOYEE_NAME;

  // leave link: pass ?employee= and parent-frame location hints (pf_lat/pf_lng)
  linkLeave.addEventListener('click', (e)=>{
    e.preventDefault();
    const url = new URL('/leave-request/', location.origin);
    url.searchParams.set('employee', EMPLOYEE_NAME);

    // attempt one-time geo to pass down as fallback
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        p => {
          url.searchParams.set('pf_lat', String(p.coords.latitude));
          url.searchParams.set('pf_lng', String(p.coords.longitude));
          location.href = url.toString();
        },
        _ => location.href = url.toString(),
        { enableHighAccuracy:false, maximumAge:60000, timeout:3000 }
      );
    } else {
      location.href = url.toString();
    }
  });

  // logout
  btnLogout.addEventListener('click', ()=>{
    localStorage.removeItem('cb_user');
    location.href = '/login/';
  });

  // buttons
  btnIn.addEventListener('click', ()=> clock('CLOCK_IN'));
  btnOut.addEventListener('click', ()=> clock('CLOCK_OUT'));

  startClock();
  loadStatus();
});
