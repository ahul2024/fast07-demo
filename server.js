require('dotenv').config();
const express=require('express');
const cors=require('cors');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const {Pool}=require('pg');
const path=require('path');
const fs=require('fs');
const crypto=require('crypto');
const crypto=require('crypto');
const app=express();
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:false}:false});
app.use(cors({origin:process.env.CORS_ORIGIN||true}));
app.use(express.json({limit:'1mb'}));
app.use(express.static(__dirname));
const q=(text,params=[])=>pool.query(text,params);
function token(u){return jwt.sign({id:u.id,role:u.role||'USER'},process.env.JWT_SECRET,{expiresIn:'7d'})}
async function auth(req,res,next){try{const h=req.headers.authorization||'';if(!h.startsWith('Bearer '))return res.status(401).json({error:'Authentication required'});const p=jwt.verify(h.slice(7),process.env.JWT_SECRET);if(p.role==='ADMIN'&&p.id==='ADMIN'){req.user={id:'ADMIN',role:'ADMIN',name:'Administrator'};return next()}const r=await q('SELECT id,role,name,mobile,email,status,coins,referral_code,created_at,last_seen,last_page FROM users WHERE id=$1',[p.id]);if(!r.rows[0])return res.status(401).json({error:'User not found'});req.user=r.rows[0];next()}catch(e){res.status(401).json({error:'Invalid or expired token'})}}
function admin(req,res,next){if(req.user?.role==='ADMIN')return next();res.status(403).json({error:'Admin only'})}
app.post('/api/admin/login',async(req,res)=>{try{const {identifier,password}=req.body;const adminId=process.env.ADMIN_ID||'admin';const adminPassword=process.env.ADMIN_PASSWORD||'Admin@12345';if(identifier!==adminId||password!==adminPassword)return res.status(401).json({error:'Invalid admin credentials'});const u={id:'ADMIN',role:'ADMIN',name:'Administrator'};res.json({user:u})}catch(e){res.status(500).json({error:'Admin login failed'})}})
app.get('/api/health',async(_,res)=>{try{await q('SELECT 1');res.json({ok:true,service:'FAST07 demo API'})}catch(e){res.status(503).json({ok:false,error:'Database unavailable'})}});
app.post('/api/auth/signup',async(req,res)=>{try{const {name,mobile,email,password,referralCode=''}=req.body;if(!name||!mobile||!email||!password)return res.status(400).json({error:'Missing required fields'});const ex=await q('SELECT id FROM users WHERE email=$1 OR mobile=$2',[email.toLowerCase(),mobile]);if(ex.rows[0])return res.status(409).json({error:'Email or mobile already registered'});let ref=null;if(referralCode)ref=(await q('SELECT id FROM users WHERE referral_code=$1',[referralCode.toUpperCase()])).rows[0];const hash=await bcrypt.hash(password,12);const code='REF-'+crypto.randomBytes(4).toString('hex').toUpperCase();const r=await q('INSERT INTO users(name,mobile,email,password_hash,referral_code,referred_by,coins) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,mobile,email,status,coins,referral_code,created_at,last_seen,last_page',[name,mobile,email.toLowerCase(),hash,code,ref?.id||null,ref?1200:1000]);const u=r.rows[0];if(ref){await q('UPDATE users SET coins=coins+100 WHERE id=$1',[ref.id]);await q("INSERT INTO transactions(user_id,type,amount,status,meta) VALUES($1,'REFERRAL',100,'APPROVED',$2)",[ref.id,JSON.stringify({newUserId:u.id})])}await q("INSERT INTO activities(user_id,action,details,coins) VALUES($1,'REGISTER','New demo account created',$2)",[u.id,u.coins]);res.json({token:token(u),user:u})}catch(e){console.error(e);res.status(500).json({error:'Signup failed'})}});
app.post('/api/auth/login',async(req,res)=>{try{const {identifier,password}=req.body;const r=await q('SELECT * FROM users WHERE email=$1 OR mobile=$1',[String(identifier||'').toLowerCase()]);const u=r.rows[0];if(!u||!(await bcrypt.compare(password||'',u.password_hash)))return res.status(401).json({error:'Invalid login details'});if(u.status==='BLOCKED')return res.status(403).json({error:'Account blocked'});await q('UPDATE users SET last_seen=NOW() WHERE id=$1',[u.id]);await q("INSERT INTO activities(user_id,action,details,coins) VALUES($1,'LOGIN','User logged in',$2)",[u.id,u.coins]);res.json({token:token(u),user:{id:u.id,name:u.name,mobile:u.mobile,email:u.email,status:u.status,coins:u.coins,referralCode:u.referral_code,lastPage:u.last_page||'dashboard'}})}catch(e){res.status(500).json({error:'Login failed'})}});
app.get('/api/me',auth,async(req,res)=>{res.json({user:req.user})});
app.patch('/api/me/state',auth,async(req,res)=>{try{const allowed=['dashboard','game','wallet','ref','profile','support'];const page=String(req.body.page||'dashboard');if(!allowed.includes(page))return res.status(400).json({error:'Invalid page'});const r=await q('UPDATE users SET last_page=$1,last_seen=NOW() WHERE id=$2 RETURNING id,last_page,last_seen',[page,req.user.id]);res.json({ok:true,state:r.rows[0]})}catch(e){res.status(500).json({error:'Could not save session state'})}});

