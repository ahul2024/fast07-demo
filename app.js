const U='demoUser',C='demoCoins',H='demoHistory',T='demoTx',P='demoPeriod';let selected='',bet=10,t=30,r=0,locked=false,iv,selectedNumber=null,selectedSize='',selectedColour='',mult=1;
const el=id=>document.getElementById(id),user=()=>JSON.parse(localStorage.getItem(U)||'null'),coins=()=>+localStorage.getItem(C)||1000;
function getUsers(){try{return JSON.parse(localStorage.getItem('demoUsers')||'[]')}catch(e){return[]}}
function saveUsers(v){localStorage.setItem('demoUsers',JSON.stringify(v))}
function getBalances(){try{return JSON.parse(localStorage.getItem('demoUserBalances')||'{}')}catch(e){return{}}}
function saveBalances(v){localStorage.setItem('demoUserBalances',JSON.stringify(v))}
function ensureUserRecord(u){
  let users=getUsers();let found=users.find(x=>x.id===u.id||x.mobile===u.mobile||x.email===u.email);
  if(!found){users.push(u);saveUsers(users)}
}
function signup(){
  const name=el('sName').value.trim(),mobile=el('sMobile').value.trim(),email=el('sEmail').value.trim(),pass=el('sPass').value,ref=el('sRef').value.trim();
  if(!name||!mobile||!email||!pass)return el('msg').textContent='Please fill all fields.';
  let users=getUsers();
  if(users.some(x=>x.mobile===mobile||x.email===email))return el('msg').textContent='Mobile or email already registered.';
  const referrer=ref?users.find(x=>x.ref===ref||x.refer===ref):null;
  const id='U'+Date.now().toString().slice(-8);
  const code='F7'+Math.random().toString(36).slice(2,8).toUpperCase();
  const u={id,name,mobile,email,pass,ref:code,referredBy:referrer?referrer.id:null,joined:new Date().toLocaleString()};
  users.push(u);saveUsers(users);
  let balances=getBalances();balances[id]=referrer?1200:1000;
  if(referrer)balances[referrer.id]=(Number(balances[referrer.id]||1000)+100);
  saveBalances(balances);
  if(referrer){
    let rr=[];try{rr=JSON.parse(localStorage.getItem('demoReferrals')||'[]')}catch(e){}
    rr.unshift({id:'R'+Date.now(),newUser:id,newUserName:name,referrer:referrer.id,referrerName:referrer.name,welcome:200,referrerBonus:100,time:new Date().toLocaleString()});
    localStorage.setItem('demoReferrals',JSON.stringify(rr));
  }
  localStorage.setItem(U,JSON.stringify(u));localStorage.setItem(C,String(balances[id]));
  localStorage.setItem(H,'[]');localStorage.setItem(T,'[]');localStorage.setItem(P,getPeriod());
  location.href='app.html';
}
function login(){
  let u=user(), id=el('lId').value.trim();
  let users=getUsers(), found=users.find(x=>x.email===id||x.mobile===id);
  if(found)u=found;
  if(!u||id!==u.email&&id!==u.mobile||el('lPass').value!==u.pass)return el('msg').textContent='Invalid login details.';
  localStorage.setItem(U,JSON.stringify(u));
  const b=getBalances();if(b[u.id]!=null)localStorage.setItem(C,String(b[u.id]));
  location.href='app.html';
}
function showLogin(){el('signup').classList.add('hidden');el('login').classList.remove('hidden')}function showSignup(){el('login').classList.add('hidden');el('signup').classList.remove('hidden')}function logout(){localStorage.removeItem(U);localStorage.removeItem(C);location.href='index.html'}
function setCoins(x){
  x=Math.max(0,Number(x)||0);
  localStorage.setItem(C,String(x));
  const u=user();
  if(u&&u.id){
    let b={};try{b=JSON.parse(localStorage.getItem('demoUserBalances')||'{}')}catch(e){}
    b[u.id]=x;localStorage.setItem('demoUserBalances',JSON.stringify(b));
  }
  refresh();
}
function updateProfileDetails(){
  const u=user()||{};
  const b=coins();
  if(el('profileName'))el('profileName').textContent=u.name||'User';
  if(el('profileFullName'))el('profileFullName').textContent=u.name||'Not added';
  if(el('profileId'))el('profileId').textContent=u.id||'U00001';
  if(el('profileIdCard'))el('profileIdCard').textContent=u.id||'U00001';
  if(el('profileMobile'))el('profileMobile').textContent=u.mobile||'Not added';
  if(el('profileEmail'))el('profileEmail').textContent=u.email||'Not added';
  if(el('profileCoins'))el('profileCoins').textContent=b;
  if(el('profileRefer'))el('profileRefer').textContent=u.ref||u.refer||'—';
  if(el('profileReferredBy'))el('profileReferredBy').textContent=u.referredBy||'Direct Registration';
  if(el('profileJoined'))el('profileJoined').textContent=u.joined||u.joinedAt||'—';
}


