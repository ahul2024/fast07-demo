/* FERARI 007 - Virtual Demo build. No real-money payments. */
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
  if(!a[i].coins)a[i].coins=Number(localStorage.getItem(C)||1000);
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

function signup(){
  const name=el('sName').value.trim(),mobile=el('sMobile').value.trim(),email=el('sEmail').value.trim().toLowerCase(),pass=el('sPass').value,refCode=el('sRef').value.trim().toUpperCase();
  if(!name||!mobile||!email||!pass)return el('msg').textContent='Please fill all fields.';
  let users=allUsers();
  if(users.some(x=>x.email===email||x.mobile===mobile))return el('msg').textContent='Email or mobile is already registered.';
  const id='U'+Date.now().toString().slice(-8);
  const myRef='REF-'+mobile.replace(/\D/g,'').slice(-6);
  const referrer=users.find(x=>x.refCode===refCode);
  const welcome=250; // Fixed virtual/demo registration bonus
  const u={id,name,mobile,email,pass,refCode:myRef,referredBy:referrer?referrer.id:'',joined:now(),status:'ACTIVE',coins:welcome,referralEarned:0,lastSeen:Date.now()};
  users.push(u);saveUsers(users);localStorage.setItem(U,JSON.stringify(u));localStorage.setItem(key(C),String(welcome));
  localStorage.setItem(key(H),'[]');localStorage.setItem(key(T),'[]');
  if(referrer){const ri=users.findIndex(x=>x.id===referrer.id);users[ri].coins=Number(users[ri].coins||0)+100;users[ri].referralEarned=Number(users[ri].referralEarned||0)+100;saveUsers(users);localStorage.setItem(C+':'+referrer.id,String(users[ri].coins));let rr=safeJSON(REF,[]);rr.unshift({referrerId:referrer.id,referrerName:referrer.name,newUserId:id,newUserName:name,bonus:100,time:now()});localStorage.setItem(REF,JSON.stringify(rr));}
  addActivity('REGISTER','New demo account created',welcome);location.href='app.html';
}
function login(){
  const id=el('lId').value.trim().toLowerCase(),pass=el('lPass').value;const u=allUsers().find(x=>(x.email===id||x.mobile===id)&&x.pass===pass);
  if(!u)return el('msg').textContent='Invalid login details.';
  if(u.status==='BLOCKED')return el('msg').textContent='This demo account is blocked by Admin.';
  localStorage.setItem(U,JSON.stringify(u));localStorage.setItem(key(C),String(u.coins||1000));updateUser({lastSeen:Date.now()});addActivity('LOGIN','User logged in');location.href='app.html';
}
function showLogin(){el('signup').classList.add('hidden');el('login').classList.remove('hidden')}
function showSignup(){el('login').classList.add('hidden');el('signup').classList.remove('hidden')}
function logout(){localStorage.removeItem(U);location.href='index.html'}

