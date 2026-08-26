require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();

/* =========================
   CONFIGURATION
========================= */

const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('ERROR: JWT_SECRET is not configured.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not configured.');
  process.exit(1);
}


/* =========================
   DATABASE
========================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});


const q = (text, params = []) => {
  return pool.query(text, params);
};


/* =========================
   MIDDLEWARE
========================= */

app.use(
  cors({
    origin: true,
    credentials: false
  })
);

app.use(
  express.json({
    limit: '1mb'
  })
);


/*
  Serve frontend files directly.

  index.html
  admin.html
  admin-login.html
  app.html
  app.js
  style.css

  will be served from the same folder.
*/

app.use(
  express.static(__dirname)
);


/* =========================
   HELPER
========================= */

function createToken(user) {

  return jwt.sign(
    {
      id: user.id,
      role: user.role || 'USER'
    },

    JWT_SECRET,

    {
      expiresIn: '7d'
    }
  );
}


/* =========================
   AUTH MIDDLEWARE
========================= */

async function auth(req, res, next) {

  try {

    const header =
      req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {

      return res.status(401).json({
        error: 'Authentication required'
      });

    }


    const token =
      header.slice(7);


    const payload =
      jwt.verify(
        token,
        JWT_SECRET
      );


    /*
      ADMIN TOKEN

      Admin database users table
      me search nahi hoga.
    */

    if (payload.role === 'ADMIN') {

      req.user = {
        id: 'ADMIN',
        role: 'ADMIN',
        name: 'Administrator'
      };

      return next();
    }


    /*
      NORMAL USER
    */

    const result = await q(
      `
      SELECT
        id,
        name,
        mobile,
        email,
        status,
        role,
        coins,
        referral_code,
        created_at,
        last_seen
      FROM users
      WHERE id = $1
      `,
      [payload.id]
    );


    if (!result.rows.length) {

      return res.status(401).json({
        error: 'User not found'
      });

    }


    req.user =
      result.rows[0];


    next();

  } catch (error) {

    console.error(
      'AUTH ERROR:',
      error.message
    );


    return res.status(401).json({
      error: 'Invalid or expired token'
    });

  }

}


/* =========================
   ADMIN MIDDLEWARE
========================= */

function admin(req, res, next) {

  if (
    req.user &&
    req.user.role === 'ADMIN'
  ) {

    return next();

  }


  return res.status(403).json({
    error: 'Admin only'
  });

}


/* =========================
   HEALTH CHECK
========================= */

app.get(
  '/api/health',
  async (req, res) => {

    try {

      await q('SELECT 1');

      res.json({
        ok: true,
        service: 'FAST07 Demo API',
        database: 'connected'
      });

    } catch (error) {

      console.error(
        'HEALTH ERROR:',
        error.message
      );

      res.status(503).json({
        ok: false,
        service: 'FAST07 Demo API',
        database: 'unavailable'
      });

    }

  }
);


/* =========================
   ADMIN LOGIN
========================= */

app.post(
  '/api/admin/login',
  async (req, res) => {

    try {

      const {
        id,
        password
      } = req.body || {};


      const adminId =
        process.env.ADMIN_ID ||
        'admin';


      const adminPassword =
        process.env.ADMIN_PASSWORD ||
        'Admin@12345';


      if (
        id !== adminId ||
        password !== adminPassword
      ) {

        return res.status(401).json({
          error:
            'Invalid admin credentials'
        });

      }


      const adminUser = {
        id: 'ADMIN',
        role: 'ADMIN'
      };


      const adminToken =
        createToken(adminUser);


      res.json({
        token: adminToken,
        user: {
          id: 'ADMIN',
          role: 'ADMIN',
          name: 'Administrator'
        }
      });


    } catch (error) {

      console.error(
        'ADMIN LOGIN ERROR:',
        error
      );


      res.status(500).json({
        error: 'Admin login failed'
      });

    }

  }
);


/* =========================
   USER SIGNUP
========================= */