function renderTransactionHistory(){
  const u=user(); if(!u)return;
  let q=[];try{q=JSON.parse(localStorage.getItem('demoRequests')||'[]')}catch(e){q=[]}
  q=q.filter(x=>x.userId===u.id).sort((a,b)=>String(b.time||'').localeCompare(String(a.time||'')));
  const d=el('depositHistoryList'), w=el('withdrawHistoryList');
  const rows=(type)=>q.filter(x=>x.type===type).map(x=>{
    const status=x.status==='APPROVED'?'✓ Approved':x.status==='REJECTED'?'✕ Rejected':'⏳ Pending';
    const details=type==='DEPOSIT'?(x.upi||'UPI Deposit'):(x.bank||'Bank Withdrawal');
    return `<div class="history-item"><span>🪙 ${x.amount||0}</span><span>${details}</span><span>${status}</span><small>${x.time||''}</small></div>`;
  }).join('')||'<small>No transactions yet.</small>';
  if(d) d.innerHTML=rows('DEPOSIT');
  if(w) w.innerHTML=rows('WITHDRAWAL');
}

function refresh(){
  renderTransactionHistory();
  updateProfileDetails();let c=coins();refreshManualDemoCoins();if(document.getElementById('walletPremiumCoins'))document.getElementById('walletPremiumCoins').textContent=c;if(document.getElementById('walletActivityCoins'))document.getElementById('walletActivityCoins').textContent=c;if(el('dashCoins'))el('dashCoins').textContent=c;if(el('dashPeriod'))el('dashPeriod').textContent=typeof getPeriod==='function'?getPeriod():'--';if(el('coins'))el('coins').textContent=c;if(el('wcoins'))el('wcoins').textContent=c}
function show(id){document.querySelectorAll('section').forEach(x=>x.classList.add('hidden'));el(id).classList.remove('hidden');if(id==='game'){renderAdvancedHistory();startAdvanced();}if(id==='wallet')wallet();if(id==='ref'){let u=user();if(el('refcode'))el('refcode').textContent=u.ref||('F7'+u.mobile.slice(-6));}}
function pick(c,b){selected=c;document.querySelectorAll('.colors button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');el('gameMsg').textContent='Selected '+c}
function setBet(x){bet=x;el('bet').textContent=x}
function start(){clearInterval(iv);t=30;locked=false;el('timer').textContent=t;el('round').textContent=r;iv=setInterval(()=>{el('timer').textContent=--t;if(t<=0){clearInterval(iv);result()}},1000)}
function place(){if(locked)return;if(!selected)return el('gameMsg').textContent='Select a colour first.';if(coins()<bet)return el('gameMsg').textContent='Insufficient virtual coins.';setCoins(coins()-bet);logDemoActivity('BET', 'Bet placed: '+bet+' coins');locked=true;el('gameMsg').textContent='Prediction locked…'}
function result(){let res=['Red','Green','Blue'][Math.floor(Math.random()*3)],win=locked&&selected===res;if(win)setCoins(coins()+bet*2);let h=JSON.parse(localStorage.getItem(H)||'[]');h.unshift({r,p:selected||'None',res,b:bet,w:win});localStorage.setItem(H,JSON.stringify(h));el('gameMsg').textContent=locked?(win?'🎉 Result '+res+' — WIN':'🎲 Result '+res+' — LOSS'):'🎲 Result '+res;history();r++;setTimeout(()=>{if(!el('game').classList.contains('hidden'))start()},1500)}
function history(){
  if(typeof renderAdvancedHistory==='function') renderAdvancedHistory();
}

