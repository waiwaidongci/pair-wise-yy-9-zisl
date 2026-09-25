// 页面层：只负责拼 HTML，不碰业务规则和数据文件。

import { STAGES, STEP_NAMES } from "./rules.js";

const fields = [["code","底片编号","text"],["plateSize","玻璃板尺寸","text"],["chemicalBatch","药液批次（旧档）","text"],["exposure","曝光时间","text"],["waterSource","冲洗水源","text"],["box","存放盒位","text"]];

export function page() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>古法蓝晒底片整理室</title>
  <style>
    :root { --bg:#f1f3ef; --panel:#fff; --ink:#20241f; --muted:#687066; --line:#d4ddd0; --accent:#526f43; --warn:#9b4937; }
    * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,"PingFang SC",sans-serif; }
    header { padding:22px 28px; background:#fff; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:16px; align-items:center; }
    h1 { margin:0; font-size:26px; } h2 { margin:0 0 12px; font-size:18px; } main { display:grid; grid-template-columns:380px 1fr; gap:22px; padding:22px 28px; }
    form,.panel,.card,.stat { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    label { display:block; margin:10px 0 5px; color:var(--muted); font-size:13px; } input,select,textarea { width:100%; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; background:#fff; } textarea { min-height:68px; }
    button { border:0; border-radius:6px; background:var(--accent); color:#fff; padding:10px 13px; font-weight:700; cursor:pointer; } button.secondary { background:#69736a; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; margin-bottom:14px; } .stat strong { display:block; font-size:24px; }
    .toolbar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; } .toolbar select,.toolbar input { width:auto; min-width:160px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; } .card { display:grid; gap:8px; }
    .meta { color:var(--muted); font-size:13px; } .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:3px 8px; font-size:12px; }
    .pill.ok { color:var(--accent); border-color:var(--accent); } .pill.bad { color:var(--warn); border-color:var(--warn); }
    .logs { border-top:1px solid var(--line); padding-top:8px; max-height:120px; overflow:auto; } .warn { color:var(--warn); font-weight:700; }
    .notice { position:sticky; top:0; z-index:9; padding:10px 28px; font-weight:700; } .notice.ok { background:#e4eddc; color:var(--accent); } .notice.bad { background:#f3e2dc; color:var(--warn); }
    .batchSection { padding:0 28px 26px; } .batchGrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:12px; }
    .bar { height:8px; border-radius:999px; background:#e6eae2; overflow:hidden; } .bar i { display:block; height:100%; background:var(--accent); }
    .row { display:flex; gap:8px; flex-wrap:wrap; } .row button { padding:7px 10px; font-size:13px; }
    .detail { border-top:1px dashed var(--line); padding-top:8px; font-size:13px; } .detail table { width:100%; border-collapse:collapse; } .detail td,.detail th { border-bottom:1px solid var(--line); padding:4px 6px; text-align:left; font-size:12px; }
    .hint { background:#f4f7f0; border:1px dashed var(--line); border-radius:6px; padding:8px 10px; font-size:12px; color:var(--muted); margin-top:10px; }
    @media (max-width:900px){ header{display:block;padding:18px 16px;} main{grid-template-columns:1fr;padding:16px;} .batchSection{padding:0 16px 20px;} }
  </style>
</head>
<body>
  <header><div><h1>古法蓝晒底片整理室</h1><div class="meta">底片任务、工艺步骤、药液批次台账、缺陷和入盒交付</div></div><button id="reload">刷新</button></header>
  <div id="notice" class="notice" hidden></div>
  <main>
    <section>
      <form id="createForm"><h2>新增底片</h2><div id="fields"></div><label>初始状态</label><select name="status">${STAGES.map(s => '<option>'+s+'</option>').join('')}</select><button>保存底片</button></form>
      <form id="actionForm" style="margin-top:14px">
        <h2>记录工艺步骤</h2>
        <label>选择底片</label><select name="id" id="itemSelect"></select>
        <label>步骤</label><select name="step" id="stepSelect">${STEP_NAMES.map(s => '<option'+(s==='冲洗'?' selected':'')+'>'+s+'</option>').join('')}</select>
        <label>显影状态</label><input name="developStatus">
        <label>缺陷类型</label><input name="defect">
        <label>修补记录</label><input name="repair">
        <label>备注</label><input name="note">
        <label>操作人</label><input name="operator" id="operatorInput" placeholder="冲洗必填">
        <div id="batchPick">
          <label>药液批次（冲洗必选）</label><select name="batchId" id="batchSelect"></select>
          <label>用量（ml）</label><input name="amount" id="amountInput" type="number" min="1" step="1" placeholder="从所选批次扣量">
        </div>
        <div class="hint">冲洗会从所选批次扣量并记入台账；余量不足、已过可用日期或已停用的批次会被拒绝，本次步骤不记录。</div>
        <button style="margin-top:10px">提交记录</button>
      </form>
      <form id="batchForm" style="margin-top:14px">
        <h2>登记药液批次</h2>
        <label>批次编号</label><input name="code" required placeholder="如 B-0925">
        <label>药液类型</label><input name="type" required placeholder="如 柠檬酸铁铵显影液">
        <label>容量（ml）</label><input name="capacity" type="number" min="1" step="1" required>
        <label>可用自</label><input name="validFrom" type="date" required>
        <label>可用至</label><input name="validUntil" type="date" required>
        <label>登记人</label><input name="operator">
        <button>登记批次</button>
      </form>
    </section>
    <section>
      <div class="stats" id="stats"></div>
      <div class="toolbar"><select id="statusFilter"><option value="">全部状态</option>${STAGES.map(s => '<option>'+s+'</option>').join('')}</select><input id="search" placeholder="搜索编号或关键词"></div>
      <div class="panel"><h2>创建蓝晒任务后，按涂布、晾干、曝光、冲洗、复晒、入盒记录每一步历史。</h2><div class="grid" id="cards"></div></div>
    </section>
  </main>
  <section class="batchSection">
    <div class="panel"><h2>药液批次台账（一缸药液多张玻璃板轮流用）</h2><div class="batchGrid" id="batchCards"></div></div>
  </section>
  <script>
    const fields = ${JSON.stringify(fields)};
    const stages = ${JSON.stringify(STAGES)};
    const createForm = document.querySelector('#createForm');
    const actionForm = document.querySelector('#actionForm');
    const batchForm = document.querySelector('#batchForm');
    const cards = document.querySelector('#cards');
    const statsEl = document.querySelector('#stats');
    const itemSelect = document.querySelector('#itemSelect');
    const stepSelect = document.querySelector('#stepSelect');
    const batchSelect = document.querySelector('#batchSelect');
    const amountInput = document.querySelector('#amountInput');
    const operatorInput = document.querySelector('#operatorInput');
    const batchCards = document.querySelector('#batchCards');
    let items = [];
    let batches = [];
    async function api(path, options) {
      const res = await fetch(path, options && options.body ? { ...options, headers:{ 'Content-Type':'application/json' } } : options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.reason || data.error || '请求失败');
      return data;
    }
    function showMsg(text, bad) {
      const n = document.querySelector('#notice');
      n.textContent = text;
      n.className = 'notice ' + (bad ? 'bad' : 'ok');
      n.hidden = false;
      clearTimeout(n._t);
      n._t = setTimeout(() => { n.hidden = true; }, 8000);
    }
    function renderForms() {
      document.querySelector('#fields').innerHTML = fields.map(([key,label,type]) => '<label>'+label+'</label><input name="'+key+'" type="'+type+'" '+(key==='code'?'required':'')+'>').join('');
    }
    function syncBatchPick() {
      const developing = stepSelect.value === '冲洗';
      batchSelect.disabled = !developing;
      amountInput.disabled = !developing;
      if (developing) { batchSelect.required = true; amountInput.required = true; operatorInput.required = true; }
      else { batchSelect.required = false; amountInput.required = false; operatorInput.required = false; }
    }
    function render() {
      itemSelect.innerHTML = items.map(item => '<option value="'+(item.id || item.code)+'">'+(item.code || item.id)+' · '+(item.name || item.shipType || item.source || item.plateSize || '')+'</option>').join('');
      batchSelect.innerHTML = batches.map(b => '<option value="'+b.id+'" '+(b.usable?'':'disabled')+'>'+b.code+' · '+b.type+' · 余 '+b.remaining+'ml'+(b.usable?'':'（'+b.unusableReason+'）')+'</option>').join('');
      const stats = Object.fromEntries(stages.map(s => [s, items.filter(i => i.status === s).length]));
      statsEl.innerHTML = Object.entries(stats).map(([k,v]) => '<div class="stat"><span>'+k+'</span><strong>'+v+'</strong></div>').join('');
      const status = document.querySelector('#statusFilter').value;
      const q = document.querySelector('#search').value.trim();
      const visible = items.filter(item => (!status || item.status === status) && (!q || JSON.stringify(item).includes(q)));
      cards.innerHTML = visible.map(item => cardHtml(item)).join('');
      batchCards.innerHTML = batches.length ? batches.map(batchCardHtml).join('') : '<div class="meta">还没有登记药液批次，请先在左侧登记。</div>';
      document.querySelectorAll('[data-status]').forEach(sel => sel.onchange = async () => { try { await api('/api/items/'+sel.dataset.status, { method:'PATCH', body: JSON.stringify({ status: sel.value }) }); await load(); } catch (e) { showMsg(e.message, true); } });
      document.querySelectorAll('[data-note]').forEach(btn => btn.onclick = async () => { const id = btn.dataset.note; const note = prompt('记录备注'); if (note) { try { await api('/api/items/'+id+'/logs', { method:'POST', body: JSON.stringify({ step:'备注', note }) }); await load(); } catch (e) { showMsg(e.message, true); } } });
      document.querySelectorAll('[data-replenish]').forEach(btn => btn.onclick = async () => {
        const amount = Number(prompt('补液量（ml）'));
        if (!(amount > 0)) return;
        const operator = prompt('操作人') || '';
        try { await api('/api/batches/'+btn.dataset.replenish+'/replenish', { method:'POST', body: JSON.stringify({ amount, operator }) }); showMsg('补液已入账'); await load(); } catch (e) { showMsg(e.message, true); }
      });
      document.querySelectorAll('[data-toggle]').forEach(btn => btn.onclick = async () => {
        const operator = prompt('操作人') || '';
        try { await api('/api/batches/'+btn.dataset.toggle+'/status', { method:'POST', body: JSON.stringify({ status: btn.dataset.next, operator }) }); showMsg('批次已'+btn.dataset.next); await load(); } catch (e) { showMsg(e.message, true); }
      });
      document.querySelectorAll('[data-detail]').forEach(btn => btn.onclick = async () => {
        const box = document.querySelector('#detail-'+btn.dataset.detail);
        if (!box.hidden) { box.hidden = true; return; }
        try {
          const b = await api('/api/batches/'+btn.dataset.detail);
          const ledger = (b.ledger || []).slice().reverse().map(l => '<tr><td>'+(l.at||'').slice(0,10)+'</td><td>'+l.kind+'</td><td>'+(l.amount>0?'+':'')+l.amount+'ml</td><td>余 '+l.remaining+'ml</td><td>'+(l.operator||'')+'</td><td>'+(l.filmCode?l.filmCode+' ':'')+(l.note||'')+'</td></tr>').join('');
          const films = (b.films || []).map(f => '<div>'+(f.at||'').slice(0,10)+' · '+f.filmCode+' · '+f.step+' 扣 '+f.amount+'ml · '+f.operator+'</div>').join('');
          box.innerHTML = '<div class="meta">台账流水</div><table><tr><th>日期</th><th>动作</th><th>变动</th><th>余量</th><th>操作人</th><th>去向/备注</th></tr>'+ledger+'</table>'
            + '<div class="meta" style="margin-top:8px">用过本批次的底片（'+(b.films||[]).length+'）</div>'+(films || '<div class="meta">暂无底片使用</div>');
          box.hidden = false;
        } catch (e) { showMsg(e.message, true); }
      });
    }
    function cardHtml(item) {
      const main = fields.slice(0,4).map(([key,label]) => '<div><b>'+label+'</b> '+(item[key] ?? '')+'</div>').join('');
      const history = (item.steps || []).map(s => ({ at: s.at, html: '<div>'+s.step+(s.batchCode?' · 批次 '+s.batchCode+' 扣 '+s.amount+'ml':'')+(s.operator?' · '+s.operator:'')+(s.note?'：'+s.note:'')+'</div>' }))
        .concat((item.logs || []).filter(l => l.step === '备注' || l.step === '建档' || l.step === '状态').map(l => ({ at: l.at, html: '<div class="meta">'+l.step+'：'+l.note+'</div>' })))
        .sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-5).map(x => x.html).join('');
      return '<article class="card"><h3>'+(item.code || item.id)+'</h3><span class="pill">'+item.status+'</span>'+main+'<label>状态</label><select data-status="'+(item.id || item.code)+'">'+stages.map(s => '<option '+(s===item.status?'selected':'')+'>'+s+'</option>').join('')+'</select><button class="secondary" data-note="'+(item.id || item.code)+'">追加备注</button><div class="logs">'+(history || '暂无记录')+'</div></article>';
    }
    function batchCardHtml(b) {
      const pct = b.capacity ? Math.max(0, Math.min(100, Math.round(b.remaining / b.capacity * 100))) : 0;
      const pill = b.status === '停用' ? '<span class="pill bad">停用</span>' : (b.usable ? '<span class="pill ok">在用</span>' : '<span class="pill bad">不可冲洗</span>');
      const toggle = b.status === '停用' ? '<button class="secondary" data-toggle="'+b.id+'" data-next="在用">启用</button>' : '<button class="secondary" data-toggle="'+b.id+'" data-next="停用">停用</button>';
      return '<article class="card"><h3>'+b.code+' · '+b.type+'</h3>'+pill
        + '<div class="bar"><i style="width:'+pct+'%"></i></div><div class="meta">余量 '+b.remaining+'ml / 容量 '+b.capacity+'ml · 已供 '+b.usedCount+' 步冲洗</div>'
        + '<div class="meta">可用日期 '+b.validFrom+' ~ '+b.validUntil+'</div>'
        + (b.usable ? '' : '<div class="warn">'+b.unusableReason+'</div>')
        + '<div class="row"><button class="secondary" data-replenish="'+b.id+'">补液</button>'+toggle+'<button class="secondary" data-detail="'+b.id+'">台账与去向</button></div>'
        + '<div class="detail" id="detail-'+b.id+'" hidden></div></article>';
    }
    async function load() {
      const results = await Promise.all([api('/api/items'), api('/api/batches')]);
      items = results[0]; batches = results[1];
      render(); syncBatchPick();
    }
    createForm.onsubmit = async event => { event.preventDefault(); try { await api('/api/items', { method:'POST', body: JSON.stringify(Object.fromEntries(new FormData(createForm).entries())) }); createForm.reset(); showMsg('底片已建档'); await load(); } catch (e) { showMsg(e.message, true); } };
    actionForm.onsubmit = async event => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(actionForm).entries());
      if (payload.step !== '冲洗') { delete payload.batchId; delete payload.amount; }
      try { await api('/api/items/'+itemSelect.value+'/action', { method:'POST', body: JSON.stringify(payload) }); actionForm.reset(); syncBatchPick(); showMsg('步骤已记录'); await load(); }
      catch (e) { showMsg('本次步骤未记录：' + e.message, true); }
    };
    batchForm.onsubmit = async event => { event.preventDefault(); try { await api('/api/batches', { method:'POST', body: JSON.stringify(Object.fromEntries(new FormData(batchForm).entries())) }); batchForm.reset(); showMsg('批次已登记'); await load(); } catch (e) { showMsg(e.message, true); } };
    stepSelect.onchange = syncBatchPick;
    document.querySelector('#statusFilter').onchange = render; document.querySelector('#search').oninput = render; document.querySelector('#reload').onclick = load;
    renderForms(); load();
  </script>
</body>
</html>`;
}
