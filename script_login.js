const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbymYW5sH9x-IJO_KoZfSi9ZLi9izXvB8Q9IJj4K8yXpDqWZKOWoMebATLX_yv9L8bZZFA/exec';

const $ = s => document.querySelector(s);
$('#sh').addEventListener('click', ()=> {
  const p = $('#p');
  p.type = p.type === 'password' ? 'text' : 'password';
});
$('#loginBtn').addEventListener('click', onLogin);
$('#p').addEventListener('keydown', e=>{ if(e.key==='Enter') onLogin(); });

function setSession(name, remember){
  const now = Date.now();
  const ttl = remember ? 30*24*60*60*1000 : 12*60*60*1000; // 30d or 12h
  localStorage.setItem('employeeName', name);
  localStorage.setItem('loginExpiry', String(now + ttl));
}

async function onLogin(){
  $('#err').textContent = '';
  const username = $('#u').value.trim();
  const password = $('#p').value;
  if(!username || !password){ $('#err').textContent='Enter username & password'; return; }

  try{
    const r = await fetch(APPS_SCRIPT_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'login', username, password })
    }).then(r=>r.json());

    if(!r.ok || !r.data || !r.data.ok) throw new Error(r.data?.error || r.error || 'Login failed');

    setSession(r.data.employeeName, $('#rm').checked);
    // go to clock
    location.href = '/';
  }catch(err){
    $('#err').textContent = String(err.message || err);
  }
}
