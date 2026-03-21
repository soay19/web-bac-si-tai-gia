require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool, initDb, isDbDisabled } = require('./db');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const allowedKeyRegex = /^[a-zA-Z0-9_-]{1,120}$/;

const normalizeValue = (value) => {
  if (typeof value === 'undefined') {
    return null;
  }
  return value;
};

const parseStateValue = (value) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }
  return value;
};

const isDbReady = () => !isDbDisabled && !!pool;

app.get('/api/health', async (_req, res) => {
  if (!isDbReady()) {
    return res.json({ ok: true, database: 'disabled' });
  }

  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true, database: 'connected' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Database unavailable' });
  }
});

app.get('/api/state', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const keysParam = String(req.query.keys || '').trim();

    if (!keysParam) {
      const [rows] = await pool.query('SELECT state_key, state_value FROM app_state');
      const data = {};
      rows.forEach((row) => {
        data[row.state_key] = parseStateValue(row.state_value);
      });
      return res.json({ data });
    }

    const keys = keysParam
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((key) => allowedKeyRegex.test(key));

    if (!keys.length) {
      return res.json({ data: {} });
    }

    const placeholders = keys.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT state_key, state_value FROM app_state WHERE state_key IN (${placeholders})`,
      keys
    );

    const rowMap = new Map(rows.map((row) => [row.state_key, parseStateValue(row.state_value)]));
    const data = {};
    keys.forEach((key) => {
      data[key] = rowMap.has(key) ? rowMap.get(key) : null;
    });

    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ message: 'Cannot fetch state', error: error.message });
  }
});

app.put('/api/state/:key', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const key = String(req.params.key || '').trim();
    if (!allowedKeyRegex.test(key)) {
      return res.status(400).json({ message: 'Invalid key format' });
    }

    const value = normalizeValue(req.body.value);
    await pool.query(
      `
      INSERT INTO app_state (state_key, state_value)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE state_value = VALUES(state_value)
      `,
      [key, JSON.stringify(value)]
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'Cannot store state', error: error.message });
  }
});

app.delete('/api/state/:key', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const key = String(req.params.key || '').trim();
    if (!allowedKeyRegex.test(key)) {
      return res.status(400).json({ message: 'Invalid key format' });
    }

    await pool.query('DELETE FROM app_state WHERE state_key = ?', [key]);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'Cannot delete state', error: error.message });
  }
});

initDb()
  .then(() => {
    app.listen(port, () => {
      if (isDbDisabled) {
        console.log(`THAT Clinic backend listening on http://localhost:${port} (MySQL disabled)`);
      } else {
        console.log(`THAT Clinic backend listening on http://localhost:${port}`);
      }
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  });

const closePool = async () => {
  if (pool) {
    await pool.end();
  }
};

process.on('SIGINT', () => {
  closePool().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  closePool().finally(() => process.exit(0));
});
