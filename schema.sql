CREATE TABLE IF NOT EXISTS users (
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
);

CREATE TABLE IF NOT EXISTS demo_rounds (
 period TEXT PRIMARY KEY,
 number INT NOT NULL CHECK(number BETWEEN 0 AND 9),
 colour TEXT NOT NULL,
 size TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT REFERENCES users(id),
 action TEXT NOT NULL,
 details TEXT,
 coins BIGINT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_rounds_period ON demo_rounds(period DESC);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);
