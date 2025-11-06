const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw210-ui_G8-sZOTbrmgX8FEqfcRoe17jRJRDVl8hxoHnxcifcPX-FnMIkZhEnqDLBT/exec';
const TZ = 'Asia/Kathmandu';
const $ = s => document.querySelector(s);

// ---- Session guard ----
function currentUser(){
  const name = localStorage.getItem('employeeName');
  const exp  = +localStorage.getItem('loginExpiry') || 0;
  if (!name || Date.now() > exp) return null;
  return name;
}
function requireLogin(){
  const name = currentUser();
  if (!name){ location.href='/login'; return null; }
  $('#empNameHead').textContent = name;
  return name;
}
document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.clear(); location.href='/login'; });

// ---- Live time ----
function tick(){
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true,timeZone:TZ}).formatToParts(now);
  const hhmmss = parts.filter(p=>['hour','minute','second'].includes(p.type)).map(p=>p.value.padStart(2,'0')).join(':');
  const ap = (parts.find(p=>p.type==='dayPeriod')?.value || '').toUpperCase();
  $('#live-time').textContent = hhmmss; $('#ampm').textContent=' '+ap;
}
setInterval(tick,1000); tick();

// ---- Status & duration ----
let lastIn=null, state='OUT', durTimer=null;
function fmtISOtoLocal(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-US', {hour:'2-digit',minute:'2-digit',second:'2-digit',month:'short',day:'2-digit',timeZone:TZ}).format(d);
}
function renderStatus(){
  $('#statusLine').textContent = `STATUS: ${state==='IN'?'CLOCKED IN':'CLOCKED OUT'}`;
  $('#sinceLine').textContent  = `Since: ${state==='IN'?fmtISOtoLocal(lastIn):'—'}`;
  if (state==='IN' && lastIn){
    const up = () => {
      const ms = Date.now() - new Date(lastIn).getTime();
      const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000), s = Math.floor((ms%60000)/1000);
      $('#durLine').textContent = `Duration: ${h}h ${m}m ${s}s`;
    };
    clearInterval(durTimer); up(); durTimer=setInterval(up,1000);
  } else {
    clearInterval(durTimer); $('#durLine').textContent = 'Duration: —';
  }
}
async function loadStatus(name){
  const r = await fetch(APPS_SCRIPT_URL, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action:'status', employeeName:name })
  }).then(r=>r.json());
  if(!r.ok) throw new Error(r.error||'status failed');
  const d = r.data||{};
  state = d.state || 'OUT';
  lastIn = d.lastInISO || null;
  renderStatus();
}

// ---- Geolocation (best effort) ----
function getLocation(){
  return new Promise((resolve)=> {
    if (!navigator.geolocation) return resolve({lat:'',lng:''});
    navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),
      ()=>resolve({lat:'',lng:''}),
      {enableHighAccuracy:true, timeout:8000}
    );
  });
}

// ---- Submit clock events ----
async function submitEvent(kind){
  const name = currentUser(); if(!name) return;
  $('#status').textContent='Saving…'; $('#btn-in').disabled=true; $('#btn-out').disabled=true;
  try{
    const loc = await getLocation();
    const r = await fetch(APPS_SCRIPT_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        action:'clock', employeeName:name, event:kind,
        lat:loc.lat, lng:loc.lng, ua:navigator.userAgent
      })
    }).then(r=>r.json());
    if(!r.ok || !r.data?.ok) throw new Error(r.data?.error||r.error||'Failed');
    $('#status').textContent = `Thank you for ${kind==='CLOCK_IN'?'Clocking In':'Clocking Out'}.`;
    await loadStatus(name);
  }catch(e){
    $('#status').textContent = 'Error: '+(e.message||e);
  }finally{
    $('#btn-in').disabled=false; $('#btn-out').disabled=false;
  }
}

// ---- Bootstrap ----
const NAME = requireLogin(); if (NAME){ loadStatus(NAME); }
document.getElementById('btn-in').addEventListener('click', ()=>submitEvent('CLOCK_IN'));
document.getElementById('btn-out').addEventListener('click',()=>submitEvent('CLOCK_OUT'));
