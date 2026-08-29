/* FERARI 007 - server-backed virtual demo UI */
const API = '/api';
const TOKEN_KEY = 'fast07_token';
let currentUser = null;
let pollTimer = null;

const el = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function token(){ return localStorage.getItem(TOKEN_KEY) || ''; }

async function api(path, options={}) {
  const headers = {'Content-Type':'application/json', ...(options.headers||{})};
  if(token()) headers.Authorization = 'Bearer ' + token();
  const r = await fetch(API + path, {...options,headers});
  let data={}; try { data=await r.json(); } catch(e){}
  if(!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function signup(){
  const name=el('sName')?.value.trim(), mobile=el('sMobile')?.value.trim(),
        email=el('sEmail')?.value.trim(), password=el('sPass')?.value,
        referralCode=el('sRef')?.value.trim() || '';
  if(!name||!mobile||!email||!password) return setMsg('Please fill all fields.');
  setMsg('Creating account...');
  try{
    const d=await api('/auth/signup',{method:'POST',body:JSON.stringify({name,mobile,email,password,referralCode})});
    localStorage.setItem(TOKEN_KEY,d.token);
    currentUser=d.user;
    setMsg('Registration successful. Opening dashboard...');
    setTimeout(()=>location.href='app.html',300);
  }catch(e){ setMsg(e.message); }
}

async function login(){
  const identifier=el('lId')?.value.trim(), password=el('lPass')?.value;
  if(!identifier||!password) return setMsg('Enter email/mobile and password.');
  setMsg('Signing in...');
  try{
    const d=await api('/auth/login',{method:'POST',body:JSON.stringify({identifier,password})});
    localStorage.setItem(TOKEN_KEY,d.token);
    currentUser=d.user;
    location.href='app.html';
  }catch(e){ setMsg(e.message); }
}

function setMsg(t){ if(el('msg')) el('msg').textContent=t; }

function showLogin(){ el('signup')?.classList.add('hidden'); el('login')?.classList.remove('hidden'); setMsg(''); }
function showSignup(){ el('login')?.classList.add('hidden'); el('signup')?.classList.remove('hidden'); setMsg(''); }

async function logout(){
  localStorage.removeItem(TOKEN_KEY);
  currentUser=null;
  location.href='index.html';
}

async function loadMe(){
  if(!token()){ location.href='index.html'; return null; }
  try{
    const d=await api('/me');
    currentUser=d.user;
    return d.user;
  }catch(e){
    localStorage.removeItem(TOKEN_KEY);
    location.href='index.html';
    return null;
  }
}

async function savePage(page){
  try { await api('/me/page',{method:'PATCH',body:JSON.stringify({page})}); } catch(e){}
}

function show(id){
  document.querySelectorAll('section').forEach(x=>x.classList.add('hidden'));
  const s=el(id); if(s) s.classList.remove('hidden');
  savePage(id);
  if(id==='game') { loadDemo(); loadPredictions(); }
  if(id==='wallet') wallet();
  if(id==='profile') refreshProfilePremium();
  if(id==='support') renderSupport();
}

async function refresh(){
  if(!currentUser) await loadMe();
  if(!currentUser) return;
  const c=Number(currentUser.coins||0);
  ['walletPremiumCoins','walletActivityCoins','dashCoins','coins','profileCoins'].forEach(id=>{if(el(id))el(id).textContent=c});
  ['dashUser','username'].forEach(id=>{if(el(id))el(id).textContent=currentUser.name||'User'});
  refreshProfilePremium();
}

function refreshProfilePremium(){
  const u=currentUser||{};
  const set=(id,v)=>{if(el(id))el(id).textContent=v};
  set('profileName',u.name||'User');
  set('profileMobile',u.mobile||'Not added');
  set('profileEmail',u.email||'Not added');
  set('profileRefer',u.referralCode||'—');
  set('profileCoins',u.coins??0);
  set('profileId',u.id||'—');
  set('profileJoined',u.created_at?new Date(u.created_at).toLocaleString():'—');
  set('profileStatus',u.status||'ACTIVE');
}

async function loadDemo(){
  try{
    const [cur,hist]=await Promise.all([
      api('/demo/current'),
      api('/demo/history?limit=500')
    ]);
    const p=cur.current.period;
    if(el('period')) el('period').textContent=p;
    if(el('gamePeriod')) el('gamePeriod').textContent=p;
    if(el('dashPeriod')) el('dashPeriod').textContent=p;
    const remaining=30-(Math.floor(Date.now()/1000)%30);
    if(el('timer')) el('timer').textContent='00:'+(remaining<10?'0':'')+remaining;
    renderDemoHistory(hist.history||[]);
  }catch(e){
    if(el('gameMsg')) el('gameMsg').textContent=e.message;
  }
}

function renderDemoHistory(rows){
  const history=el('history'), recent=el('recent');
  if(history){
    history.innerHTML=(rows||[]).map(x=>`
      <div class="history-item">
        <span>#${esc(x.period)}</span>
        <span>Demo</span>
        <span>${esc(x.size)}</span>
        <span>${esc(x.colour)}</span>
        <span>${esc(x.number)}</span>
        <span>—</span>
        <b>RESULT</b>
      </div>`).join('') || '<small>No demo history yet.</small>';
  }
  if(recent){
    recent.innerHTML=(rows||[]).slice(0,8).map(x=>`
      <div class="history-item">
        <span>#${esc(x.period)}</span><span>${esc(x.number)}</span>
        <span>${esc(x.colour)}</span><b>RESULT</b>
      </div>`).join('') || '<small>No demo history yet.</small>';
  }
}

async function wallet(){ await refresh(); await renderTransactions(); }
async function renderTransactions(){try{const d=await api('/wallet/requests');const t=el('transactions');if(t)t.innerHTML=(d.requests||[]).map(x=>`<div class="prediction"><span>${esc(x.type==='ADD'?'ADD':'DEMO WITHDRAW')}</span><span>🪙 ${esc(x.amount)}</span><span>${esc(x.demo_reference)}</span><b>${esc(x.status)}</b></div>`).join('')||'<small>No demo wallet requests yet.</small>';}catch(e){}}
async function demoWalletRequest(type,amountId,refId,msgId){try{const amount=Number(el(amountId)?.value),demoReference=el(refId)?.value||'';const d=await api('/wallet/request',{method:'POST',body:JSON.stringify({type,amount,demoReference})});el(msgId).textContent=d.message;el(amountId).value='';el(refId).value='';await renderTransactions();}catch(e){el(msgId).textContent=e.message;}}
function submitDeposit(){return demoWalletRequest('ADD','depositAmount','depositRef','depositMsg');}
function submitWithdrawal(){const amount=Number(el('withdrawAmount')?.value);const wallet=(el('demoWalletId')?.value||'').trim();const name=(el('demoAccountName')?.value||'').trim();const bank=(el('demoBankCode')?.value||'').trim();if(!amount||amount<1||!wallet||!name||!bank){el('withdrawMsg').textContent='Please fill all demo withdrawal fields.';return;}const ref=`Demo Wallet: ${wallet} | Demo Name: ${name} | Demo Bank: ${bank}`;return demoWalletRequestWithRef('REMOVE',amount,ref,'withdrawMsg');}
async function demoWalletRequestWithRef(type,amount,demoReference,msgId){try{const d=await api('/wallet/request',{method:'POST',body:JSON.stringify({type,amount,demoReference})});el(msgId).textContent=d.message;el('withdrawAmount').value='';el('demoWalletId').value='';el('demoAccountName').value='';el('demoBankCode').value='';await renderTransactions();}catch(e){el(msgId).textContent=e.message;}}

function renderReferral(){
  const u=currentUser||{};
  if(el('refcode'))el('refcode').textContent=u.referralCode||'—';
  if(el('refEarned'))el('refEarned').textContent='0';
  if(el('refList'))el('refList').innerHTML='<small>Referral history is not enabled in this demo build.</small>';
}
function copyRef(){ navigator.clipboard?.writeText(currentUser?.referralCode||''); }

function submitSupport(){
  if(el('supportMsg'))el('supportMsg').textContent='Support messaging is not enabled in this demo build.';
}
function renderSupport(){
  if(el('supportList'))el('supportList').innerHTML='<small>Support tickets are not enabled in this demo build.</small>';
}

async function submitPrediction(kind, choice){
  if(el('gameMsg')) el('gameMsg').textContent='Submitting free prediction...';
  try{ const d=await api('/predict',{method:'POST',body:JSON.stringify({kind,choice})}); if(el('gameMsg'))el('gameMsg').textContent=d.message; await loadPredictions(); }
  catch(e){ if(el('gameMsg'))el('gameMsg').textContent=e.message; }
}
function pickColour(choice){ return submitPrediction('colour',choice); }
function pickNumber(choice){ return submitPrediction('number',String(choice)); }
function pickSize(choice){ return submitPrediction('size',choice); }
function setBet(){ } function setManualBet(){ } function placeAdvanced(){ if(el('gameMsg'))el('gameMsg').textContent='Choose an option above to make a free prediction.'; } function randomPick(){ } function setMult(){ }
async function loadPredictions(){
  try{ const d=await api('/predictions'); const box=el('myPredictions'); if(!box)return;
    box.innerHTML=(d.predictions||[]).map(x=>`<div class="prediction"><span>#${esc(x.period)}</span><span>${esc(x.kind)}: <b>${esc(x.choice)}</b></span><span>${esc(x.status)}</span><span>${x.points_awarded? '+'+esc(x.points_awarded)+' pts':''}</span></div>`).join('')||'<small>No predictions yet.</small>';
    await loadMe(); await refresh();
  }catch(e){}
}

function closeWinPopup(){el('winPopup')?.classList.remove('show')}
function closeLossPopup(){el('lossPopup')?.classList.remove('show')}

async function initApp(){
  const u=await loadMe();
  if(!u)return;
  await refresh();
  renderReferral();
  renderSupport();
  await loadDemo();
  await loadPredictions();
  const page=u.last_page || 'dashboard';
  show(page==='game'||page==='wallet'||page==='ref'||page==='profile'||page==='support'||page==='home'?page:'home');
  clearInterval(pollTimer);
  pollTimer=setInterval(loadDemo,1000);
}

if(location.pathname.endsWith('app.html')) initApp();