app.post(
  '/api/auth/signup',
  async (req, res) => {

    try {

      const {
        name,
        mobile,
        email,
        password,
        referralCode = ''
      } = req.body || {};


      if (
        !name ||
        !mobile ||
        !email ||
        !password
      ) {

        return res.status(400).json({
          error:
            'Missing required fields'
        });

      }


      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();


      const normalizedMobile =
        String(mobile)
          .trim();


      /*
        Check duplicate user
      */

      const existing =
        await q(
          `
          SELECT id
          FROM users
          WHERE email = $1
             OR mobile = $2
          LIMIT 1
          `,
          [
            normalizedEmail,
            normalizedMobile
          ]
        );


      if (existing.rows.length) {

        return res.status(409).json({
          error:
            'Email or mobile already registered'
        });

      }


      /*
        Referral
      */

      let referredBy = null;


      if (referralCode) {

        const referral =
          await q(
            `
            SELECT id
            FROM users
            WHERE referral_code = $1
            LIMIT 1
            `,
            [
              String(
                referralCode
              )
                .trim()
                .toUpperCase()
            ]
          );


        if (referral.rows.length) {

          referredBy =
            referral.rows[0].id;

        }

      }


      /*
        Password hash
      */

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );


      /*
        Referral code
      */

      const generatedCode =
        'REF-' +
        Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase();


      /*
        New virtual/demo account
      */

      const result =
        await q(
          `
          INSERT INTO users
          (
            name,
            mobile,
            email,
            password_hash,
            referral_code,
            referred_by,
            coins
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
          )
          RETURNING
            id,
            name,
            mobile,
            email,
            status,
            coins,
            referral_code,
            created_at,
            last_seen
          `,
          [
            name.trim(),
            normalizedMobile,
            normalizedEmail,
            passwordHash,
            generatedCode,
            referredBy,
            referredBy ? 1200 : 1000
          ]
        );


      const user =
        result.rows[0];


      /*
        Referral bonus
      */

      if (referredBy) {

        await q(
          `
          UPDATE users
          SET coins = coins + 100
          WHERE id = $1
          `,
          [referredBy]
        );


        await q(
          `
          INSERT INTO transactions
          (
            user_id,
            type,
            amount,
            status,
            meta
          )
          VALUES
          (
            $1,
            'REFERRAL',
            100,
            'APPROVED',
            $2
          )
          `,
          [
            referredBy,
            JSON.stringify({
              newUserId: user.id
            })
          ]
        );

      }


      /*
        Activity
      */

      await q(
        `
        INSERT INTO activities
        (
          user_id,
          action,
          details,
          coins
        )
        VALUES
        (
          $1,
          'REGISTER',
          'New demo account created',
          $2
        )
        `,
        [
          user.id,
          user.coins
        ]
      );


      const userToken =
        createToken(user);


      res.json({
        token: userToken,
        user
      });


    } catch (error) {

      console.error(
        'SIGNUP ERROR:',
        error
      );


      res.status(500).json({
        error: 'Signup failed'
      });

    }

  }
);


/* =========================
   USER LOGIN
========================= */

app.post(
  '/api/auth/login',
  async (req, res) => {

    try {

      const {
        identifier,
        password
      } = req.body || {};


      const loginId =
        String(
          identifier || ''
        )
          .trim()
          .toLowerCase();


      const result =
        await q(
          `
          SELECT *
          FROM users
          WHERE LOWER(email) = $1
             OR mobile = $1
          LIMIT 1
          `,
          [loginId]
        );


      const user =
        result.rows[0];


      if (!user) {

        return res.status(401).json({
          error:
            'Invalid login details'
        });

      }


      const passwordOk =
        await bcrypt.compare(
          password || '',
          user.password_hash
        );


      if (!passwordOk) {

        return res.status(401).json({
          error:
            'Invalid login details'
        });

      }


      if (
        user.status === 'BLOCKED'
      ) {

        return res.status(403).json({
          error:
            'Account blocked'
        });

      }


      await q(
        `
        UPDATE users
        SET last_seen = NOW()
        WHERE id = $1
        `,
        [user.id]
      );


      await q(
        `
        INSERT INTO activities
        (
          user_id,
          action,
          details,
          coins
        )
        VALUES
        (
          $1,
          'LOGIN',
          'User logged in',
          $2
        )
        `,
        [
          user.id,
          user.coins
        ]
      );


      const userToken =
        createToken(user);


      res.json({

        token: userToken,

        user: {
          id: user.id,
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          status: user.status,
          coins: user.coins,
          referralCode:
            user.referral_code
        }

      });


    } catch (error) {

      console.error(
        'LOGIN ERROR:',
        error
      );


      res.status(500).json({
        error: 'Login failed'
      });

    }

  }
);


