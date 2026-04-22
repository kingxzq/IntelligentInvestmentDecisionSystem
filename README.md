# Intelligent Investment Decision System

## 1. 功能说明

本系统提供：

1. 登录/注册后访问系统。
2. 将用户画像文本发送到 Coze 工作流。
3. 将决策输入参数与输出结果保存到 MySQL 5.7。
4. 分页查看历史决策记录。
5. 点击历史记录后：
   - 查看该次决策的输入参数（user_input）
   - 查看该次决策的输出参数（workflow response JSON）
   - 在首页复现同样的六模块展示界面：
     1) market_intelligence
     2) risk_calculation
     3) asset_allocation
     4) investment_calculator
     5) risk_assessment
     6) investment_strategy

---

## 2. 部署说明

### 2.1 环境要求

- Node.js 18+
- MySQL 5.7
- 可访问 Coze 工作流地址

### 2.2 安装依赖

```bash
npm install
```

> 若公司网络限制 npm 源，请配置内部镜像后再安装依赖。

### 2.3 配置环境变量

可选环境变量：

- `PORT`：服务端口，默认 `3000`
- `DB_HOST`：MySQL 地址，默认 `127.0.0.1`
- `DB_PORT`：MySQL 端口，默认 `3306`
- `DB_USER`：MySQL 用户，默认 `root`
- `DB_PASSWORD`：MySQL 密码，默认空
- `DB_NAME`：数据库名，默认 `investment_system`
- `COZE_WORKFLOW_URL`：工作流 URL，默认 `https://6vt93q3vyd.coze.site/run`

Linux/macOS 示例：

```bash
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_USER=root
export DB_PASSWORD=123456
export DB_NAME=investment_system
export COZE_WORKFLOW_URL=https://6vt93q3vyd.coze.site/run
```

### 2.4 启动服务

```bash
npm start
```

启动后访问：

- `http://localhost:3000`

系统会在启动时自动创建数据库和表：

- `users`
- `workflow_records`
- `workflow_response_core`
- `module_market_intelligence`
- `module_risk_calculation`
- `module_asset_allocation`
- `module_investment_calculator`
- `module_risk_assessment`
- `module_investment_strategy`

---

## 3. 使用说明

1. 打开首页后先注册用户，再登录。
2. 输入 `Coze Workflow Token` 和用户画像文本，点击“发送到工作流并保存结果”。
3. 在“历史记录”中可翻页查看已保存的决策。
4. 点击“查看参数并复现六模块”：
   - 下方会展示该条记录的输入参数与输出参数
   - 同时在“流程分页展示”中复现六个模块内容

---

## 4. 数据库查看示例

```sql
USE investment_system;

SELECT id, username, created_at
FROM users
ORDER BY id DESC;

SELECT id, user_id, LEFT(user_input, 120) AS input_preview, created_at
FROM workflow_records
ORDER BY id DESC;
```

查看某条记录完整输出（按六个模块拆表存储）：

```sql
SELECT wr.id,
       mmi.market_intelligence_report,
       mrc.risk_metrics_json,
       maa.asset_allocation_model_json,
       mic.investment_calculation_json,
       mra.risk_assessment_report,
       mis.investment_advice
FROM workflow_records wr
LEFT JOIN module_market_intelligence mmi ON mmi.record_id = wr.id
LEFT JOIN module_risk_calculation mrc ON mrc.record_id = wr.id
LEFT JOIN module_asset_allocation maa ON maa.record_id = wr.id
LEFT JOIN module_investment_calculator mic ON mic.record_id = wr.id
LEFT JOIN module_risk_assessment mra ON mra.record_id = wr.id
LEFT JOIN module_investment_strategy mis ON mis.record_id = wr.id
WHERE wr.id = 1;
```

---

## 5. 常见问题

1. **npm install 失败**
   - 检查网络策略和 npm registry 权限。
2. **数据库连接失败**
   - 检查 MySQL 是否启动、账号密码是否正确、端口是否开放。
3. **工作流返回解析异常**
   - 系统已兼容字符串 JSON 与嵌套输出格式，如仍异常，请检查工作流返回结构。
