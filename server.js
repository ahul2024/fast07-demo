require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

const q = (sql, params=[]) => pool.query(sql, params);
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

async function initDatabase() {
  await q(`CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    referral_code TEXT UNIQUE NOT NULL,
    referred_by BIGINT REFERENCES users(id),
    coins BIGINT NOT NULL DEFAULT 250 CHECK (coins >= 0),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','BLOCKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_page TEXT NOT NULL DEFAULT 'dashboard',
    role TEXT NOT NULL DEFAULT 'USER'
  )`);

  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_page TEXT NOT NULL DEFAULT 'dashboard'`);
  await q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'USER'`);
  await q(`ALTER TABLE users ALTER COLUMN coins SET DEFAULT 250`);

  await q(`CREATE TABLE IF NOT EXISTS demo_rounds (
    period TEXT PRIMARY KEY,
    number INT NOT NULL CHECK(number BETWEEN 0 AND 9),
    colour TEXT NOT NULL,
    size TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  await q(`CREATE TABLE IF NOT EXISTS predictions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    period TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('colour','size','number')),
    choice TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','CORRECT','INCORRECT')),
    points_awarded INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id,period,kind)
  )`);

  await q(`CREATE TABLE IF NOT EXISTS demo_wallet_requests (
    id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK(type IN ('ADD','REMOVE')), amount BIGINT NOT NULL CHECK(amount>0),
    demo_reference TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), processed_at TIMESTAMPTZ, processed_by TEXT
  )`);

  await q(`CREATE TABLE IF NOT EXISTS activities (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    action TEXT NOT NULL,
    details TEXT,
    coins BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

async function auth(req,res,next) {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return res.status(401).json({error:'Authentication required'});
    const p = jwt.verify(h.slice(7), JWT_SECRET);
    const r = await q(`SELECT id,name,mobile,email,status,coins,referral_code,created_at,last_seen,last_page,role
                       FROM users WHERE id=$1`, [p.id]);
    if (!r.rows[0]) return res.status(401).json({error:'User not found'});
    if (r.rows[0].status === 'BLOCKED') return res.status(403).json({error:'Account blocked'});
    req.user = r.rows[0];
    next();
  } catch(e) {
    return res.status(401).json({error:'Invalid or expired session'});
  }
}

function adminAuth(req,res,next) {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return res.status(401).json({error:'Admin authentication required'});
    const p = jwt.verify(h.slice(7), JWT_SECRET);
    if (p.admin !== true) return res.status(403).json({error:'Admin only'});
    req.admin = p;
    next();
  } catch(e) {
    return res.status(401).json({error:'Invalid admin session'});
  }
}

function currentPeriod() {
  return String(1000000000 + Math.floor(Date.now()/30000));
}

function resultFor(period) {
  const hash = crypto.createHash('sha256').update(String(period)).digest();
  const n = hash[0] % 10;
  return { period, number:n, colour:n===5?'Violet':(n%2===0?'Red':'Green'), size:n>=5?'Big':'Small' };
}

/* Health */
app.get('/api/health', async (_,res) => {
  try { await q('SELECT 1'); res.json({ok:true}); }
  catch(e) { res.status(503).json({ok:false,error:'Database unavailable'}); }
});