/* =========================
   CURRENT USER
========================= */

app.get(
  '/api/me',
  auth,
  async (req, res) => {

    res.json({
      user: req.user
    });

  }
);


/* =========================
   USER TRANSACTIONS
========================= */

app.get(
  '/api/transactions',
  auth,
  async (req, res) => {

    try {

      const result =
        await q(
          `
          SELECT
            id,
            type,
            amount,
            status,
            reference,
            meta,
            created_at
          FROM transactions
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 200
          `,
          [req.user.id]
        );


      res.json({
        transactions:
          result.rows
      });


    } catch (error) {

      console.error(
        'TRANSACTIONS ERROR:',
        error
      );


      res.status(500).json({
        error:
          'Unable to load transactions'
      });

    }

  }
);


/* =========================
   DEPOSIT REQUEST
   VIRTUAL COINS ONLY
========================= */

app.post(
  '/api/requests/deposit',
  auth,
  async (req, res) => {

    try {

      const amount =
        Number(req.body.amount);


      if (
        !Number.isInteger(amount) ||
        amount < 1
      ) {

        return res.status(400).json({
          error:
            'Invalid amount'
        });

      }


      const result =
        await q(
          `
          INSERT INTO requests
          (
            user_id,
            type,
            amount,
            details
          )
          VALUES
          (
            $1,
            'DEPOSIT',
            $2,
            $3
          )
          RETURNING *
          `,
          [
            req.user.id,
            amount,
            JSON.stringify(
              req.body.details || {}
            )
          ]
        );


      const request =
        result.rows[0];


      await q(
        `
        INSERT INTO transactions
        (
          user_id,
          type,
          amount,
          status,
          meta
        )
        VALUES
        (
          $1,
          'DEPOSIT',
          $2,
          'PENDING',
          $3
        )
        `,
        [
          req.user.id,
          amount,
          JSON.stringify({
            requestId: request.id
          })
        ]
      );


      res.json({
        request
      });


    } catch (error) {

      console.error(
        'DEPOSIT REQUEST ERROR:',
        error
      );


      res.status(500).json({
        error:
          'Deposit request failed'
      });

    }

  }
);


/* =========================
   WITHDRAWAL REQUEST
   VIRTUAL COINS ONLY
========================= */

app.post(
  '/api/requests/withdrawal',
  auth,
  async (req, res) => {

    const client =
      await pool.connect();


    try {

      const amount =
        Number(req.body.amount);


      if (
        !Number.isInteger(amount) ||
        amount < 1
      ) {

        return res.status(400).json({
          error:
            'Invalid amount'
        });

      }


      await client.query(
        'BEGIN'
      );


      /*
        Reserve virtual coins
      */

      const coinResult =
        await client.query(
          `
          UPDATE users
          SET
            coins = coins - $1,
            last_seen = NOW()
          WHERE id = $2
            AND coins >= $1
          RETURNING coins
          `,
          [
            amount,
            req.user.id
          ]
        );


      if (!coinResult.rows.length) {

        throw new Error(
          'Insufficient virtual coins'
        );

      }


      /*
        Create request
      */

      const requestResult =
        await client.query(
          `
          INSERT INTO requests
          (
            user_id,
            type,
            amount,
            details
          )
          VALUES
          (
            $1,
            'WITHDRAWAL',
            $2,
            $3
          )
          RETURNING *
          `,
          [
            req.user.id,
            amount,
            JSON.stringify(
              req.body.details || {}
            )
          ]
        );


      const request =
        requestResult.rows[0];


      /*
        Transaction record
      */

      await client.query(
        `
        INSERT INTO transactions
        (
          user_id,
          type,
          amount,
          status,
          meta
        )
        VALUES
        (
          $1,
          'WITHDRAWAL',
          $2,
          'PENDING',
          $3
        )
        `,
        [
          req.user.id,
          -amount,
          JSON.stringify({
            requestId: request.id
          })
        ]
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        request,
        coins:
          coinResult.rows[0].coins
      });


    } catch (error) {

      await client.query(
        'ROLLBACK'
      );


      console.error(
        'WITHDRAWAL REQUEST ERROR:',
        error
      );


      res.status(400).json({
        error:
          error.message ||
          'Withdrawal request failed'
      });


    } finally {

      client.release();

    }

  }
);


/* =========================
   MY REQUESTS
========================= */