function currentPeriod(){return String(1000000000+Math.floor(Date.now()/30000))}
function resultForNumber(n){return {number:n,colour:n===5?'Violet':(n%2===0?'Red':'Green'),size:n>=5?'Big':'Small'}}
async function ensureRound(period){
  const found=await q('SELECT * FROM rounds WHERE period=$1',[period]);
  if(found.rows[0]) return found.rows[0];
  const n=Math.floor(Math.random()*10), r=resultForNumber(n);
  const created=await q("INSERT INTO rounds(period,number,colour,size,source) VALUES($1,$2,$3,$4,'AUTO') ON CONFLICT(period) DO UPDATE SET period=EXCLUDED.period RETURNING *",[period,n,r.colour,r.size]);
  return created.rows[0] || (await q('SELECT * FROM rounds WHERE period=$1',[period])).rows[0];
}
app.get('/api/game/round/:period',auth,async(req,res)=>{try{const r=await ensureRound(String(req.params.period));res.json({round:r})}catch(e){res.status(500).json({error:'Could not load game round'})}});
app.get('/api/game/history',auth,async(req,res)=>{
  try{
    const limit=Math.min(Math.max(Number(req.query.limit)||5000,1),5000);
    const current=Number(currentPeriod());
    await ensureRound(String(current));
    const r=await q(`SELECT r.period,
      CASE WHEN r.period=$2 THEN NULL ELSE r.number END AS number,
      CASE WHEN r.period=$2 THEN NULL ELSE r.colour END AS colour,
      CASE WHEN r.period=$2 THEN NULL ELSE r.size END AS size,
      r.created_at,
      b.id bet_id,b.amount bet_amount,b.choice bet_choice,b.result bet_result,b.outcome bet_outcome
      FROM rounds r LEFT JOIN bets b ON b.period=r.period AND b.user_id=$1
      WHERE r.period <= $2 ORDER BY r.period DESC LIMIT $3`,[req.user.id,String(current),limit]);
    res.json({currentPeriod:String(current),history:r.rows});
  }catch(e){console.error(e);res.status(500).json({error:'Could not load game history'})}
});
app.post('/api/game/bet',auth,async(req,res)=>{
  try{
    const period=String(req.body.period||currentPeriod());
    if(period!==currentPeriod()) return res.status(400).json({error:'Betting period is closed'});
    const amount=Number(req.body.amount),choice=String(req.body.choice||'').trim();
    if(!Number.isInteger(amount)||amount<1||!choice)return res.status(400).json({error:'Invalid bet'});
    const round=await ensureRound(period);
    const r=await q("INSERT INTO bets(user_id,period,amount,choice,outcome) VALUES($1,$2,$3,$4,'PENDING') ON CONFLICT(user_id,period) DO UPDATE SET amount=EXCLUDED.amount,choice=EXCLUDED.choice,outcome='PENDING' RETURNING *",[req.user.id,period,amount,choice]);
    await q("INSERT INTO transactions(user_id,type,amount,status,meta) VALUES($1,'BET',$2,'APPROVED',$3)",[req.user.id,-amount,JSON.stringify({period,betId:r.rows[0].id})]);
    res.json({bet:r.rows[0],round:{period:round.period}});
  }catch(e){console.error(e);res.status(500).json({error:'Could not save bet'})}
});
app.post('/api/game/settle',auth,async(req,res)=>{
  try{
    const period=String(req.body.period||'');
    if(!period)return res.status(400).json({error:'Missing period'});
    const round=await ensureRound(period);
    const r=await q('SELECT * FROM bets WHERE user_id=$1 AND period=$2 ORDER BY id DESC LIMIT 1',[req.user.id,period]);
    if(!r.rows[0])return res.json({ok:true,round,bet:null});
    const b=r.rows[0];
    const choice=b.choice;
    const win=choice===String(round.number)||choice===round.number.toString()||choice===round.colour||choice===round.size;
    const outcome=win?'WIN':'LOSS';
    const u=await q('UPDATE bets SET result=$1,outcome=$2 WHERE id=$3 RETURNING *',[String(round.number)+' '+round.colour+' '+round.size,outcome,b.id]);
    res.json({ok:true,round,bet:u.rows[0]});
  }catch(e){console.error(e);res.status(500).json({error:'Could not settle history'})}
});
app.get('/api/transactions',auth,async(req,res)=>{const r=await q('SELECT id,type,amount,status,reference,meta,created_at FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200',[req.user.id]);res.json({transactions:r.rows})});
app.post('/api/requests/deposit',auth,async(req,res)=>{const amount=Number(req.body.amount);if(!Number.isInteger(amount)||amount<1)return res.status(400).json({error:'Invalid amount'});const r=await q("INSERT INTO requests(user_id,type,amount,details) VALUES($1,'DEPOSIT',$2,$3) RETURNING *",[req.user.id,amount,JSON.stringify(req.body.details||{})]);await q("INSERT INTO activities(user_id,action,details,coins) VALUES($1,'DEPOSIT REQUEST',$2,$3)",[req.user.id,`Deposit request ${r.rows[0].id}`,req.user.coins]);await q("INSERT INTO transactions(user_id,type,amount,status,meta) VALUES($1,'DEPOSIT',$2,'PENDING',$3)",[req.user.id,amount,JSON.stringify({requestId:r.rows[0].id})]);res.json({request:r.rows[0]})});
app.post('/api/requests/withdrawal',auth,async(req,res)=>{const amount=Number(req.body.amount);if(!Number.isInteger(amount)||amount<1)return res.status(400).json({error:'Invalid amount'});const c=await q('UPDATE users SET coins=coins-$1,last_seen=NOW() WHERE id=$2 AND coins >= $1 RETURNING coins',[amount,req.user.id]);if(!c.rows[0])return res.status(400).json({error:'Insufficient virtual coins'});const r=await q("INSERT INTO requests(user_id,type,amount,details) VALUES($1,'WITHDRAWAL',$2,$3) RETURNING *",[req.user.id,amount,JSON.stringify(req.body.details||{})]);await q("INSERT INTO activities(user_id,action,details,coins) VALUES($1,'WITHDRAWAL REQUEST',$2,$3)",[req.user.id,`Withdrawal request ${r.rows[0].id}`,c.rows[0].coins]);await q("INSERT INTO transactions(user_id,type,amount,status,meta) VALUES($1,'WITHDRAWAL',$2,'PENDING',$3)",[req.user.id,-amount,JSON.stringify({requestId:r.rows[0].id})]);res.json({request:r.rows[0],coins:c.rows[0].coins})});
app.get('/api/my-requests',auth,async(req,res)=>{const r=await q('SELECT * FROM requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200',[req.user.id]);res.json({requests:r.rows})});
app.get('/api/admin/users',auth,admin,async(req,res)=>{const r=await q('SELECT id,name,mobile,email,status,coins,referral_code,created_at,last_seen FROM users ORDER BY created_at DESC');res.json({users:r.rows})});
app.get('/api/admin/requests',auth,admin,async(req,res)=>{const r=await q('SELECT r.*,u.name user_name,u.mobile,u.email FROM requests r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC');res.json({requests:r.rows})});
app.post('/api/admin/requests/:id/approve',auth,admin,async(req,res)=>{const client=await pool.connect();try{await client.query('BEGIN');const r=await client.query('SELECT * FROM requests WHERE id=$1 FOR UPDATE',[req.params.id]);const x=r.rows[0];if(!x||x.status!=='PENDING')throw Error('Request unavailable');if(x.type==='DEPOSIT')await client.query('UPDATE users SET coins=coins+$1 WHERE id=$2',[x.amount,x.user_id]);x.status='APPROVED';await client.query("UPDATE requests SET status='APPROVED',reviewed_at=NOW() WHERE id=$1",[x.id]);await client.query("UPDATE transactions SET status='APPROVED' WHERE user_id=$1 AND meta->>'requestId'=$2",[x.user_id,String(x.id)]);await client.query("INSERT INTO activities(user_id,action,details,coins) SELECT id,'ADMIN REQUEST APPROVED',$2,coins FROM users WHERE id=$1",[x.user_id,`${x.type} request ${x.id} approved`]);await client.query('COMMIT');res.json({ok:true})}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}});
app.post('/api/admin/requests/:id/reject',auth,admin,async(req,res)=>{const client=await pool.connect();try{await client.query('BEGIN');const r=await client.query('SELECT * FROM requests WHERE id=$1 FOR UPDATE',[req.params.id]);const x=r.rows[0];if(!x||x.status!=='PENDING')throw Error('Request unavailable');if(x.type==='WITHDRAWAL')await client.query('UPDATE users SET coins=coins+$1 WHERE id=$2',[x.amount,x.user_id]);await client.query("UPDATE requests SET status='REJECTED',reviewed_at=NOW() WHERE id=$1",[x.id]);await client.query("UPDATE transactions SET status='REJECTED' WHERE user_id=$1 AND meta->>'requestId'=$2",[x.user_id,String(x.id)]);await client.query("INSERT INTO activities(user_id,action,details,coins) SELECT id,'ADMIN REQUEST REJECTED',$2,coins FROM users WHERE id=$1",[x.user_id,`${x.type} request ${x.id} rejected`]);await client.query('COMMIT');res.json({ok:true})}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}});
app.get('/api/admin/activities',auth,admin,async(req,res)=>{const r=await q("SELECT a.*,u.name user_name,u.mobile FROM activities a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200");res.json({activities:r.rows})});
app.patch('/api/admin/users/:id',auth,admin,async(req,res)=>{const {status,coins}=req.body;const fields=[],vals=[];if(status){fields.push(`status=$${vals.length+1}`);vals.push(status)}if(Number.isInteger(Number(coins))&&Number(coins)>=0){fields.push(`coins=$${vals.length+1}`);vals.push(Number(coins))}if(!fields.length)return res.status(400).json({error:'Nothing to update'});vals.push(req.params.id);const r=await q(`UPDATE users SET ${fields.join(',')} WHERE id=$${vals.length} RETURNING id,name,status,coins`,vals);res.json({user:r.rows[0]})});
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  res.sendFile(path.join(__dirname, 'index.html'), err => {
    if (err) next(err);
  });
async function initDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`schema.sql not found at ${schemaPath}`);
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');

  await q(schema);

  console.log('Database schema initialized successfully.');
}

const PORT = process.env.PORT || 3000;

initDatabase()
  .then(() => {
 async function initDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`schema.sql not found at ${schemaPath}`);
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');

  if (!schema.trim()) {
    throw new Error('schema.sql is empty');
  }

  await q(schema);

  console.log('Database schema initialized successfully.');
}

const PORT = process.env.PORT || 3000;

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FAST07 API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });
