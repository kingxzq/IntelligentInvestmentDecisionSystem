// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // 需要安装 node-fetch@2

const app = express();
const PORT = 3000;

// 允许前端跨域访问（如果你前端运行在不同端口）
app.use(cors());
app.use(express.json());

app.post('/api/run', async (req, res) => {
    try {
        const { user_input } = req.body;
        const token = req.headers.authorization; // 从请求头中获取 Bearer token

        const response = await fetch('https://6vt93q3vyd.coze.site/run', {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_input })
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: '代理请求失败' });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running at http://localhost:${PORT}`);
});