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
