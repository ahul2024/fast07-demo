/* FERARI 007 - Virtual Demo build. No real-money payments. */
/* SERVER DATA LAYER: registration, login, wallet requests and live account data */
const API_BASE='';
const getToken=()=>localStorage.getItem('fast07_token')||'';
async function api(path, options={}){
  const headers={'Content-Type':'application/json',...(options.headers||{})};
  const t=getToken(); if(t) headers.Authorization='Bearer '+t;
  const r=await fetch(API_BASE+path,{...options,headers});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||'Request failed');
  return d;
}
async function syncServerUser(){
  const t=getToken(); if(!t) return null;
  try{
    const d=await api('/api/me');
    const u=d.user;
    localStorage.setItem(U,JSON.stringify({
      id:String(u.id),name:u.name,mobile:u.mobile,email:u.email,status:u.status,
      coins:Number(u.coins||0),refCode:u.referral_code||u.referralCode||'',lastPage:u.last_page||u.lastPage||'dashboard',
      joined:u.created_at||'',lastSeen:u.last_seen||Date.now()
    }));
    localStorage.setItem(C+':'+u.id,String(u.coins||0));
}
    return u;
  }catch(e){ localStorage.removeItem('fast07_token'); localStorage.removeItem(U); return null; }
}

const U='demoUser', USERS='demoUsers', C='demoCoins', H='demoHistory', T='demoTx', REQ='demoRequests', ACT='demoLiveActivity', SUP='demoSupport', REF='demoReferrals', ROUNDS='demoRounds', TEST='adminTestResult';
const el=id=>document.getElementById(id);
const safeJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch(e){return fallback}};
const user=()=>safeJSON(U,null);
const uid=()=>{const u=ensureCurrentUser()||user();return u&&u.id||''};
const key=(base)=>uid()?base+':'+uid():base;
function ensureCurrentUser(){
  let u=safeJSON(U,null); if(!u)return null;
  let a=allUsers(), i=a.findIndex(x=>x.id===u.id || x.email===u.email || x.mobile===u.mobile);
  if(i<0){u={...u,id:u.id||('U'+Date.now().toString().slice(-8)),status:u.status||'ACTIVE',joined:u.joined||now(),coins:Number(localStorage.getItem(C)||u.coins||1000),refCode:u.refCode||u.ref||('REF-'+String(u.mobile||'').replace(/\D/g,'').slice(-6)),referralEarned:Number(u.referralEarned||0),lastSeen:Date.now()};a.push(u);saveUsers(a);localStorage.setItem(U,JSON.stringify(u));localStorage.setItem(C+':'+u.id,String(u.coins));return u}
  if(!a[i].id){a[i].id='U'+Date.now().toString().slice(-8)}
  if(!a[i].status)a[i].status='ACTIVE';
  if(a[i].coins==null)a[i].coins=Number(u.coins??localStorage.getItem(C)??0);
  if(!a[i].refCode)a[i].refCode='REF-'+String(a[i].mobile||'').replace(/\D/g,'').slice(-6);
  a[i].lastSeen=Date.now();saveUsers(a);u=a[i];localStorage.setItem(U,JSON.stringify(u));if(!localStorage.getItem(C+':'+u.id))localStorage.setItem(C+':'+u.id,String(u.coins||1000));return u;
}

const coins=()=>Number(localStorage.getItem(key(C))||0);
const now=()=>new Date().toLocaleString();
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function allUsers(){return safeJSON(USERS,[])}
function saveUsers(a){localStorage.setItem(USERS,JSON.stringify(a))}
function updateUser(patch){const u=user();if(!u)return;let a=allUsers(),i=a.findIndex(x=>x.id===u.id);if(i<0)return; a[i]={...a[i],...patch};saveUsers(a);localStorage.setItem(U,JSON.stringify(a[i]));}
function setCoins(x){x=Math.max(0,Math.floor(Number(x)||0));localStorage.setItem(key(C),String(x));updateUser({coins:x,lastSeen:Date.now()});refresh()}
function addActivity(action,details='',amount=0){const u=user();if(!u)return;let a=safeJSON(ACT,[]);a.unshift({id:'A'+Date.now()+Math.random().toString(36).slice(2,5),userId:u.id,userName:u.name,action,details,amount,coins:coins(),time:now()});localStorage.setItem(ACT,JSON.stringify(a.slice(0,1000)));updateUser({lastSeen:Date.now()})}