function refresh(){const c=coins();refreshManualDemoCoins();['walletPremiumCoins','walletActivityCoins','dashCoins','coins','profileCoins'].forEach(id=>{if(el(id))el(id).textContent=c});if(el('dashUser'))el('dashUser').textContent=user()?.name||'User';if(el('dashPeriod'))el('dashPeriod').textContent=getPeriod();updatePeriodDisplay();if(el('profileName'))refreshProfilePremium()}
function show(id){document.querySelectorAll('section').forEach(x=>x.classList.add('hidden'));const s=el(id);if(s)s.classList.remove('hidden');if(id==='game'){renderAdvancedHistory();startAdvanced()}if(id==='wallet'){wallet();renderTransactions()}if(id==='ref'){renderReferral()}if(id==='profile'){refreshProfilePremium()}if(id==='support'){renderSupport()}}

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
function updatePeriodDisplay(){const p=getPeriod();['period','gamePeriod','dashPeriod'].forEach(id=>{if(el(id))el(id).textContent=p})}
function getRoundResults(){return safeJSON(ROUNDS,{})}
function getRoundResult(period){let all=getRoundResults();if(all[period])return all[period];let test=safeJSON(TEST,null);let useTest=test&&test.period===period;let n=useTest&&test.number!==''?Number(test.number):Math.floor(Math.random()*10);let colour=useTest&&test.colour?test.colour:(n===5?'Violet':(n%2===0?'Red':'Green'));let size=n>=5?'Big':'Small';let out={period,number:n,colour,size,adminTest:!!useTest,time:now()};all[period]=out;localStorage.setItem(ROUNDS,JSON.stringify(all));return out}
function startAdvanced(){clearInterval(iv);currentPeriod=getPeriod();t=30;locked=false;selectedNumber=null;selectedColour='';selectedSize='';if(el('timer'))el('timer').textContent='00:30';if(el('period'))el('period').textContent=currentPeriod;document.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'));recordLiveRound(currentPeriod);iv=setInterval(()=>{t--;if(el('timer'))el('timer').textContent='00:'+(t<10?'0':'')+t;if(t<=8&&t>0)countdownBeep(t);if(t<=0){clearInterval(iv);finishRound(currentPeriod)}},1000)}
function recordLiveRound(period){let h=safeJSON(key(H),[]);if(!h.some(x=>x.period===period)){h.unshift({period,status:'LIVE',number:'--',colour:'--',size:'--',bet:0,betChoice:'No Bet',win:false,time:now()});localStorage.setItem(key(H),JSON.stringify(h));}renderAdvancedHistory()}
function placeAdvanced(){if(locked)return;if(!selectedColour&&selectedNumber===null&&!selectedSize)return el('gameMsg').textContent='Choose a prediction first.';if(coins()<bet)return el('gameMsg').textContent='Insufficient virtual coins.';setCoins(coins()-bet);locked=true;let h=safeJSON(key(H),[]),row=h.find(x=>x.period===currentPeriod);if(row){row.bet=bet;row.betChoice=selectedNumber!==null?'Number '+selectedNumber:(selectedColour||selectedSize);row.mult=mult;row.status='BET PLACED';localStorage.setItem(key(H),JSON.stringify(h))}addActivity('BET','Period '+currentPeriod+' • '+(selectedNumber!==null?'Number '+selectedNumber:selectedColour||selectedSize)+' • '+bet+' coins',bet);el('gameMsg').textContent='Prediction locked for Period '+currentPeriod+' • Waiting for result…';renderAdvancedHistory()}
function finishRound(period){const result=getRoundResult(period),h=safeJSON(key(H),[]),row=h.find(x=>x.period===period)||{period};const win=!!locked&&((selectedNumber!==null&&selectedNumber===result.number)||(selectedColour&&selectedColour===result.colour)||(selectedSize&&selectedSize===result.size));row.number=result.number;row.colour=result.colour;row.size=result.size;row.status=locked?(win?'WIN':'LOSS'):'NO BET';row.win=win;row.resultTime=now();if(locked&&win){const reward=bet*2*mult;setCoins(coins()+reward);row.reward=reward;showWinPopup('🎉 '+result.number+' • '+result.colour+' • '+result.size,reward);addActivity('WIN','Period '+period+' • Result '+result.number+' '+result.colour+' '+result.size,reward)}else if(locked){row.reward=0;showLossPopup('😔 '+result.number+' • '+result.colour+' • '+result.size,bet);addActivity('LOSS','Period '+period+' • Result '+result.number+' '+result.colour+' '+result.size,-bet)}
  localStorage.setItem(key(H),JSON.stringify(h));renderAdvancedHistory();refresh();selectedNumber=null;selectedColour='';selectedSize='';if(!el('game')?.classList.contains('hidden'))setTimeout(startAdvanced,1200)}
function renderAdvancedHistory(){let h=safeJSON(key(H),[]),e=el('history');if(!e)return;e.innerHTML=h.length?h.map(x=>`<div class="history-item"><span>#${esc(x.period||x.r)}</span><span>${esc(x.betChoice||'No Bet')}</span><span>${esc(x.size||'--')}</span><span>${esc(x.colour||'--')}</span><span>${esc(x.number??'--')}</span><span>🪙 ${esc(x.bet||0)}</span><b class="status-${String(x.status||'').toLowerCase().replace(/\s/g,'-')}">${esc(x.status||'--')}</b></div>`).join(''):'<small>No rounds yet.</small>';if(el('recent'))el('recent').innerHTML=h.slice(0,8).map(x=>`<div class="history-item"><span>#${esc(x.period||'--')}</span><span>${esc(x.number??'--')}</span><span>${esc(x.colour||'--')}</span><b>${esc(x.status||'LIVE')}</b></div>`).join('')||'<small>No rounds yet.</small>'}

function addTx(type,amount,status='PENDING',meta={}){let x=safeJSON(key(T),[]);x.unshift({id:'TX'+Date.now()+Math.random().toString(36).slice(2,5),type,amount,status,time:now(),...meta});localStorage.setItem(key(T),JSON.stringify(x));}
function updateTxForRequest(requestId,status,amount){let x=safeJSON(key(T),[]),i=x.findIndex(q=>q.requestId===requestId);if(i>=0){x[i].status=status;if(amount!==undefined)x[i].amount=amount;x[i].updatedAt=now();localStorage.setItem(key(T),JSON.stringify(x));}return i>=0}
function requests(){return safeJSON(REQ,[])}function saveRequests(a){localStorage.setItem(REQ,JSON.stringify(a))}
function submitDeposit(){const amount=Number(el('depositAmount')?.value||0),ref=el('depositRef')?.value.trim()||'Demo reference';if(amount<1)return el('depositMsg').textContent='Enter a valid virtual coin amount.';let q=requests();const request={id:'D'+Date.now()+Math.random().toString(36).slice(2,5),type:'DEPOSIT',userId:uid(),userName:user().name,amount,reference:ref,status:'PENDING',time:now()};q.unshift(request);saveRequests(q);addTx('Deposit',amount,'PENDING',{reference:ref,requestId:request.id});addActivity('DEPOSIT REQUEST','Requested '+amount+' virtual coins');el('depositMsg').textContent='✓ Deposit request sent to Admin. Waiting for approval.';el('depositAmount').value='';renderTransactions()}
function submitWithdrawal(){const amount=Number(el('withdrawAmount')?.value||0),bank=el('bankName')?.value.trim(),account=el('bankAccount')?.value.trim(),ifsc=el('bankIfsc')?.value.trim();if(amount<1)return el('withdrawMsg').textContent='Enter a valid virtual coin amount.';if(amount>coins())return el('withdrawMsg').textContent='Insufficient virtual coins.';if(!bank||!account||!ifsc)return el('withdrawMsg').textContent='Enter demo bank name, account and IFSC.';let q=requests();const request={id:'W'+Date.now()+Math.random().toString(36).slice(2,5),type:'WITHDRAWAL',userId:uid(),userName:user().name,amount,bank,account,ifsc,status:'PENDING',time:now()};q.unshift(request);saveRequests(q);addTx('Withdrawal',-amount,'PENDING',{bank,account,ifsc,requestId:request.id});addActivity('WITHDRAWAL REQUEST','Requested '+amount+' virtual coins');el('withdrawMsg').textContent='✓ Withdrawal request sent to Admin. No coins deducted until Admin approval.';renderTransactions()}
function renderTransactions(){const x=safeJSON(key(T),[]),d=el('depositHistoryList'),w=el('withdrawHistoryList'),fmt=q=>`<div class="history-item"><span>🪙 ${esc(Math.abs(q.amount||0))}</span><span>${esc(q.type)}</span><span>${esc(q.status)}</span><small>${esc(q.time)}</small></div>`;if(d)d.innerHTML=x.filter(q=>q.type==='Deposit').map(fmt).join('')||'<small>No deposit history.</small>';if(w)w.innerHTML=x.filter(q=>q.type==='Withdrawal').map(fmt).join('')||'<small>No withdrawal history.</small>';if(el('transactions'))el('transactions').innerHTML=x.map(fmt).join('')||'<small>No transactions.</small>'}
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

if(location.pathname.endsWith('app.html')){const u=ensureCurrentUser()||user();if(!u){location.href='index.html'}else{if(u.status==='BLOCKED'){logout()}else{el('username').textContent=u.name;if(el('dashUser'))el('dashUser').textContent=u.name;refresh();renderAdvancedHistory();renderTransactions();renderReferral();renderSupport();refreshProfilePremium();updatePeriodDisplay();}}}
