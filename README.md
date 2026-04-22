# Intelligent Investment Decision System

## 1. 功能说明

本系统提供：

1. 登录/注册后访问系统。
2. 首页总览页面发送用户画像至 Coze 工作流并以图表展示结果（不再展示原始 JSON 面板）。
3. 历史记录独立页面分页查看数据库中的历史决策。
4. 点击历史记录可查看输入参数与输出参数，并复现六模块页面。
5. 六个业务模块独立页面展示：
   1) market_intelligence（市场情报）  
   2) risk_calculation（风险计算）  
   3) asset_allocation（资产配置）  
   4) investment_calculator（投资计算）  
   5) risk_assessment（风险评估）  
   6) investment_strategy（投资策略）
6. 系统默认内置一份示例返回数据，登录后可直接看到完整页面效果。

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

### 2.3 配置环境变量

可选环境变量：

- `PORT`：服务端口，默认 `3000`
- `DB_HOST`：MySQL 地址，默认 `127.0.0.1`
- `DB_PORT`：MySQL 端口，默认 `3306`
- `DB_USER`：MySQL 用户，默认 `root`
- `DB_PASSWORD`：MySQL 密码，默认空
- `DB_NAME`：数据库名，默认 `investment_system`
- `COZE_WORKFLOW_URL`：工作流 URL，默认 `https://6vt93q3vyd.coze.site/run`

Windows 11（PowerShell，MySQL 密码为 `12345678`）：

```powershell
setx DB_HOST "127.0.0.1"
setx DB_PORT "3306"
setx DB_USER "root"
setx DB_PASSWORD "12345678"
setx DB_NAME "investment_system"
setx COZE_WORKFLOW_URL "https://6vt93q3vyd.coze.site/run"
```

> `setx` 对新开的终端生效；设置后请重新打开 PowerShell / CMD。

### 2.4 启动服务

```bash
npm start
```

启动后访问：`http://localhost:3000`

### 2.5 手动建库建表（可选）

```powershell
mysql -uroot -p12345678 < .\db\init_mysql57.sql
```

或进入 MySQL 后执行：

```sql
SOURCE D:/your-project-path/IntelligentInvestmentDecisionSystem/db/init_mysql57.sql;
```

---

## 3. 使用说明

1. 注册并登录。
2. 首页总览输入 `workflow token` 和人物画像文本，点击“发送到工作流并保存结果”。
3. 返回结果会在首页 KPI 与图表组件中展示，并可通过模块按钮跳转到对应模块页面。
4. 进入“历史记录”页面，可翻页查看历史数据。
5. 历史页采用图表+时间线分页展示，点击时间线“复现并进入模块1”可还原该次结果并跳转模块页。

---

## 4. 数据库详细设计（表结构与关联关系）

数据库名：`investment_system`

### 4.1 核心实体

- `users`：系统用户表
- `workflow_records`：每次调用工作流的主记录（输入、用户、调用信息）
- `workflow_response_core`：完整响应主表（归一化后的整包 JSON）
- 六个模块表（每个模块至少一张表）：
  - `module_market_intelligence`
  - `module_risk_calculation`
  - `module_asset_allocation`
  - `module_investment_calculator`
  - `module_risk_assessment`
  - `module_investment_strategy`

### 4.2 字段说明（重点字段）

#### 1) users

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 用户主键 |
| username | VARCHAR(64) UNIQUE | 登录用户名 |
| password_hash | VARCHAR(255) | 密码哈希 |
| created_at | DATETIME | 创建时间 |

#### 2) workflow_records

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 记录主键 |
| user_id | BIGINT FK -> users.id | 所属用户 |
| workflow_url | VARCHAR(255) | 调用的工作流地址 |
| token_mask | VARCHAR(64) | token 脱敏信息 |
| user_input | LONGTEXT | 输入人物画像文本 |
| created_at | DATETIME | 创建时间 |

#### 3) workflow_response_core

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 主键 |
| record_id | BIGINT FK -> workflow_records.id UNIQUE | 对应一次调用记录（1:1） |
| response_json | LONGTEXT | 归一化后的完整响应 JSON |
| created_at | DATETIME | 创建时间 |

#### 4) module_market_intelligence

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 主键 |
| record_id | BIGINT FK -> workflow_records.id UNIQUE | 对应记录（1:1） |
| market_intelligence_report | LONGTEXT | 市场情报报告文本 |
| market_realtime_data_json | LONGTEXT | 市场实时数据 JSON |
| created_at | DATETIME | 创建时间 |

#### 5) module_risk_calculation

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 主键 |
| record_id | BIGINT FK -> workflow_records.id UNIQUE | 对应记录（1:1） |
| risk_metrics_json | LONGTEXT | 风险计算指标 JSON |
| created_at | DATETIME | 创建时间 |

#### 6) module_asset_allocation

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 主键 |
| record_id | BIGINT FK -> workflow_records.id UNIQUE | 对应记录（1:1） |
| asset_allocation_model_json | LONGTEXT | 资产配置模型 JSON |
| created_at | DATETIME | 创建时间 |

#### 7) module_investment_calculator

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 主键 |
| record_id | BIGINT FK -> workflow_records.id UNIQUE | 对应记录（1:1） |
| investment_calculation_json | LONGTEXT | 投资计算 JSON |
| visualization_data_json | LONGTEXT | 图表可视化 JSON |
| created_at | DATETIME | 创建时间 |

#### 8) module_risk_assessment

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 主键 |
| record_id | BIGINT FK -> workflow_records.id UNIQUE | 对应记录（1:1） |
| risk_assessment_report | LONGTEXT | 风险评估文本 |
| created_at | DATETIME | 创建时间 |

#### 9) module_investment_strategy

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT PK | 主键 |
| record_id | BIGINT FK -> workflow_records.id UNIQUE | 对应记录（1:1） |
| investment_advice | LONGTEXT | 投资建议文本 |
| user_profile_json | LONGTEXT | 用户画像结构化 JSON |
| created_at | DATETIME | 创建时间 |

### 4.3 表关联关系（ER 关系）

1. `users (1) -> (N) workflow_records`  
   一个用户可产生多次决策记录。

2. `workflow_records (1) -> (1) workflow_response_core`  
   每次记录有一份完整归一化响应。

3. `workflow_records (1) -> (1) 六个模块表`  
   每次记录在六个模块表各有一行（通过 `record_id` 关联），确保“每个模块至少一张表”的结构化落库。

4. 删除策略（在初始化 SQL 中使用 `ON DELETE CASCADE`）  
   删除 `workflow_records` 会级联删除 `workflow_response_core` 与六个模块表数据，避免孤儿数据。

### 4.4 快速查询 SQL

```sql
USE investment_system;

-- 查看用户
SELECT id, username, created_at FROM users ORDER BY id DESC;

-- 查看主记录
SELECT id, user_id, LEFT(user_input, 120) AS input_preview, created_at
FROM workflow_records
ORDER BY id DESC;

-- 按 record_id 联表查看六模块
SELECT wr.id,
       wrc.response_json,
       mmi.market_intelligence_report,
       mrc.risk_metrics_json,
       maa.asset_allocation_model_json,
       mic.investment_calculation_json,
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
WHERE wr.id = 1;
```

---

## 5. 常见问题

1. **`npm install` 失败**：检查 npm 镜像与网络策略。
2. **数据库连接失败**：确认 MySQL 服务、账号密码、端口与环境变量。
3. **工作流返回解析异常**：系统兼容字符串 JSON 与嵌套 JSON；若返回结构变动，请同步调整解析逻辑。