app.get(
  '/api/my-requests',
  auth,
  async (req, res) => {

    try {

      const result =
        await q(
          `
          SELECT *
          FROM requests
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 200
          `,
          [req.user.id]
        );


      res.json({
        requests:
          result.rows
      });


    } catch (error) {

      console.error(
        'MY REQUESTS ERROR:',
        error
      );


      res.status(500).json({
        error:
          'Unable to load requests'
      });

    }

  }
);


/* =========================
   ADMIN - USERS
========================= */

app.get(
  '/api/admin/users',
  auth,
  admin,
  async (req, res) => {

    try {

      const result =
        await q(
          `
          SELECT
            id,
            name,
            mobile,
            email,
            status,
            coins,
            referral_code,
            created_at,
            last_seen
          FROM users
          ORDER BY created_at DESC
          `
        );


      res.json({
        users:
          result.rows
      });


    } catch (error) {

      console.error(
        'ADMIN USERS ERROR:',
        error
      );


      res.status(500).json({
        error:
          'Unable to load users'
      });

    }

  }
);


/* =========================
   ADMIN - REQUESTS
========================= */

app.get(
  '/api/admin/requests',
  auth,
  admin,
  async (req, res) => {

    try {

      const result =
        await q(
          `
          SELECT
            r.*,
            u.name AS user_name,
            u.mobile,
            u.email
          FROM requests r
          JOIN users u
            ON u.id = r.user_id
          ORDER BY r.created_at DESC
          `
        );


      res.json({
        requests:
          result.rows
      });


    } catch (error) {

      console.error(
        'ADMIN REQUESTS ERROR:',
        error
      );


      res.status(500).json({
        error:
          'Unable to load requests'
      });

    }

  }
);


/* =========================
   ADMIN - APPROVE REQUEST
========================= */

app.post(
  '/api/admin/requests/:id/approve',
  auth,
  admin,
  async (req, res) => {

    const client =
      await pool.connect();


    try {

      await client.query(
        'BEGIN'
      );


      const result =
        await client.query(
          `
          SELECT *
          FROM requests
          WHERE id = $1
          FOR UPDATE
          `,
          [req.params.id]
        );


      const request =
        result.rows[0];


      if (
        !request ||
        request.status !== 'PENDING'
      ) {

        throw new Error(
          'Request unavailable'
        );

      }


      /*
        Deposit approval adds
        virtual coins.

        No real-money processing.
      */

      if (
        request.type === 'DEPOSIT'
      ) {

        await client.query(
          `
          UPDATE users
          SET coins = coins + $1
          WHERE id = $2
          `,
          [
            request.amount,
            request.user_id
          ]
        );

      }


      await client.query(
        `
        UPDATE requests
        SET
          status = 'APPROVED',
          reviewed_at = NOW()
        WHERE id = $1
        `,
        [request.id]
      );


      await client.query(
        `
        UPDATE transactions
        SET status = 'APPROVED'
        WHERE user_id = $1
          AND meta->>'requestId' = $2
        `,
        [
          request.user_id,
          String(request.id)
        ]
      );


      await client.query(
        `
        INSERT INTO activities
        (
          user_id,
          action,
          details,
          coins
        )
        SELECT
          id,
          'ADMIN REQUEST APPROVED',
          $2,
          coins
        FROM users
        WHERE id = $1
        `,
        [
          request.user_id,
          `${request.type} request ${request.id} approved`
        ]
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        ok: true,
        message:
          'Request approved'
      });


    } catch (error) {

      await client.query(
        'ROLLBACK'
      );


      console.error(
        'APPROVE REQUEST ERROR:',
        error
      );


      res.status(400).json({
        error:
          error.message
      });


    } finally {

      client.release();

    }

  }
);


/* =========================
   ADMIN - REJECT REQUEST
========================= */