async function signup(){
  const name=el('sName').value.trim(),mobile=el('sMobile').value.trim(),email=el('sEmail').value.trim().toLowerCase(),pass=el('sPass').value,referralCode=el('sRef').value.trim().toUpperCase();
  if(!name||!mobile||!email||!pass)return el('msg').textContent='Please fill all fields.';
  el('msg').textContent='Creating account...';
  try{
    await api('/api/auth/signup',{method:'POST',body:JSON.stringify({name,mobile,email,password:pass,referralCode})});
    /* Registration is complete, but the user must log in explicitly. */
    el('signup').classList.add('hidden'); el('login').classList.remove('hidden');
    el('lId').value=email; el('lPass').value='';
    el('msg').textContent='✓ Registration successful. Please login to continue.';
  }catch(e){el('msg').textContent=e.message}
}
async function login(){
  const identifier=el('lId').value.trim(),password=el('lPass').value;
  if(!identifier||!password)return el('msg').textContent='Enter login details.';
  el('msg').textContent='Logging in...';
  try{
    const d=await api('/api/auth/login',{method:'POST',body:JSON.stringify({identifier,password})});
    localStorage.setItem('fast07_token',d.token);
    localStorage.setItem(U,JSON.stringify(d.user));
    localStorage.setItem(C+':'+d.user.id,String(d.user.coins||0));
    localStorage.setItem('fast07_last_page',d.user.lastPage||'dashboard');
    location.href='app.html';
  }catch(e){el('msg').textContent=e.message}
}
function showLogin(){el('signup').classList.add('hidden');el('login').classList.remove('hidden')}
function showSignup(){el('login').classList.add('hidden');el('signup').classList.remove('hidden')}
function logout(){localStorage.removeItem('fast07_token');localStorage.removeItem(U);location.href='index.html'}

function refresh(){const c=coins();refreshManualDemoCoins();['walletPremiumCoins','walletActivityCoins','dashCoins','coins','profileCoins'].forEach(id=>{if(el(id))el(id).textContent=c});if(el('dashUser'))el('dashUser').textContent=user()?.name||'User';if(el('dashPeriod'))el('dashPeriod').textContent=getPeriod();updatePeriodDisplay();if(el('profileName'))refreshProfilePremium()}
let pageSaveTimer=null;
async function saveLastPage(id){if(!getToken()||!id)return;localStorage.setItem('fast07_last_page',id);clearTimeout(pageSaveTimer);pageSaveTimer=setTimeout(()=>api('/api/me/state',{method:'PATCH',body:JSON.stringify({page:id})}).catch(()=>{}),120)}
function show(id){document.querySelectorAll('section').forEach(x=>x.classList.add('hidden'));const s=el(id);if(s)s.classList.remove('hidden');saveLastPage(id);if(id==='game'){renderAdvancedHistory();startAdvanced()}if(id==='wallet'){wallet();renderTransactions()}if(id==='ref'){renderReferral()}if(id==='profile'){refreshProfilePremium()}if(id==='support'){renderSupport()}}