function deposit(){show('wallet');toggleWalletForm('depositForm')}
function withdraw(){show('wallet');toggleWalletForm('withdrawForm')}
function tx(type,a){let x=JSON.parse(localStorage.getItem(T)||'[]');x.unshift({type,a,d:new Date().toLocaleString()});localStorage.setItem(T,JSON.stringify(x));wallet()}
function wallet(){refresh();let x=JSON.parse(localStorage.getItem(T)||'[]');if(el('transactions'))el('transactions').innerHTML=x.length?x.map(q=>`<div class=\"tx\"><span>${q.type}<br><small>${q.d}</small></span><b>${q.a>0?'+':''}${q.a}</b></div>`).join(''):'<small>No transactions.</small>'}
if(location.pathname.endsWith('app.html')){let u=user();if(!u)location.href='index.html';else{el('username').textContent=u.name;if(el('dashUser'))el('dashUser').textContent=u.name;el('pname').textContent=u.name;el('pmobile').textContent=u.mobile;el('pemail').textContent=u.email;el('pref').textContent=u.ref;refresh();ensurePeriodHistory(getPeriod());history();renderAdvancedHistory();wallet()}}

let audioCtx=null;
function countdownBeep(seconds){
  try{
    audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
    osc.type='sine';
    osc.frequency.value=seconds<=5?880:660;
    gain.gain.setValueAtTime(0.0001,audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08,audioCtx.currentTime+0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+0.13);
    osc.connect(gain);gain.connect(audioCtx.destination);
    osc.start();osc.stop(audioCtx.currentTime+0.14);
  }catch(e){}
}

