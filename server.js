const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'investment_system',
  charset: 'utf8mb4'
};

const WORKFLOW_URL = process.env.COZE_WORKFLOW_URL || 'https://6vt93q3vyd.coze.site/run';
const sessionStore = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24;
let pool;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, stored) => {
  const [salt, originalHash] = (stored || '').split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
};

const getTokenFromHeader = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

function safeJsonParse(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function normalizeWorkflowResponse(payload) {
  const root = safeJsonParse(payload);
  if (!root || typeof root !== 'object') return { raw: payload };
  if (Array.isArray(root.output)) {
    const outputItem = root.output.find((item) => item && item.type === 'json' && item.content) || root.output[0];
    if (outputItem && outputItem.content) return safeJsonParse(outputItem.content);
  }
  if (root.data && typeof root.data === 'string') return safeJsonParse(root.data);
  return root;
}

async function ensureDb() {
  const bootstrapConn = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    charset: 'utf8mb4'
  });
  await bootstrapConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await bootstrapConn.end();

  pool = mysql.createPool({ ...dbConfig, connectionLimit: 10 });
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS workflow_records (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      user_input TEXT NOT NULL,
      workflow_url VARCHAR(255) NOT NULL,
      token_mask VARCHAR(30),
      response_json LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_time(user_id, created_at DESC),
      CONSTRAINT fk_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

function authMiddleware(req, res, next) {
  const token = getTokenFromHeader(req);
  const session = sessionStore.get(token);
  if (!token || !session) return res.status(401).json({ error: '未登录或会话已失效' });
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessionStore.delete(token);
    return res.status(401).json({ error: '会话已过期，请重新登录' });
  }
  req.user = session.user;
  req.sessionToken = token;
  return next();
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    await pool.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username.trim(), hashPassword(password)]);
    return res.json({ message: '注册成功，请登录' });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '用户名已存在' });
    console.error('register error:', err);
    return res.status(500).json({ error: '注册失败' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const [rows] = await pool.query('SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1', [username]);
    if (!rows.length || !verifyPassword(password || '', rows[0].password_hash)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    sessionStore.set(token, { createdAt: Date.now(), user: { id: rows[0].id, username: rows[0].username } });
    return res.json({ token, user: { id: rows[0].id, username: rows[0].username } });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: '登录失败' });
  }
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  sessionStore.delete(req.sessionToken);
  res.json({ message: '已退出登录' });
});

app.get('/api/history', authMiddleware, async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize || 5), 1), 20);
  const offset = (page - 1) * pageSize;
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM workflow_records WHERE user_id = ?', [req.user.id]);
  const [rows] = await pool.query('SELECT id, user_input, workflow_url, token_mask, created_at FROM workflow_records WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', [req.user.id, pageSize, offset]);
  res.json({
    total, page, pageSize,
    items: rows.map((row) => ({
      id: row.id,
      user_input: row.user_input,
      created_at: row.created_at,
      workflow_url: row.workflow_url,
      token_mask: row.token_mask
    }))
  });
});

app.get('/api/history/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: '无效的记录ID' });

  const [rows] = await pool.query(
    'SELECT id, user_input, workflow_url, token_mask, response_json, created_at FROM workflow_records WHERE id = ? AND user_id = ? LIMIT 1',
    [id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: '记录不存在' });

  const row = rows[0];
  return res.json({
    id: row.id,
    user_input: row.user_input,
    workflow_url: row.workflow_url,
    token_mask: row.token_mask,
    created_at: row.created_at,
    response: safeJsonParse(row.response_json)
  });
});

app.post('/api/run', authMiddleware, async (req, res) => {
  try {
    const { user_input, workflow_token } = req.body || {};
    if (!user_input || !workflow_token) return res.status(400).json({ error: 'user_input 和 workflow_token 都是必填项' });

    const response = await fetch(WORKFLOW_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${workflow_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_input })
    });

    const rawText = await response.text();
    const normalized = normalizeWorkflowResponse(rawText);
    if (!response.ok) return res.status(response.status).json({ error: '工作流请求失败', detail: normalized || rawText });

    const tokenMask = `${workflow_token.slice(0, 4)}****${workflow_token.slice(-4)}`;
    await pool.query('INSERT INTO workflow_records (user_id, user_input, workflow_url, token_mask, response_json) VALUES (?, ?, ?, ?, ?)', [req.user.id, user_input, WORKFLOW_URL, tokenMask, JSON.stringify(normalized)]);
    return res.json({ data: normalized });
  } catch (error) {
    console.error('run error:', error);
    return res.status(500).json({ error: '代理请求失败', detail: error.message });
  }
});

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', db: 'connected' }); }
  catch (err) { res.status(500).json({ status: 'error', db: 'disconnected', detail: err.message }); }
});

ensureDb().then(() => {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}).catch((err) => {
  console.error('DB init failed:', err);
  process.exit(1);
});