let selectedColour='',selectedNumber=null,selectedSize='',mult=1,bet=10,t=30,locked=false,iv=null,currentPeriod='';
function pickColour(c,b){selectedColour=c;document.querySelectorAll('.colour').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');updateChoice()}
function pickNumber(n,b){selectedNumber=n;document.querySelectorAll('.number-grid button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');updateChoice()}
function pickSize(s,b){selectedSize=s;document.querySelectorAll('.bigsmall button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');updateChoice()}
function setMult(x,b){mult=x;document.querySelectorAll('.mult-row button').forEach(y=>y.classList.remove('active-mult'));b.classList.add('active-mult')}
function randomPick(){const n=Math.floor(Math.random()*10),b=document.querySelectorAll('.number-grid button')[n];if(b)pickNumber(n,b)}
function updateChoice(){let a=[];if(selectedColour)a.push(selectedColour);if(selectedNumber!==null)a.push('Number '+selectedNumber);if(selectedSize)a.push(selectedSize);if(el('gameMsg'))el('gameMsg').textContent=a.length?'Selected: '+a.join(' • '):'Choose a prediction.'}
function setBet(x){bet=Math.max(1,Number(x)||1);if(el('bet'))el('bet').textContent=bet}
function setManualBet(){const x=Number(el('manualBet')?.value||0);if(x<1)return el('betMsg').textContent='Enter at least 1 virtual coin.';if(x>coins())return el('betMsg').textContent='Amount exceeds your available virtual coins.';setBet(x);el('betMsg').textContent='✓ Bet amount set to 🪙 '+x}

function getPeriod(){return String(1000000000+Math.floor(Date.now()/30000))}
function updatePeriodDisplay(){
  const p=String(currentPeriod||getPeriod());
  ['period','gamePeriod','dashPeriod'].forEach(id=>{
    if(el(id)) el(id).textContent=p;
  });
}
function getRoundResults(){return safeJSON(ROUNDS,{})}
function getRoundResult(period){let all=getRoundResults();if(all[period])return all[period];let test=safeJSON(TEST,null);let useTest=test&&test.period===period;let n=useTest&&test.number!==''?Number(test.number):Math.floor(Math.random()*10);let colour=useTest&&test.colour?test.colour:(n===5?'Violet':(n%2===0?'Red':'Green'));let size=n>=5?'Big':'Small';let out={period,number:n,colour,size,adminTest:!!useTest,time:now()};all[period]=out;localStorage.setItem(ROUNDS,JSON.stringify(all));return out}
let serverRoundCache={};
async function loadServerRound(period){try{const d=await api('/api/game/round/'+encodeURIComponent(period));if(d.round){serverRoundCache[period]=d.round;return d.round}}catch(e){}return null}
async function renderAdvancedHistory(){
  const e=el('history');
  if(!e)return;

  try{
    const d=await api('/api/game/history?limit=5000');
const rows=d.history||[];
currentPeriod=String(d.currentPeriod||getPeriod());
updatePeriodDisplay();
    if(!rows.length){
      e.innerHTML='<small>No rounds yet.</small>';
      if(el('recent'))el('recent').innerHTML='<small>No rounds yet.</small>';
      return;
    }

    e.innerHTML=rows.map(x=>{
      const period=String(x.period||'');
      const isCurrent=period===currentPeriod;

      const result=x.number==null ? '--' : x.number;
      const size=x.size||'--';
      const colour=x.colour||'--';

      const betChoice=x.bet_choice||'No Bet';
      const amount=Number(x.bet_amount||0);

      let status;
      if(isCurrent){
        status='LIVE';
      }else if(x.bet_outcome){
        status=String(x.bet_outcome);
      }else{
        status='NO BET';
      }

      return `
        <div class="history-item">
          <span>#${esc(period)}</span>
          <span>${esc(betChoice)}</span>
          <span>${esc(size)}</span>
          <span>${esc(colour)}</span>
          <span>${esc(result)}</span>
          <span>🪙 ${esc(amount)}</span>
          <b class="status-${status.toLowerCase().replace(/\s+/g,'-')}">
            ${esc(status)}
          </b>
        </div>
      `;
    }).join('');

    if(el('recent')){
      el('recent').innerHTML=rows.slice(0,8).map(x=>{
        const period=String(x.period||'');
        const isCurrent=period===currentPeriod;

        return `
          <div class="history-item">
            <span>#${esc(period)}</span>
            <span>${esc(x.number==null?'--':x.number)}</span>
            <span>${esc(x.colour||'--')}</span>
            <b>${esc(
              isCurrent ? 'LIVE' :
              (x.bet_outcome||'NO BET')
            )}</b>
          </div>
        `;
      }).join('');
    }

  }catch(err){
    console.error('History load failed:',err);
    e.innerHTML='<small>Unable to load history.</small>';
    if(el('recent'))el('recent').innerHTML='<small>Unable to load history.</small>';
  }
}
function startAdvanced(){clearInterval(iv);currentPeriod=getPeriod();t=Math.ceil((30000-(Date.now()%30000))/1000);locked=false;selectedNumber=null;selectedColour='';selectedSize='';if(el('timer'))el('timer').textContent='00:30';if(el('period'))el('period').textContent=currentPeriod;document.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'));renderAdvancedHistory();loadServerRound(currentPeriod);iv=setInterval(()=>{t--;if(el('timer'))el('timer').textContent='00:'+(t<10?'0':'')+t;if(t<=8&&t>0)countdownBeep(t);if(t<=0){clearInterval(iv);finishRound(currentPeriod)}},1000)}
function recordLiveRound(period){renderAdvancedHistory()}
async function placeAdvanced(){if(locked)return;if(!selectedColour&&selectedNumber===null&&!selectedSize)return el('gameMsg').textContent='Choose a prediction first.';if(coins()<bet)return el('gameMsg').textContent='Insufficient virtual coins.';setCoins(coins()-bet);locked=true;let choice=selectedNumber!==null?'Number '+selectedNumber:(selectedColour||selectedSize);let h=safeJSON(key(H),[]),row=h.find(x=>x.period===currentPeriodPeriod);if(row){row.bet=bet;row.betChoice=choice;row.mult=mult;row.status='BET PLACED';localStorage.setItem(key(H),JSON.stringify(h))}try{await api('/api/game/bet',{method:'POST',body:JSON.stringify({period:currentPeriod,amount:bet,choice})})}catch(e){}addActivity('BET','Period '+currentPeriod+' • '+choice+' • '+bet+' coins',bet);el('gameMsg').textContent='Prediction locked for Period '+currentPeriod+' • Waiting for result…';renderAdvancedHistory()}
async function finishRound(period){const server=serverRoundCache[period]||await loadServerRound(period);const result=server?{period,number:Number(server.number),colour:server.colour,size:server.size}:getRoundResult(period);const h=safeJSON(key(H),[]),row=h.find(x=>x.period===period)||{period};const win=!!locked&&((selectedNumber!==null&&selectedNumber===result.number)||(selectedColour&&selectedColour===result.colour)||(selectedSize&&selectedSize===result.size));row.number=result.number;row.colour=result.colour;row.size=result.size;row.status=locked?(win?'WIN':'LOSS'):'NO BET';row.win=win;row.resultTime=now();if(locked&&win){const reward=bet*2*mult;setCoins(coins()+reward);row.reward=reward;showWinPopup('🎉 '+result.number+' • '+result.colour+' • '+result.size,reward);addActivity('WIN','Period '+period+' • Result '+result.number+' '+result.colour+' '+result.size,reward)}else if(locked){row.reward=0;showLossPopup('😔 '+result.number+' • '+result.colour+' • '+result.size,bet);addActivity('LOSS','Period '+period+' • Result '+result.number+' '+result.colour+' '+result.size,-bet)}localStorage.setItem(key(H),JSON.stringify(h));try{await api('/api/game/settle',{method:'POST',body:JSON.stringify({period})})}catch(e){}renderAdvancedHistory();refresh();selectedNumber=null;selectedColour='';selectedSize='';if(!el('game')?.classList.contains('hidden'))setTimeout(startAdvanced,1200)}
function addTx(type,amount,status='PENDING',meta={}){let x=safeJSON(key(T),[]);x.unshift({id:'TX'+Date.now()+Math.random().toString(36).slice(2,5),type,amount,status,time:now(),...meta});localStorage.setItem(key(T),JSON.stringify(x));}
function updateTxForRequest(requestId,status,amount){let x=safeJSON(key(T),[]),i=x.findIndex(q=>q.requestId===requestId);if(i>=0){x[i].status=status;if(amount!==undefined)x[i].amount=amount;x[i].updatedAt=now();localStorage.setItem(key(T),JSON.stringify(x));}return i>=0}
function requests(){return safeJSON(REQ,[])}function saveRequests(a){localStorage.setItem(REQ,JSON.stringify(a))}
async function submitDeposit(){
  const amount=Number(el('depositAmount')?.value||0),utr=el('depositUtr')?.value.trim()||'',ref=el('depositRef')?.value.trim()||'Demo reference';
  if(amount<1)return el('depositMsg').textContent='Enter a valid virtual coin amount.';
  if(!utr)return el('depositMsg').textContent='Enter the UTR No. before sending the request.';
  if(utr.length<6)return el('depositMsg').textContent='Enter a valid UTR No.';
  try{
    await api('/api/requests/deposit',{method:'POST',body:JSON.stringify({amount,details:{utr,reference:ref}})});
    el('depositMsg').textContent='✓ Deposit request sent to Admin with UTR No. Waiting for approval.';
    el('depositAmount').value=''; el('depositUtr').value=''; el('depositRef').value=''; await renderTransactions(); await syncServerUser(); refresh();
  }catch(e){el('depositMsg').textContent=e.message}
}
async function submitWithdrawal(){
  const amount=Number(el('withdrawAmount')?.value||0),bank=el('bankName')?.value.trim(),account=el('bankAccount')?.value.trim(),ifsc=el('bankIfsc')?.value.trim();
  if(amount<1)return el('withdrawMsg').textContent='Enter a valid virtual coin amount.';
  if(!bank||!account||!ifsc)return el('withdrawMsg').textContent='Enter demo bank name, account and IFSC.';
  try{
    await api('/api/requests/withdrawal',{method:'POST',body:JSON.stringify({amount,details:{bank,account,ifsc}})});
    el('withdrawMsg').textContent='✓ Withdrawal request sent to Admin. Coins are held until Admin approval.';
    el('withdrawAmount').value='';el('bankName').value='';el('bankAccount').value='';el('bankIfsc').value='';
    await renderTransactions(); await syncServerUser(); refresh();
  }catch(e){el('withdrawMsg').textContent=e.message}
}
async function renderTransactions(){
  try{
    const d=await api('/api/transactions'),x=d.transactions||[];
    const fmt=q=>`<div class="history-item"><span>🪙 ${esc(Math.abs(q.amount||0))}</span><span>${esc(q.type)}</span><span>${esc(q.status)}</span><small>${esc(q.created_at||'')}</small></div>`;
    const dep=x.filter(q=>q.type==='DEPOSIT'), wit=x.filter(q=>q.type==='WITHDRAWAL');
    if(el('depositHistoryList'))el('depositHistoryList').innerHTML=dep.map(fmt).join('')||'<small>No deposit history.</small>';
    if(el('withdrawHistoryList'))el('withdrawHistoryList').innerHTML=wit.map(fmt).join('')||'<small>No withdrawal history.</small>';
    if(el('transactions'))el('transactions').innerHTML=x.map(fmt).join('')||'<small>No transactions.</small>';
  }catch(e){}
}
function wallet(){refresh();renderTransactions()}
function wallet(){refresh();renderTransactions()}

function renderReferral(){const u=user();if(!u)return;if(el('refcode'))el('refcode').textContent=u.refCode||('REF-'+u.mobile.slice(-6));if(el('refEarned'))el('refEarned').textContent=Number(u.referralEarned||0);let r=safeJSON(REF,[]).filter(x=>x.referrerId===u.id);if(el('refList'))el('refList').innerHTML=r.map(x=>`<div class="history-item"><span>${esc(x.newUserName)}</span><span>+100 coins</span><small>${esc(x.time)}</small></div>`).join('')||'<small>No successful referrals yet.</small>'}
function copyRef(){const u=user();navigator.clipboard?.writeText(u?.refCode||'').then(()=>alert('Referral code copied.')).catch(()=>alert(u?.refCode||''))}
function refreshProfilePremium(){const u=user()||{};const set=(id,v)=>{if(el(id))el(id).textContent=v};set('profileName',u.name||'User');set('profileMobile',u.mobile||'Not added');set('profileEmail',u.email||'Not added');set('profileRefer',u.refCode||u.ref||'—');set('profileCoins',coins());set('profileId',u.id||'U00001');set('profileJoined',u.joined||'—');set('profileStatus',u.status||'ACTIVE')}

function submitSupport(){const text=el('supportText')?.value.trim();if(!text)return el('supportMsg').textContent='Write your message first.';let a=safeJSON(SUP,[]);a.unshift({id:'S'+Date.now(),userId:uid(),userName:user().name,message:text,status:'OPEN',time:now()});localStorage.setItem(SUP,JSON.stringify(a));addActivity('SUPPORT','Support ticket opened');el('supportText').value='';el('supportMsg').textContent='✓ Support request sent to Admin.';renderSupport()}
function renderSupport(){const a=safeJSON(SUP,[]).filter(x=>x.userId===uid());if(el('supportList'))el('supportList').innerHTML=a.map(x=>`<div class="history-item"><span>${esc(x.message)}</span><span>${esc(x.status)}</span><small>${esc(x.time)}</small></div>`).join('')||'<small>No support tickets.</small>'}

function countdownBeep(seconds){try{const AC=window.AudioContext||window.webkitAudioContext;audioCtx=audioCtx||new AC();if(audioCtx.state==='suspended')audioCtx.resume();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.value=seconds<=5?880:660;gain.gain.setValueAtTime(.0001,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.08,audioCtx.currentTime+.01);gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.13);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+.14)}catch(e){}}
let audioCtx=null;
function playCongratulationsSound(){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ctx=window._winAudio||(window._winAudio=new AC());if(ctx.state==='suspended')ctx.resume();[523.25,659.25,783.99,1046.5,1318.51].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime+i*.09;o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.16,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.28);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.3)})}catch(e){}}
function playLossSound(){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ctx=window._lossAudio||(window._lossAudio=new AC());if(ctx.state==='suspended')ctx.resume();const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(330,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(180,ctx.currentTime+.35);g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.09,ctx.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.4);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.42)}catch(e){}}
function launchWinParticles(){const box=el('winParticles');if(!box)return;box.innerHTML='';['✨','🎉','⭐','💫','🪙','🎊'].forEach(()=>{});for(let i=0;i<34;i++){const p=document.createElement('span');p.className='win-particle';p.textContent=['✨','🎉','⭐','💫','🪙','🎊'][Math.floor(Math.random()*6)];p.style.left=(Math.random()*100)+'%';p.style.animationDelay=(Math.random()*.7)+'s';p.style.fontSize=(14+Math.random()*16)+'px';box.appendChild(p)}setTimeout(()=>box.innerHTML='',2600)}
function showWinPopup(resultText,reward){const o=el('winPopup');if(!o)return;if(el('winPopupResult'))el('winPopupResult').textContent=resultText;if(el('winPopupCoins'))el('winPopupCoins').textContent='🪙 +'+reward+' Virtual Coins';o.classList.add('show');o.setAttribute('aria-hidden','false');playCongratulationsSound();launchWinParticles()}
function closeWinPopup(){const o=el('winPopup');if(o)o.classList.remove('show')}
function showLossPopup(resultText,loss){const o=el('lossPopup');if(!o)return;if(el('lossPopupResult'))el('lossPopupResult').textContent=resultText;if(el('lossPopupCoins'))el('lossPopupCoins').textContent='🪙 -'+loss+' Virtual Coins';o.classList.add('show');o.setAttribute('aria-hidden','false');playLossSound()}
function closeLossPopup(){const o=el('lossPopup');if(o)o.classList.remove('show')}

