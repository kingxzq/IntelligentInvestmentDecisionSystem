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
let systemUserId = null;
const SYSTEM_USERNAME = process.env.SYSTEM_USERNAME || "system_guest";

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

function extractModulePayload(normalized) {
  const payload = normalized && typeof normalized === 'object' ? normalized : {};
  return {
    core: {
      user_profile: payload.user_profile ?? null,
      raw_response: payload
    },
    market_intelligence: {
      market_intelligence_report: payload.market_intelligence_report ?? null,
      market_realtime_data: payload.market_realtime_data ?? null
    },
    risk_calculation: {
      risk_metrics: payload.risk_metrics ?? null
    },
    asset_allocation: {
      asset_allocation_model: payload.asset_allocation_model ?? null
    },
    investment_calculator: {
      investment_calculation: payload.investment_calculation ?? null,
      visualization_data: payload.visualization_data ?? null
    },
    risk_assessment: {
      risk_assessment_report: payload.risk_assessment_report ?? null
    },
    investment_strategy: {
      investment_advice: payload.investment_advice ?? null
    }
  };
}

async function saveWorkflowModules(connection, recordId, normalized) {
  const modulePayload = extractModulePayload(normalized);
  await connection.query(
    `INSERT INTO workflow_response_core (record_id, user_profile_json, raw_response_json)
     VALUES (?, ?, ?)`,
    [recordId, JSON.stringify(modulePayload.core.user_profile), JSON.stringify(modulePayload.core.raw_response)]
  );
  await connection.query(
    `INSERT INTO module_market_intelligence (record_id, market_intelligence_report, market_realtime_data_json)
     VALUES (?, ?, ?)`,
    [recordId, modulePayload.market_intelligence.market_intelligence_report, JSON.stringify(modulePayload.market_intelligence.market_realtime_data)]
  );
  await connection.query(
    `INSERT INTO module_risk_calculation (record_id, risk_metrics_json)
     VALUES (?, ?)`,
    [recordId, JSON.stringify(modulePayload.risk_calculation.risk_metrics)]
  );
  await connection.query(
    `INSERT INTO module_asset_allocation (record_id, asset_allocation_model_json)
     VALUES (?, ?)`,
    [recordId, JSON.stringify(modulePayload.asset_allocation.asset_allocation_model)]
  );
  await connection.query(
    `INSERT INTO module_investment_calculator (record_id, investment_calculation_json, visualization_data_json)
     VALUES (?, ?, ?)`,
    [
      recordId,
      JSON.stringify(modulePayload.investment_calculator.investment_calculation),
      JSON.stringify(modulePayload.investment_calculator.visualization_data)
    ]
  );
  await connection.query(
    `INSERT INTO module_risk_assessment (record_id, risk_assessment_report)
     VALUES (?, ?)`,
    [recordId, modulePayload.risk_assessment.risk_assessment_report]
  );
  await connection.query(
    `INSERT INTO module_investment_strategy (record_id, investment_advice)
     VALUES (?, ?)`,
    [recordId, modulePayload.investment_strategy.investment_advice]
  );
}