/* User signup */
app.post('/api/auth/signup', async (req,res) => {
  try {
    const {name,mobile,email,password,referralCode=''} = req.body;
    if (!name || !mobile || !email || !password) return res.status(400).json({error:'Missing required fields'});
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanMobile = String(mobile).trim();

    const ex = await q('SELECT id FROM users WHERE LOWER(email)=LOWER($1) OR mobile=$2',[cleanEmail,cleanMobile]);
    if (ex.rows[0]) return res.status(409).json({error:'Email or mobile already registered'});

    let ref = null;
    if (referralCode.trim()) {
      const rr = await q('SELECT id FROM users WHERE referral_code=$1',[referralCode.trim().toUpperCase()]);
      ref = rr.rows[0] || null;
    }

    const hash = await bcrypt.hash(password,12);
    const code = 'REF-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    const r = await q(`INSERT INTO users
      (name,mobile,email,password_hash,referral_code,referred_by,coins,last_page,role)
      VALUES($1,$2,$3,$4,$5,$6,250,'dashboard','USER')
      RETURNING id,name,mobile,email,status,coins,referral_code,created_at,last_seen,last_page,role`,
      [name.trim(),cleanMobile,cleanEmail,hash,code,ref ? ref.id : null]);

    const u = r.rows[0];

    await q(`INSERT INTO activities(user_id,action,details,coins)
             VALUES($1,'REGISTER','New virtual demo account created',250)`,[u.id]);

    res.json({token:makeToken({id:u.id,role:'USER'}),user:u});
  } catch(e) {
    console.error('SIGNUP ERROR',e);
    res.status(500).json({error:'Signup failed'});
  }
});

/* User login */
app.post('/api/auth/login', async (req,res) => {
  try {
    const identifier = String(req.body.identifier || '').trim();
    const password = String(req.body.password || '');
    const r = await q(`SELECT * FROM users WHERE LOWER(email)=LOWER($1) OR mobile=$1 LIMIT 1`,[identifier]);
    const u = r.rows[0];
    if (!u || !(await bcrypt.compare(password,u.password_hash))) return res.status(401).json({error:'Invalid login details'});
    if (u.status === 'BLOCKED') return res.status(403).json({error:'Account blocked'});

    await q('UPDATE users SET last_seen=NOW() WHERE id=$1',[u.id]);
    await q(`INSERT INTO activities(user_id,action,details,coins) VALUES($1,'LOGIN','User logged in',$2)`,[u.id,u.coins]);

    res.json({
      token:makeToken({id:u.id,role:'USER'}),
      user:{id:u.id,name:u.name,mobile:u.mobile,email:u.email,status:u.status,coins:u.coins,
            referralCode:u.referral_code,lastPage:u.last_page || 'dashboard',role:u.role || 'USER'}
    });
  } catch(e) {
    console.error('LOGIN ERROR',e);
    res.status(500).json({error:'Login failed'});
  }
});

app.get('/api/me',auth,(req,res)=>res.json({user:req.user}));

app.patch('/api/me/page',auth,async(req,res)=>{
  try {
    const page=String(req.body.page||'dashboard').slice(0,80);
    const r=await q(`UPDATE users SET last_page=$1,last_seen=NOW() WHERE id=$2
                     RETURNING id,last_page,last_seen`,[page,req.user.id]);
    res.json({ok:true,user:r.rows[0]});
  } catch(e) { res.status(500).json({error:'Could not save page'}); }
});

/* Server-synchronised read-only demo rounds */
app.get('/api/demo/current',async(_,res)=>{
  const period=currentPeriod();
  const result=resultFor(period);
  await q(`INSERT INTO demo_rounds(period,number,colour,size)
           VALUES($1,$2,$3,$4) ON CONFLICT(period) DO NOTHING`,
          [period,result.number,result.colour,result.size]);
  res.json({current:result,serverTime:Date.now(),periodLength:30});
});

app.get('/api/demo/history',async(req,res)=>{
  try {
    const limit=Math.min(Math.max(Number(req.query.limit)||100,1),5000);
    const current=currentPeriod();
    const r=await q(`SELECT period,number,colour,size,created_at
                     FROM demo_rounds
                     WHERE period <= $1
                     ORDER BY period DESC
                     LIMIT $2`,[current,limit]);
    res.json({history:r.rows});
  } catch(e) {
    console.error(e);
    res.status(500).json({error:'Could not load demo history'});
  }
});


async function resolvePredictions() {
  const nowPeriod=Number(currentPeriod());
  const pending=await q(`SELECT id,user_id,period,kind,choice FROM predictions WHERE status='PENDING' AND period::bigint < $1`,[nowPeriod]);
  for (const x of pending.rows) {
    const r=resultFor(x.period);
    const actual=x.kind==='colour'?r.colour:(x.kind==='size'?r.size:String(r.number));
    const correct=String(x.choice)===String(actual);
    const points=x.kind==='number'?40:10;
    await q(`UPDATE predictions SET status=$1,points_awarded=$2 WHERE id=$3`,[correct?'CORRECT':'INCORRECT',correct?points:0,x.id]);
    if(correct) {
      await q(`UPDATE users SET coins=coins+$1 WHERE id=$2`,[points,x.user_id]);
      await q(`INSERT INTO activities(user_id,action,details,coins) VALUES($1,'PREDICTION_CORRECT',$2,$3)`,[x.user_id,`Free ${x.kind} prediction correct for round ${x.period}`,points]);
    }
  }
}

app.post('/api/predict',auth,async(req,res)=>{
  try {
    await resolvePredictions();
    const kind=String(req.body.kind||'');
    const choice=String(req.body.choice??'');
    if(!['colour','size','number'].includes(kind)) return res.status(400).json({error:'Invalid prediction type'});
    const valid={colour:['Red','Green','Violet'],size:['Big','Small'],number:['0','1','2','3','4','5','6','7','8','9']};
    if(!valid[kind].includes(choice)) return res.status(400).json({error:'Invalid prediction'});
    const remaining=30-(Math.floor(Date.now()/1000)%30);
    if(remaining<=2) return res.status(400).json({error:'Round is closing. Please wait for the next round.'});
    const period=currentPeriod();
    const row=await q(`INSERT INTO predictions(user_id,period,kind,choice) VALUES($1,$2,$3,$4) RETURNING id,period,kind,choice,status,points_awarded,created_at`,[req.user.id,period,kind,choice]);
    await q(`INSERT INTO activities(user_id,action,details,coins) VALUES($1,'PREDICTION_SUBMITTED',$2,0)`,[req.user.id,`Free ${kind} prediction submitted for round ${period}`]);
    res.json({ok:true,prediction:row.rows[0],message:'Prediction submitted. It will be scored when the round ends.'});
  } catch(e) {
    if(e.code==='23505') return res.status(409).json({error:'You already made this type of prediction for this round.'});
    console.error('PREDICT ERROR',e); res.status(500).json({error:'Could not submit prediction'});
  }
});

app.get('/api/predictions',auth,async(req,res)=>{
  try { await resolvePredictions(); const r=await q(`SELECT id,period,kind,choice,status,points_awarded,created_at FROM predictions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,[req.user.id]); res.json({predictions:r.rows}); }
  catch(e){res.status(500).json({error:'Could not load predictions'});}
});