function pickColour(c,b){selectedColour=c;document.querySelectorAll('.colour').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');updateChoice()}
function pickNumber(n,b){selectedNumber=n;document.querySelectorAll('.number-grid button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');updateChoice()}
function pickSize(s,b){selectedSize=s;document.querySelectorAll('.bigsmall button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');updateChoice()}
function setMult(x,b){mult=x;document.querySelectorAll('.mult-row button').forEach(y=>y.classList.remove('active-mult'));b.classList.add('active-mult')}
function randomPick(){let adminTest=null;try{adminTest=JSON.parse(localStorage.getItem('adminTestResult')||'null')}catch(e){};let n=(adminTest&&adminTest.number!=='')?Number(adminTest.number):Math.floor(Math.random()*10);pickNumber(n,document.querySelectorAll('.number-grid button')[n])}
function updateChoice(){let a=[];if(selectedColour)a.push(selectedColour);if(selectedNumber!==null)a.push('Number '+selectedNumber);if(selectedSize)a.push(selectedSize);el('gameMsg').textContent=a.length?'Selected: '+a.join(' • '):'Choose a prediction.'}
function placeAdvanced(){
  if(locked)return;
  if(!selectedColour && selectedNumber===null && !selectedSize)return el('gameMsg').textContent='Choose a prediction first.';
  if(coins()<bet)return el('gameMsg').textContent='Insufficient virtual coins.';
  setCoins(coins()-bet);locked=true;
  el('gameMsg').textContent='Prediction locked for Period '+r+' • Waiting for result…';
}
function result(){
  // Resolve the round that just ended. The period is captured in r at round start.
  let adminTest=null;
  try{adminTest=JSON.parse(localStorage.getItem('adminTestResult')||'null')}catch(e){}

  let n=(adminTest && adminTest.number!=='' && adminTest.number!=null)
    ? Number(adminTest.number)
    : Math.floor(Math.random()*10);

  let resColour=(n===0||n===2||n===4||n===6||n===8)?'Red':'Green';
  if(n===5)resColour='Violet';
  if(adminTest && adminTest.colour)resColour=adminTest.colour;

  let size=n>=5?'Big':'Small';
  if(adminTest && adminTest.size)size=adminTest.size;

  const won=locked && (
    (selectedNumber!==null && selectedNumber===n) ||
    (selectedColour && selectedColour===resColour) ||
    (selectedSize && selectedSize===size)
  );

  if(won){
    const reward=bet*2*mult;
    setCoins(coins()+reward);
    setTimeout(()=>showWinPopup('🎉 You won on '+n+' • '+resColour+' • '+size+'!',reward),250);
  }else if(locked){
    setTimeout(()=>showLossPopup('😔 '+n+' • '+resColour+' • '+size,bet),250);
  }

  // IMPORTANT: update the already-created period record instead of creating
  // history only when a bet exists.
  let h=[];
  try{h=JSON.parse(localStorage.getItem(H)||'[]')}catch(e){h=[]}
  const period=String(r);
  let row=h.find(x=>String(x.r)===period);
  if(!row){
    row={r:period,p:'None',res:'--',colour:'--',size:'--',bet:0,w:false,status:'LIVE'};
    h.unshift(row);
  }
  row.p=selectedNumber!==null?selectedNumber:(selectedColour||selectedSize||'None');
  row.res=n;
  row.colour=resColour;
  row.size=size;
  row.bet=locked?bet:0;
  row.w=!!won;
  row.status='RESULT';
  row.time=new Date().toLocaleString();
  localStorage.setItem(H,JSON.stringify(h));

  el('gameMsg').textContent=locked
    ?(won?'🎉 Result '+n+' • '+resColour+' • '+size+' — WIN':'🎲 Result '+n+' • '+resColour+' • '+size+' — LOSS')
    :'🎲 Result '+n+' • '+resColour+' • '+size;

  renderAdvancedHistory();
  history();
  refresh();

  selectedNumber=null;selectedColour='';selectedSize='';locked=false;
  setTimeout(()=>{if(!el('game').classList.contains('hidden'))startAdvanced()},1500);
}

function getPeriod(){
  // Global-style monotonically increasing demo period number.
  // Each 30-second round gets the next number and it is never reset by history.
  const base=1000000000;
  const round=Math.floor(Date.now()/30000);
  return String(base+round);
}
function nextPeriod(){
  const p=getPeriod();
  localStorage.setItem(P,p);
  return p;
}
r=getPeriod();
function ensurePeriodHistory(period){
  const p=String(period);
  let h=[];
  try{h=JSON.parse(localStorage.getItem(H)||'[]')}catch(e){h=[]}
  if(!h.some(x=>String(x.r)===p)){
    h.unshift({
      r:p,
      p:'None',
      res:'--',
      colour:'--',
      size:'--',
      bet:0,
      w:false,
      status:'LIVE',
      time:new Date().toLocaleString()
    });
    localStorage.setItem(H,JSON.stringify(h));
  }
}

function startAdvanced(){
  r=getPeriod();
  ensurePeriodHistory(r);

  clearInterval(iv);
  t=30;locked=false;selectedNumber=null;selectedColour='';selectedSize='';
  if(el('timer'))el('timer').textContent='00:30';
  if(el('period'))el('period').textContent=r;

  document.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'));

  iv=setInterval(()=>{
    t--;
    if(el('timer'))el('timer').textContent='00:'+(t<10?'0':'')+t;
    if(t===8)countdownBeep(8);
    if(t<=0){
      clearInterval(iv);
      countdownBeep(0);
      result();
    }
  },1000);
}

function renderAdvancedHistory(){
  let h=[];
  try{h=JSON.parse(localStorage.getItem(H)||'[]')}catch(e){h=[]}
  const e=el('history');
  if(!e)return;
  e.innerHTML=h.length ? h.map(x=>{
    const live=x.status==='LIVE' || x.res==='--';
    const period=x.r||'--';
    const result=live?'--':x.res;
    const colour=live?'--':(x.colour||'--');
    const size=live?'--':(x.size||'--');
    const betNumber=(x.p!==undefined && x.p!==null && x.p!=='None')?x.p:'No Bet';
    const amount=Number(x.bet||x.b||0);
    const outcome=live?'LIVE':(x.w?'WIN':'LOSS');
    return `<div class="history-item"><span>#${period}</span><span>${betNumber}</span><span>${size}</span><span>${colour}</span><span>${result}</span><span>${amount?('🪙 '+amount):'No Bet'}</span><b>${outcome}</b></div>`;
  }).join('') : '<small>No rounds yet.</small>';
  if(el('recent')){
    el('recent').innerHTML=h.slice(0,10).map(x=>
      `<div class="history-item"><span>#${x.r||'--'}</span><span>${x.res==='--'?'--':x.res}</span><span>${x.colour||'--'}</span><span>${x.p||'No Bet'}</span></div>`
    ).join('') || '<small>No rounds yet.</small>';
  }
}

function playCongratulationsSound(){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    const ctx=window._winAudio||(window._winAudio=new AC());
    if(ctx.state==='suspended')ctx.resume();
    const notes=[523.25,659.25,783.99,1046.5,1318.51];
    notes.forEach((freq,i)=>{
      const osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.type='triangle'; osc.frequency.value=freq;
      const t=ctx.currentTime+i*.09;
      gain.gain.setValueAtTime(.0001,t);
      gain.gain.exponentialRampToValueAtTime(.16,t+.02);
      gain.gain.exponentialRampToValueAtTime(.0001,t+.28);
      osc.connect(gain);gain.connect(ctx.destination);
      osc.start(t);osc.stop(t+.3);
    });
  }catch(e){}
}
function launchWinParticles(){
  const box=document.getElementById('winParticles'); if(!box)return;
  box.innerHTML='';
  const symbols=['✨','🎉','⭐','💫','🪙','🎊'];
  for(let i=0;i<34;i++){
    const p=document.createElement('span');p.className='win-particle';
    p.textContent=symbols[Math.floor(Math.random()*symbols.length)];
    p.style.left=(Math.random()*100)+'%';
    p.style.animationDelay=(Math.random()*.7)+'s';
    p.style.fontSize=(14+Math.random()*16)+'px';
    box.appendChild(p);
  }
  setTimeout(()=>box.innerHTML='',2600);
}


