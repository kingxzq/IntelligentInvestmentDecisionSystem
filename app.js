(() => {
  const sampleDca = Array.from({ length: 60 }, (_, i) => {
    const month = i + 1;
    const invested = Math.round(1333.33 * month * 100) / 100;
    const value = Math.round((1333.33 * month + month * month * 18.2) * 100) / 100;
    return { 月份: month, 累计投入: invested, 累计价值: value, 累计收益: Math.round((value - invested) * 100) / 100 };
  });

  const DEFAULT_DATA = {
    investment_advice: '## 📝 您的个性化投资建议报告\n\n建议维持激进风格，但按半年再平衡，控制回撤。\n1) 核心配置以沪深300/中证500/创业板为主；\n2) 科技与新能源保留弹性仓位；\n3) 回撤超过20%时降低风险仓位。',
    user_profile: {
      basic: { age_group: '25-35', income_range: '10-30万', investable_assets: 80000, asset_currency: 'CNY' },
      goal: { investment_horizon: '长期（3年以上）', specific_goal: '资产增值', expected_return: '追求高收益>10%' },
      risk_tolerance: { max_loss_acceptance: '>20%', investment_experience: '少量经验', income_stability: '稳定', risk_level: '激进型' },
      preferences: { preferred_sectors: ['教育', 'AI'], esg_preference: '无明确偏好', liquidity_needs: '无随时支取需求' }
    },
    asset_allocation_model: {
      风险等级: '激进型', 核心理念: '追求高收益，承受高风险',
      配置比例: { 股票类: 0.8, 债券类: 0.1, 现金及等价物: 0.05, 另类投资: 0.05 },
      预期年化收益: '12-15%', 预期最大回撤: '20%',
      详细配置: { 沪深300指数基金: 30.4, 中证500指数基金: 24.8, 创业板ETF: 15.2, 科技ETF: 8, 新能源ETF: 1.6, 信用债基金: 10, 货币市场基金: 5, 黄金ETF: 5 }
    },
    investment_calculation: {
      复利计算: { 期末价值: 128840.8, 总收益率: 61.05 },
      定投计算: { 期末价值: 103249.43, 总收益率: 29.06 },
      定投收益曲线: sampleDca,
      不同持有期限收益: [{ 持有年限: 1, 总收益率: 10 }, { 持有年限: 3, 总收益率: 33.1 }, { 持有年限: 5, 总收益率: 61.05 }, { 持有年限: 10, 总收益率: 159.37 }],
      不同情景分析: [{ 情景: '悲观', 总收益率: 27.63 }, { 情景: '基准', 总收益率: 61.05 }, { 情景: '乐观', 总收益率: 101.14 }],
      各资产预期收益: { 沪深300指数基金: { 预期年化收益: 10 }, 中证500指数基金: { 预期年化收益: 10 }, 创业板ETF: { 预期年化收益: 10 }, 科技ETF: { 预期年化收益: 10 }, 新能源ETF: { 预期年化收益: 10 }, 信用债基金: { 预期年化收益: 10 }, 货币市场基金: { 预期年化收益: 2.5 }, 黄金ETF: { 预期年化收益: 5 } }
    }
  };

  const tabs = [
    { id: 'page1', text: '分页1 用户描述与方案' },
    { id: 'page2', text: '分页2 配置饼图与定投曲线' },
    { id: 'page3', text: '分页3 收益对比分析' },
    { id: 'page4', text: '分页4 投资建议报告' },
    { id: 'page5', text: '分页5 历史记录' }
  ];

  const state = { currentTab: 'page1', selected: DEFAULT_DATA, history: [], historyPage: 1, historyPageSize: 6, historyTotal: 0 };
  const el = (id) => document.getElementById(id);
  const get = (obj, path, fallback = null) => path.reduce((a, k) => a && a[k] !== undefined ? a[k] : null, obj) ?? fallback;

  function api(path, options = {}) { return fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } }); }
  function initChart(id, option) {
    const dom = document.getElementById(id);
    if (!dom) return;
    if (!window.echarts) {
      dom.innerHTML = '<div style="padding:16px;color:#6b7280;">图表库加载失败（CDN不可达），已保留默认示例数据文本。</div>';
      return;
    }
    window.echarts.init(dom).setOption(option);
  }

  function renderTabs() {
    const t = el('tabList'); t.innerHTML = '';
    tabs.forEach((x) => {
      const btn = document.createElement('button');
      btn.className = `tab-btn ${state.currentTab === x.id ? 'active' : ''}`;
      btn.textContent = x.text;
      btn.onclick = () => switchTab(x.id);
      t.appendChild(btn);
    });
  }

  function switchTab(id) {
    state.currentTab = id;
    renderTabs();
    tabs.forEach((x) => el(x.id).classList.toggle('hidden', x.id !== id));
    renderAllPages();
  }

  async function runWorkflow() {
    const workflow_token = el('workflowToken').value.trim();
    const user_input = el('userInput').value.trim();
    const resp = await api('/api/run', { method: 'POST', body: JSON.stringify({ workflow_token, user_input }) });
    const data = await resp.json();
    if (!resp.ok) return alert(data.error || '调用失败');
    state.selected = data.data || DEFAULT_DATA;
    renderAllPages();
    loadHistory(1);
  }

  async function loadHistory(page = state.historyPage) {
    state.historyPage = page;
    const resp = await api(`/api/history?page=${page}&pageSize=${state.historyPageSize}`);
    const data = await resp.json();
    if (!resp.ok) return alert(data.error || '历史加载失败');
    state.history = data.items || [];
    state.historyTotal = data.total || 0;
    if (state.currentTab === 'page5') renderPage5();
  }

  async function replayRecord(id) {
    const resp = await api(`/api/history/${id}`);
    const data = await resp.json();
    if (!resp.ok) return alert(data.error || '加载失败');
    state.selected = data.response || DEFAULT_DATA;
    switchTab('page1');
  }

  function renderPage1() {
    const p = state.selected.user_profile || {};
    const asset = state.selected.asset_allocation_model || {};
    const calc = state.selected.investment_calculation || {};
    el('page1').innerHTML = `
      <div class="card" style="margin:0 0 12px 0;">
        <label>用户描述</label>
        <div class="row">
          <textarea id="userInput">我今年25岁职场新人，年收入14万，每年8万可用于投资，投资期限3年以上，目标资产增值，期望年化收益>10%，可接受回撤>20%，偏好教育和AI。</textarea>
          <div>
            <label>Bearer Token</label>
            <input id="workflowToken" type="password" placeholder="输入Token" />
            <div class="row" style="margin-top:10px;">
              <button id="runBtn" class="primary">生成投资方案</button>
              <button id="loadSampleBtn" class="secondary">加载示例</button>
            </div>
          </div>
        </div>
      </div>
      <div class="row-3">
        <div class="card"><h3>用户画像</h3><div><span class="pill">${get(p,['basic','age_group'],'-')}</span><span class="pill">年收入 ${get(p,['basic','income_range'],'-')}</span><span class="pill">可投资 ¥${get(p,['basic','investable_assets'],'-')}</span><span class="pill">风险 ${get(p,['risk_tolerance','risk_level'],'-')}</span><span class="pill">偏好 ${(get(p,['preferences','preferred_sectors'],[])||[]).join('、')}</span></div><div class="value-row"><span>投资目标</span><b>${get(p,['goal','specific_goal'],'-')}</b></div><div class="value-row"><span>预期收益</span><b>${get(p,['goal','expected_return'],'-')}</b></div><div class="value-row"><span>期限</span><b>${get(p,['goal','investment_horizon'],'-')}</b></div></div>
        <div class="card"><h3>核心配置</h3><div class="value-row"><span>股票类</span><b>${Math.round((get(asset,['配置比例','股票类'],0))*100)}%</b></div><div class="value-row"><span>债券类</span><b>${Math.round((get(asset,['配置比例','债券类'],0))*100)}%</b></div><div class="value-row"><span>现金/另类</span><b>${Math.round((get(asset,['配置比例','现金及等价物'],0)*100 + get(asset,['配置比例','另类投资'],0)*100))}%</b></div><div class="value-row"><span>预期年化</span><b>${asset['预期年化收益'] || '-'}</b></div><div class="value-row"><span>最大回撤</span><b>${asset['预期最大回撤'] || '-'}</b></div></div>
        <div class="card"><h3>收益模拟</h3><div class="value-row"><span>5年复利终值</span><b>¥${get(calc,['复利计算','期末价值'],'-')}</b></div><div class="value-row"><span>复利总收益率</span><b>${get(calc,['复利计算','总收益率'],'-')}%</b></div><div class="value-row"><span>5年定投终值</span><b>¥${get(calc,['定投计算','期末价值'],'-')}</b></div><div class="value-row"><span>定投收益率</span><b>${get(calc,['定投计算','总收益率'],'-')}%</b></div></div>
      </div>`;
    el('runBtn').onclick = runWorkflow;
    el('loadSampleBtn').onclick = () => { state.selected = DEFAULT_DATA; renderAllPages(); };
  }

  function renderPage2() {
    const d = state.selected;
    el('page2').innerHTML = `<div class="row"><div class="card"><h3>资产配置饼图</h3><div id="assetPie" class="chart"></div></div><div class="card"><h3>定投收益曲线</h3><div id="dcaLine" class="chart"></div></div></div>`;
    const details = get(d, ['asset_allocation_model', '详细配置'], {});
    initChart('assetPie', { tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ['40%', '70%'], data: Object.keys(details).map(k => ({ name: k, value: details[k] })) }] });
    const line = get(d, ['investment_calculation', '定投收益曲线'], []);
    initChart('dcaLine', { tooltip: { trigger: 'axis' }, legend: { data: ['累计投入', '累计价值', '累计收益'] }, xAxis: { type: 'category', data: line.map(i => i.月份) }, yAxis: { type: 'value' }, series: [{ type: 'line', name: '累计投入', data: line.map(i => i.累计投入), smooth: true }, { type: 'line', name: '累计价值', data: line.map(i => i.累计价值), smooth: true }, { type: 'line', name: '累计收益', data: line.map(i => i.累计收益), smooth: true }] });
  }

  function renderPage3() {
    const d = state.selected;
    el('page3').innerHTML = `<div class="row-3"><div class="card"><h3>情景收益对比</h3><div id="sceneBar" class="chart-sm"></div></div><div class="card"><h3>各资产预期收益</h3><div id="assetReturnBar" class="chart-sm"></div></div><div class="card"><h3>不同持有期收益</h3><div id="holdingLine" class="chart-sm"></div></div></div>`;
    const scene = get(d, ['investment_calculation', '不同情景分析'], []);
    initChart('sceneBar', { xAxis: { type: 'category', data: scene.map(i => i.情景) }, yAxis: { type: 'value', name: '总收益率%' }, series: [{ type: 'bar', data: scene.map(i => i.总收益率) }] });
    const ar = get(d, ['investment_calculation', '各资产预期收益'], {}); const names = Object.keys(ar); const vals = names.map(k => get(ar,[k,'预期年化收益'],0));
    initChart('assetReturnBar', { xAxis: { type:'category', data:names, axisLabel:{ rotate: 28 } }, yAxis:{ type:'value', name:'年化%' }, series:[{ type:'bar', data: vals }] });
    const hp = get(d, ['investment_calculation', '不同持有期限收益'], []);
    initChart('holdingLine', { xAxis: { type:'category', data: hp.map(i => i.持有年限) }, yAxis: { type:'value', name:'总收益率%' }, series:[{ type:'line', data: hp.map(i => i.总收益率), smooth:true }] });
  }

  function renderPage4() { el('page4').innerHTML = `<h3>投资建议报告</h3><div class="report">${state.selected.investment_advice || '暂无建议报告'}</div>`; }

  function renderPage5() {
    const totalPages = Math.max(Math.ceil(state.historyTotal / state.historyPageSize), 1);
    el('page5').innerHTML = `<h3>历史记录</h3><div class="row"><div class="card"><h4>分页记录输入长度图</h4><div id="historyChart" class="chart"></div></div><div class="card"><h4>历史列表</h4><div id="historyList"></div><div style="display:flex;gap:8px;margin-top:8px;align-items:center;"><button id="prevHistory" class="secondary">上一页</button><button id="nextHistory" class="secondary">下一页</button><span class="mini">第 ${state.historyPage}/${totalPages} 页，共 ${state.historyTotal} 条</span></div></div></div>`;
    initChart('historyChart', { xAxis: { type:'category', data: state.history.map(i => `#${i.id}`) }, yAxis: { type:'value', name:'输入字数' }, series: [{ type:'bar', data: state.history.map(i => (i.user_input || '').length) }] });
    const list = el('historyList'); list.innerHTML = '';
    state.history.forEach((it) => {
      const div = document.createElement('div'); div.className = 'history-item';
      div.innerHTML = `<div><b>#${it.id}</b> ${new Date(it.created_at).toLocaleString()}</div><div class='mini'>${(it.user_input || '').slice(0, 80)}...</div>`;
      const btn = document.createElement('button'); btn.className = 'secondary'; btn.style.marginTop = '6px'; btn.textContent = '复现该记录'; btn.onclick = () => replayRecord(it.id);
      div.appendChild(btn); list.appendChild(div);
    });
    el('prevHistory').onclick = () => { if (state.historyPage > 1) loadHistory(state.historyPage - 1); };
    el('nextHistory').onclick = () => { if (state.historyPage < totalPages) loadHistory(state.historyPage + 1); };
  }

  function renderAllPages() { renderPage1(); renderPage2(); renderPage3(); renderPage4(); renderPage5(); }

  renderTabs();
  switchTab('page1');
  loadHistory();
})();