function getManualDemoAmount(){return Number(localStorage.getItem('manualDemoAmount:'+uid())||0)}
function setManualDemoAmount(){const input=el('manualDemoAmount'),msg=el('manualAmountMsg'),amount=Number(input?.value||0);if(amount<1){if(msg)msg.textContent='Enter at least 1 virtual coin.';return}if(amount>coins()){if(msg)msg.textContent='Amount cannot exceed wallet.';return}localStorage.setItem('manualDemoAmount:'+uid(),String(amount));if(msg)msg.textContent='✓ Demo amount set: 🪙 '+amount}
function refreshManualDemoCoins(){if(el('manualAvailableCoins'))el('manualAvailableCoins').textContent=coins()}

window.addEventListener('storage',e=>{if([USERS,REQ,ACT,SUP,REF,ROUNDS].includes(e.key)||e.key?.startsWith(C+':')||e.key?.startsWith(T+':')||e.key===TEST){refresh();renderAdvancedHistory();renderTransactions();renderReferral();renderSupport();if(typeof adminRefresh==='function')adminRefresh()}});
setInterval(()=>{const u=ensureCurrentUser();if(u){if(u.status==='BLOCKED'){logout();return}updateUser({lastSeen:Date.now()});refresh();}},3000);

if(location.pathname.endsWith('app.html')){
  (async()=>{
    if(!getToken()){location.href='index.html';return}
    const u=await syncServerUser();
    if(!u){location.href='index.html';return}
    if(u.status==='BLOCKED'){logout();return}
    if(el('username'))el('username').textContent=u.name;
    if(el('dashUser'))el('dashUser').textContent=u.name;
    refresh();renderAdvancedHistory();renderTransactions();renderReferral();renderSupport();refreshProfilePremium();updatePeriodDisplay();
    const resumePage=u.last_page||u.lastPage||localStorage.getItem('fast07_last_page')||'dashboard';
    if(el(resumePage)) show(resumePage);
    setInterval(async()=>{
      const fresh=await syncServerUser();
      if(!fresh){location.href='index.html';return}
      refresh();renderTransactions();
    },5000);
  })();
}