function playLossSound(){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    const ctx=window._lossAudio||(window._lossAudio=new AC());
    if(ctx.state==='suspended')ctx.resume();
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(330,ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180,ctx.currentTime+.35);
    gain.gain.setValueAtTime(.0001,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.09,ctx.currentTime+.02);
    gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.4);
    osc.connect(gain);gain.connect(ctx.destination);
    osc.start();osc.stop(ctx.currentTime+.42);
  }catch(e){}
}
function showLossPopup(resultText, loss){
  const overlay=document.getElementById('lossPopup');
  if(!overlay)return;
  const r=document.getElementById('lossPopupResult');
  const c=document.getElementById('lossPopupCoins');
  if(r)r.textContent=resultText||'Try again in the next demo round.';
  if(c)c.textContent='🪙 -'+loss+' Virtual Coins';
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden','false');
  playLossSound();
}
function closeLossPopup(){
  const overlay=document.getElementById('lossPopup');
  if(overlay){overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true')}
}

function showWinPopup(resultText, reward){
  const overlay=document.getElementById('winPopup');
  if(!overlay)return;
  const r=document.getElementById('winPopupResult');
  const c=document.getElementById('winPopupCoins');
  if(r)r.textContent=resultText||'🎯 Great prediction!';
  if(c)c.textContent='🪙 +'+reward+' Virtual Coins';
  overlay.classList.add('show');playCongratulationsSound();launchWinParticles();
  overlay.setAttribute('aria-hidden','false');
}
function closeWinPopup(){
  const overlay=document.getElementById('winPopup');
  if(overlay){overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true')}
}

function refreshProfilePremium(){
  try{
    const u=JSON.parse(localStorage.getItem('demoUser')||'{}');
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set('profileName',u.name||'User');
    set('profileMobile',u.mobile||'Not added');
    set('profileRefer',u.refer||u.ref||'—');
    set('profileCoins',localStorage.getItem('demoCoins')||u.coins||0);
    set('profileId',u.id||'U00001');
  }catch(e){}
}
document.addEventListener('DOMContentLoaded',refreshProfilePremium);

function updatePeriodDisplay(){
  const p=getPeriod();
  ['period','gamePeriod','dashPeriod'].forEach(id=>{
    const e=document.getElementById(id);
    if(e)e.textContent=p;
  });
}
setInterval(updatePeriodDisplay,1000);
document.addEventListener('DOMContentLoaded',updatePeriodDisplay);

function getManualDemoAmount(){
  const v=parseInt(localStorage.getItem('manualDemoAmount')||'0',10);
  return Number.isFinite(v)&&v>0?v:0;
}
function setManualDemoAmount(){
  const input=document.getElementById('manualDemoAmount');
  const msg=document.getElementById('manualAmountMsg');
  const available=parseInt(localStorage.getItem('demoCoins')||'0',10)||0;
  const amount=parseInt(input&&input.value||'0',10)||0;
  if(amount<1){if(msg)msg.textContent='Enter at least 1 virtual coin.';return false}
  if(amount>available){if(msg)msg.textContent='Amount cannot exceed your available virtual coins.';return false}
  localStorage.setItem('manualDemoAmount',String(amount));
  if(msg){msg.style.color='#39d36b';msg.textContent='✓ Demo amount set: 🪙 '+amount}
  return true;
}
function refreshManualDemoCoins(){
  const e=document.getElementById('manualAvailableCoins');
  if(e)e.textContent=localStorage.getItem('demoCoins')||'0';
  const input=document.getElementById('manualDemoAmount');
  const saved=getManualDemoAmount();
  if(input && saved)input.value=saved;
}
document.addEventListener('DOMContentLoaded',refreshManualDemoCoins);


function syncBalance(){
  const u=user();if(u&&u.id){let b=getBalances();b[u.id]=coins();saveBalances(b)}
}
const oldSetCoins=setCoins;
setCoins=function(x){oldSetCoins(x);syncBalance();};

function copyRef(){
  const u=user(),c=u.ref||('F7'+u.mobile.slice(-6)),m=el('refMsg');
  if(navigator.clipboard){navigator.clipboard.writeText(c).then(()=>{if(m)m.textContent='✓ Referral code copied: '+c}).catch(()=>{if(m)m.textContent='Your code: '+c})}
  else if(m)m.textContent='Your referral code: '+c;
}
function toggleWalletForm(id){['depositForm','withdrawForm'].forEach(x=>{if(el(x))el(x).classList.toggle('hidden',x!==id)})}
function getRequests(){try{return JSON.parse(localStorage.getItem('demoRequests')||'[]')}catch(e){return[]}}
function saveRequests(v){localStorage.setItem('demoRequests',JSON.stringify(v))}
function submitDepositRequest(){
  const u=user(),upi=(el('depositUpi')?.value||'').trim(),amount=parseInt(el('depositAmount')?.value||'0',10)||0;
  if(!upi||amount<1)return el('depositMsg').textContent='Enter Demo UPI ID and valid virtual coins.';
  let q=getRequests();q.unshift({id:'D'+Date.now()+Math.random().toString(36).slice(2,5),type:'DEPOSIT',userId:u.id,userName:u.name,userMobile:u.mobile||'',amount,upi,status:'PENDING',time:new Date().toLocaleString()});saveRequests(q);
  logDemoActivity('DEPOSIT REQUEST','Deposit request submitted: '+amount+' coins');
  el('depositMsg').textContent='✓ Deposit request sent to Admin. Coins will be credited after approval.';
}
function submitWithdrawalRequest(){
  const u=user(),amount=parseInt(el('withdrawAmount')?.value||'0',10)||0;
  if(amount<1||amount>coins())return el('withdrawMsg').textContent='Enter a valid amount within your virtual balance.';
  const bank=(el('bankName')?.value||'').trim(),acct=(el('bankAccount')?.value||'').trim(),ifsc=(el('bankIfsc')?.value||'').trim(),upi=(el('withdrawUpi')?.value||'').trim();
  if(!bank||!acct||!ifsc)return el('withdrawMsg').textContent='Enter Bank Name, Account Number and IFSC.';

  // Reserve/deduct virtual coins immediately when the withdrawal request is created.
  // If Admin rejects the request, the amount is automatically refunded.
  const before=coins();
  setCoins(before-amount);
  const request={
    id:'W'+Date.now()+Math.random().toString(36).slice(2,5),
    type:'WITHDRAWAL',userId:u.id,userName:u.name,userMobile:u.mobile||'',
    amount,bank,account:acct,ifsc,upi,status:'PENDING',
    balanceBefore:before,balanceAfter:before-amount,
    time:new Date().toLocaleString()
  };
  let q=getRequests();q.unshift(request);saveRequests(q);
  logDemoActivity('WITHDRAWAL REQUEST','Withdrawal request submitted: '+amount+' coins');
  localStorage.setItem('demoBalanceSync',JSON.stringify({
    userId:u.id,balance:before-amount,requestId:request.id,status:'PENDING',
    type:'WITHDRAWAL',amount,at:Date.now()
  }));
  el('withdrawMsg').textContent='✓ Withdrawal request sent to Admin. 🪙 '+amount+' coins reserved/deducted from wallet.';
}
function sendSupportRequest(){
  logDemoActivity('SUPPORT','Support request submitted');
  const u=user(),subject=(el('supportSubject')?.value||'').trim(),message=(el('supportMessage')?.value||'').trim();
  if(!subject||!message)return el('supportMsg').textContent='Enter subject and message.';
  let q=[];try{q=JSON.parse(localStorage.getItem('demoSupport')||'[]')}catch(e){}
  q.unshift({id:'S'+Date.now(),userId:u.id,userName:u.name,subject,message,status:'OPEN',time:new Date().toLocaleString()});
  localStorage.setItem('demoSupport',JSON.stringify(q));el('supportMsg').textContent='✓ Support request sent to Admin.';
}


function logDemoActivity(action, details){
  try{
    const u=user()||{};
    let a=JSON.parse(localStorage.getItem('demoLiveActivity')||'[]');
    a.unshift({
      id:'A'+Date.now()+Math.random().toString(36).slice(2,5),
      userId:u.id||'—', userName:u.name||'—',
      action:String(action), details:String(details||''),
      coins:coins(), time:new Date().toLocaleString()
    });
    localStorage.setItem('demoLiveActivity',JSON.stringify(a.slice(0,500)));
  }catch(e){}
}

function syncAdminBalance(){
  const raw=localStorage.getItem('demoBalanceSync');if(!raw)return;
  try{
    const s=JSON.parse(raw),u=user();
    if(u&&s.userId===u.id){
      setCoins(Number(s.balance||0));
      const msg=s.type==='DEPOSIT'?'✓ Deposit approved — coins credited.':'✓ Withdrawal approved — coins deducted.';
      const target=s.type==='DEPOSIT'?el('depositMsg'):el('withdrawMsg');
      if(target)target.textContent=msg;
    }
  }catch(e){}
}
window.addEventListener('storage',function(e){
  if(['demoUserBalances','demoRequests','demoBalanceSync'].includes(e.key)) syncAdminBalance();
});
setInterval(syncAdminBalance,1000);