async function ensureSystemUser() {
  if (systemUserId) return systemUserId;
  const [rows] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [SYSTEM_USERNAME]);
  if (rows.length) {
    systemUserId = rows[0].id;
    return systemUserId;
  }
  const [result] = await pool.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [SYSTEM_USERNAME, hashPassword('guest_not_used')]);
  systemUserId = result.insertId;
  return systemUserId;
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
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_time(user_id, created_at DESC),
      CONSTRAINT fk_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS workflow_response_core (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      record_id BIGINT NOT NULL UNIQUE,
      user_profile_json LONGTEXT,
      raw_response_json LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_core_record FOREIGN KEY (record_id) REFERENCES workflow_records(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS module_market_intelligence (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      record_id BIGINT NOT NULL UNIQUE,
      market_intelligence_report LONGTEXT,
      market_realtime_data_json LONGTEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_market_record FOREIGN KEY (record_id) REFERENCES workflow_records(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS module_risk_calculation (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      record_id BIGINT NOT NULL UNIQUE,
      risk_metrics_json LONGTEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_risk_calc_record FOREIGN KEY (record_id) REFERENCES workflow_records(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS module_asset_allocation (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      record_id BIGINT NOT NULL UNIQUE,
      asset_allocation_model_json LONGTEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_asset_record FOREIGN KEY (record_id) REFERENCES workflow_records(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS module_investment_calculator (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      record_id BIGINT NOT NULL UNIQUE,
      investment_calculation_json LONGTEXT,
      visualization_data_json LONGTEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_calc_record FOREIGN KEY (record_id) REFERENCES workflow_records(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS module_risk_assessment (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      record_id BIGINT NOT NULL UNIQUE,
      risk_assessment_report LONGTEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_assess_record FOREIGN KEY (record_id) REFERENCES workflow_records(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS module_investment_strategy (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      record_id BIGINT NOT NULL UNIQUE,
      investment_advice LONGTEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_strategy_record FOREIGN KEY (record_id) REFERENCES workflow_records(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureSystemUser();
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

app.post('/api/auth/logout', (_req, res) => {
  res.json({ message: '登录界面已移除，无需退出登录' });
});

app.get('/api/history', async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize || 5), 1), 20);
  const offset = (page - 1) * pageSize;
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM workflow_records');
  const [rows] = await pool.query('SELECT id, user_input, workflow_url, token_mask, created_at FROM workflow_records ORDER BY created_at DESC LIMIT ? OFFSET ?', [pageSize, offset]);
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

app.get('/api/history/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: '无效的记录ID' });

  const [rows] = await pool.query(
    `SELECT wr.id, wr.user_input, wr.workflow_url, wr.token_mask, wr.created_at,
            wrc.raw_response_json, wrc.user_profile_json,
            mmi.market_intelligence_report, mmi.market_realtime_data_json,
            mrc.risk_metrics_json,
            maa.asset_allocation_model_json,
            mic.investment_calculation_json, mic.visualization_data_json,
            mra.risk_assessment_report,
            mis.investment_advice
       FROM workflow_records wr
       LEFT JOIN workflow_response_core wrc ON wrc.record_id = wr.id
       LEFT JOIN module_market_intelligence mmi ON mmi.record_id = wr.id
       LEFT JOIN module_risk_calculation mrc ON mrc.record_id = wr.id
       LEFT JOIN module_asset_allocation maa ON maa.record_id = wr.id
       LEFT JOIN module_investment_calculator mic ON mic.record_id = wr.id
       LEFT JOIN module_risk_assessment mra ON mra.record_id = wr.id
       LEFT JOIN module_investment_strategy mis ON mis.record_id = wr.id
      WHERE wr.id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: '记录不存在' });

  const row = rows[0];
  const fallbackResponse = {
    user_profile: safeJsonParse(row.user_profile_json),
    market_intelligence_report: row.market_intelligence_report,
    market_realtime_data: safeJsonParse(row.market_realtime_data_json),
    risk_metrics: safeJsonParse(row.risk_metrics_json),
    asset_allocation_model: safeJsonParse(row.asset_allocation_model_json),
    investment_calculation: safeJsonParse(row.investment_calculation_json),
    visualization_data: safeJsonParse(row.visualization_data_json),
    risk_assessment_report: row.risk_assessment_report,
    investment_advice: row.investment_advice
  };

  return res.json({
    id: row.id,
    user_input: row.user_input,
    workflow_url: row.workflow_url,
    token_mask: row.token_mask,
    created_at: row.created_at,
    response: safeJsonParse(row.raw_response_json) || fallbackResponse,
    module_data: fallbackResponse
  });
});

app.post('/api/run', async (req, res) => {
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
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const defaultUserId = await ensureSystemUser();
      const [insertResult] = await connection.query(
        'INSERT INTO workflow_records (user_id, user_input, workflow_url, token_mask) VALUES (?, ?, ?, ?)',
        [defaultUserId, user_input, WORKFLOW_URL, tokenMask]
      );
      await saveWorkflowModules(connection, insertResult.insertId, normalized);
      await connection.commit();
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }
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