app.post(
  '/api/admin/requests/:id/reject',
  auth,
  admin,
  async (req, res) => {

    const client =
      await pool.connect();


    try {

      await client.query(
        'BEGIN'
      );


      const result =
        await client.query(
          `
          SELECT *
          FROM requests
          WHERE id = $1
          FOR UPDATE
          `,
          [req.params.id]
        );


      const request =
        result.rows[0];


      if (
        !request ||
        request.status !== 'PENDING'
      ) {

        throw new Error(
          'Request unavailable'
        );

      }


      /*
        If withdrawal is rejected,
        return virtual coins to user.
      */

      if (
        request.type === 'WITHDRAWAL'
      ) {

        await client.query(
          `
          UPDATE users
          SET coins = coins + $1
          WHERE id = $2
          `,
          [
            request.amount,
            request.user_id
          ]
        );

      }


      await client.query(
        `
        UPDATE requests
        SET
          status = 'REJECTED',
          reviewed_at = NOW()
        WHERE id = $1
        `,
        [request.id]
      );


      await client.query(
        `
        UPDATE transactions
        SET status = 'REJECTED'
        WHERE user_id = $1
          AND meta->>'requestId' = $2
        `,
        [
          request.user_id,
          String(request.id)
        ]
      );


      await client.query(
        `
        INSERT INTO activities
        (
          user_id,
          action,
          details,
          coins
        )
        SELECT
          id,
          'ADMIN REQUEST REJECTED',
          $2,
          coins
        FROM users
        WHERE id = $1
        `,
        [
          request.user_id,
          `${request.type} request ${request.id} rejected`
        ]
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        ok: true,
        message:
          'Request rejected'
      });


    } catch (error) {

      await client.query(
        'ROLLBACK'
      );


      console.error(
        'REJECT REQUEST ERROR:',
        error
      );


      res.status(400).json({
        error:
          error.message
      });


    } finally {

      client.release();

    }

  }
);


/* =========================
   ADMIN - ACTIVITIES
========================= */

app.get(
  '/api/admin/activities',
  auth,
  admin,
  async (req, res) => {

    try {

      const result =
        await q(
          `
          SELECT
            a.*,
            u.name AS user_name,
            u.mobile
          FROM activities a
          LEFT JOIN users u
            ON u.id = a.user_id
          ORDER BY a.created_at DESC
          LIMIT 200
          `
        );


      res.json({
        activities:
          result.rows
      });


    } catch (error) {

      console.error(
        'ADMIN ACTIVITIES ERROR:',
        error
      );


      res.status(500).json({
        error:
          'Unable to load activities'
      });

    }

  }
);


/* =========================
   ADMIN - UPDATE USER
========================= */

app.patch(
  '/api/admin/users/:id',
  auth,
  admin,
  async (req, res) => {

    try {

      const {
        status,
        coins
      } = req.body || {};


      const fields = [];
      const values = [];


      if (status) {

        fields.push(
          `status = $${values.length + 1}`
        );

        values.push(status);

      }


      if (
        Number.isInteger(
          Number(coins)
        ) &&
        Number(coins) >= 0
      ) {

        fields.push(
          `coins = $${values.length + 1}`
        );

        values.push(
          Number(coins)
        );

      }


      if (!fields.length) {

        return res.status(400).json({
          error:
            'Nothing to update'
        });

      }


      values.push(
        req.params.id
      );


      const result =
        await q(
          `
          UPDATE users
          SET ${fields.join(', ')}
          WHERE id = $${values.length}
          RETURNING
            id,
            name,
            status,
            coins
          `,
          values
        );


      if (!result.rows.length) {

        return res.status(404).json({
          error:
            'User not found'
        });

      }


      res.json({
        user:
          result.rows[0]
      });


    } catch (error) {

      console.error(
        'ADMIN USER UPDATE ERROR:',
        error
      );


      res.status(500).json({
        error:
          'Unable to update user'
      });

    }

  }
);


/* =========================
   404 API HANDLER
========================= */

app.use(
  '/api',
  (req, res) => {

    res.status(404).json({
      error:
        'API endpoint not found'
    });

  }
);


/* =========================
   GENERAL ERROR HANDLER
========================= */

app.use(
  (error, req, res, next) => {

    console.error(
      'SERVER ERROR:',
      error
    );


    if (res.headersSent) {
      return next(error);
    }


    res.status(500).json({
      error:
        'Internal server error'
    });

  }
);


/* =========================
   START SERVER
========================= */

async function startServer() {

  try {

    console.log(
      'Checking database connection...'
    );


    await q(
      'SELECT 1'
    );


    console.log(
      'Database connection successful.'
    );


    app.listen(
      PORT,
      () => {

        console.log(
          `FAST07 API running on port ${PORT}`
        );

      }
    );


  } catch (error) {

    console.error(
      'DATABASE CONNECTION FAILED:'
    );

    console.error(
      error
    );


    process.exit(1);

  }

}


startServer();