/* Demo wallet requests: virtual coins only, no money/UPI */
app.post('/api/wallet/request',auth,async(req,res)=>{
  try {
    const type=String(req.body.type||''); const amount=Number(req.body.amount); const demoReference=String(req.body.demoReference||'').trim().slice(0,80);
    if(!['ADD','REMOVE'].includes(type) || !Number.isInteger(amount) || amount<1 || amount>1000000) return res.status(400).json({error:'Invalid virtual coin request'});
    if(!demoReference || /utr|upi|bank|payment/i.test(demoReference)) return res.status(400).json({error:'Use a fictional Demo Request ID only; no payment or UTR references.'});
    const r=await q(`INSERT INTO demo_wallet_requests(user_id,type,amount,demo_reference) VALUES($1,$2,$3,$4) RETURNING *`,[req.user.id,type,amount,demoReference]);
    await q(`INSERT INTO activities(user_id,action,details,coins) VALUES($1,$2,$3,$4)`,[req.user.id,type==='ADD'?'DEMO_COINS_REQUESTED':'DEMO_COINS_REMOVE_REQUESTED',`Virtual coin request pending: ${demoReference}`,amount]);
    res.json({ok:true,request:r.rows[0],message:'Demo coin request sent to admin for review.'});
  }catch(e){console.error(e);res.status(500).json({error:'Could not create request'});}
});
app.get('/api/wallet/requests',auth,async(req,res)=>{try{const r=await q(`SELECT id,type,amount,demo_reference,status,created_at,processed_at FROM demo_wallet_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,[req.user.id]);res.json({requests:r.rows});}catch(e){res.status(500).json({error:'Could not load requests'});}});
app.get('/api/admin/wallet/requests',adminAuth,async(_,res)=>{try{const r=await q(`SELECT w.*,u.name user_name,u.mobile,u.email FROM demo_wallet_requests w JOIN users u ON u.id=w.user_id ORDER BY w.created_at DESC LIMIT 500`);res.json({requests:r.rows});}catch(e){res.status(500).json({error:'Could not load requests'});}});
app.post('/api/admin/wallet/requests/:id',adminAuth,async(req,res)=>{
 const client=await pool.connect(); try{await client.query('BEGIN'); const status=String(req.body.status||''); if(!['APPROVED','REJECTED'].includes(status)) throw new Error('Invalid status');
 const x=await client.query(`SELECT * FROM demo_wallet_requests WHERE id=$1 FOR UPDATE`,[req.params.id]); const w=x.rows[0]; if(!w) throw new Error('Request not found'); if(w.status!=='PENDING') throw new Error('Request already processed');
 if(status==='APPROVED'){ if(w.type==='REMOVE'){const u=await client.query(`UPDATE users SET coins=coins-$1 WHERE id=$2 AND coins >= $1 RETURNING coins`,[w.amount,w.user_id]);if(!u.rows[0]) throw new Error('User does not have enough virtual coins');} else await client.query(`UPDATE users SET coins=coins+$1 WHERE id=$2`,[w.amount,w.user_id]); }
 await client.query(`UPDATE demo_wallet_requests SET status=$1,processed_at=NOW(),processed_by='admin' WHERE id=$2`,[status,w.id]);
 await client.query(`INSERT INTO activities(user_id,action,details,coins) VALUES($1,$2,$3,$4)`,[w.user_id,status==='APPROVED'?(w.type==='ADD'?'DEMO_COINS_ADDED':'DEMO_COINS_REMOVED'):'DEMO_REQUEST_REJECTED',`Admin ${status.toLowerCase()} virtual request ${w.demo_reference}`,w.amount]); await client.query('COMMIT');res.json({ok:true});
 }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'Could not process request'});}finally{client.release();}
});

/* Admin login */
app.post('/api/admin/login',(req,res)=>{
  const id=String(req.body.identifier||'').trim();
  const password=String(req.body.password||'');
  const adminId=process.env.ADMIN_ID || 'admin';
  const adminPassword=process.env.ADMIN_PASSWORD || '';
  if (!adminPassword) return res.status(503).json({error:'ADMIN_PASSWORD is not configured'});
  if (id !== adminId || password !== adminPassword) return res.status(401).json({error:'Invalid admin credentials'});
  res.json({token:makeToken({admin:true,role:'ADMIN',id:'admin'}),admin:{id:'admin',role:'ADMIN'}});
});

app.get('/api/admin/users',adminAuth,async(_,res)=>{
  try {
    const r=await q(`SELECT id,name,mobile,email,status,coins,referral_code,created_at,last_seen,last_page
                     FROM users ORDER BY created_at DESC`);
    res.json({users:r.rows});
  } catch(e) { res.status(500).json({error:'Could not load users'}); }
});

app.get('/api/admin/activities',adminAuth,async(_,res)=>{
  try {
    const r=await q(`SELECT a.*,u.name user_name,u.mobile
                     FROM activities a LEFT JOIN users u ON u.id=a.user_id
                     ORDER BY a.created_at DESC LIMIT 500`);
    res.json({activities:r.rows});
  } catch(e) { res.status(500).json({error:'Could not load activities'}); }
});

app.get('/api/admin/rounds',adminAuth,async(_,res)=>{
  try {
    const r=await q(`SELECT period,number,colour,size,created_at
                     FROM demo_rounds ORDER BY period DESC LIMIT 500`);
    res.json({rounds:r.rows});
  } catch(e) { res.status(500).json({error:'Could not load rounds'}); }
});

app.patch('/api/admin/users/:id',adminAuth,async(req,res)=>{
  try {
    const fields=[],vals=[];
    if (req.body.status === 'ACTIVE' || req.body.status === 'BLOCKED') {
      fields.push(`status=$${vals.length+1}`); vals.push(req.body.status);
    }
    if (Number.isInteger(Number(req.body.coins)) && Number(req.body.coins)>=0) {
      fields.push(`coins=$${vals.length+1}`); vals.push(Number(req.body.coins));
    }
    if (!fields.length) return res.status(400).json({error:'Nothing to update'});
    vals.push(req.params.id);
    const r=await q(`UPDATE users SET ${fields.join(',')} WHERE id=$${vals.length}
                     RETURNING id,name,status,coins`,vals);
    if (!r.rows[0]) return res.status(404).json({error:'User not found'});
    res.json({user:r.rows[0]});
  } catch(e) { res.status(500).json({error:'Could not update user'}); }
});

app.use((req,res,next)=>{
  if (req.path.startsWith('/api/')) return res.status(404).json({error:'API route not found'});
  res.sendFile(path.join(__dirname,'index.html'),err=>{if(err) next(err);});
});

async function start() {
  await initDatabase();
  const port=process.env.PORT || 3000;
  app.listen(port,()=>console.log(`FAST07 demo server running on ${port}`));
}
start().catch(e=>{console.error('STARTUP ERROR',e);process.exit(1);});
