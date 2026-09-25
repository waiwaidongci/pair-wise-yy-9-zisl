// 页面层：底片卡片 + 药液批次台账，只负责展示与接口调用，业务判定以接口返回为准。
import { stages, fields, extraFields, chemicalTypes, steps } from "./rules.js";

export function page() {
  return '<!doctype html>\n' +
'<html lang="zh-CN">\n' +
'<head>\n' +
'  <meta charset="utf-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'  <title>古法蓝晒底片整理室</title>\n' +
'  <style>\n' +
"    :root { --bg:#f1f3ef; --panel:#fff; --ink:#20241f; --muted:#687066; --line:#d4ddd0; --accent:#526f43; --warn:#9b4937; --ok:#3f6e4a; }\n" +
'    * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,"PingFang SC",sans-serif; }\n' +
'    header { padding:22px 28px; background:#fff; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:16px; align-items:center; }\n' +
'    h1 { margin:0; font-size:26px; } h2 { margin:0 0 12px; font-size:18px; } main { padding:18px 28px 28px; }\n' +
'    form,.panel,.card,.stat { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }\n' +
'    label { display:block; margin:10px 0 5px; color:var(--muted); font-size:13px; } input,select,textarea { width:100%; border:1px solid var(--line); border-radius:6px; padding:9px; font:inherit; background:#fff; } textarea { min-height:68px; }\n' +
'    button { border:0; border-radius:6px; background:var(--accent); color:#fff; padding:10px 13px; font-weight:700; cursor:pointer; } button.secondary { background:#69736a; } button.danger { background:var(--warn); } button.tiny { padding:5px 9px; font-size:12px; font-weight:400; }\n' +
'    .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; margin-bottom:14px; } .stat strong { display:block; font-size:24px; }\n' +
'    .toolbar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; } .toolbar select,.toolbar input { width:auto; min-width:160px; }\n' +
'    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(290px,1fr)); gap:12px; } .card { display:grid; gap:8px; }\n' +
'    .meta { color:var(--muted); font-size:13px; } .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:3px 8px; font-size:12px; margin-right:4px; }\n' +
'    .pill.ok { color:var(--ok); border-color:var(--ok); } .pill.bad { color:var(--warn); border-color:var(--warn); }\n' +
'    .logs { border-top:1px solid var(--line); padding-top:8px; max-height:130px; overflow:auto; display:grid; gap:3px; } .warn { color:var(--warn); font-weight:700; }\n' +
'    .tabs { display:flex; gap:8px; margin-bottom:16px; } .tabs button { background:#fff; color:var(--ink); border:1px solid var(--line); } .tabs button.active { background:var(--accent); color:#fff; border-color:var(--accent); }\n' +
'    .tabpane { display:grid; grid-template-columns:380px 1fr; gap:22px; align-items:start; }\n' +
'    .batchbar { height:8px; border-radius:999px; background:var(--line); overflow:hidden; } .batchbar span { display:block; height:100%; background:var(--accent); }\n' +
'    table { width:100%; border-collapse:collapse; font-size:13px; } th,td { text-align:left; border-bottom:1px solid var(--line); padding:7px 8px; vertical-align:top; }\n' +
'    .modal-mask { position:fixed; inset:0; background:rgba(20,26,20,.45); display:none; align-items:center; justify-content:center; z-index:20; padding:16px; }\n' +
'    .modal-mask.show { display:flex; } .modal { background:#fff; border-radius:10px; max-width:860px; width:100%; max-height:88vh; overflow:auto; padding:20px; }\n' +
'    .modal-head { display:flex; justify-content:space-between; align-items:center; gap:10px; }\n' +
'    @media (max-width:900px){ header{display:block;padding:18px 16px;} .tabpane{grid-template-columns:1fr;} main{padding:16px;} }\n' +
'  </style>\n' +
'</head>\n' +
'<body>\n' +
'  <header><div><h1>古法蓝晒底片整理室</h1><div class="meta">底片任务、工艺步骤、药液批次台账与双向追溯</div></div><button id="reload">刷新</button></header>\n' +
'  <main>\n' +
'    <div class="tabs"><button id="tabItems" class="active">底片管理</button><button id="tabBatches">药液批次台账</button></div>\n' +
'    <section id="paneItems" class="tabpane">\n' +
'      <div>\n' +
'        <form id="createForm" class="panel"><h2>新增底片</h2><div id="fields"></div><datalist id="batchCodes"></datalist><label>初始状态</label><select name="status">' + stages.map(s => '<option>' + s + '</option>').join('') + '</select><div style="margin-top:12px"><button>保存底片</button></div></form>\n' +
'        <form id="actionForm" class="panel" style="margin-top:14px"><h2>记录工艺步骤</h2><label>选择底片</label><select name="id" id="itemSelect"></select><label>步骤</label><select name="step" id="stepSelect">' + steps.map(s => '<option>' + s + '</option>').join('') + '</select><div id="rinseBox" style="display:none"><label>药液批次（缸）</label><select name="batchId" id="batchSelect"></select><label>本次用量 ml</label><input name="dosage" type="number" min="1" step="1" placeholder="例如 60"></div><label>操作人</label><input name="operator" placeholder="冲洗必填"><div id="extraFields"></div><div style="margin-top:12px"><button>提交记录</button></div><p class="meta" id="actionHint"></p></form>\n' +
'      </div>\n' +
'      <div>\n' +
'        <div class="stats" id="stats"></div>\n' +
'        <div class="toolbar"><select id="statusFilter"><option value="">全部状态</option>' + stages.map(s => '<option>' + s + '</option>').join('') + '</select><input id="search" placeholder="搜索编号或关键词"></div>\n' +
'        <div class="panel"><h2>按涂布、晾干、曝光、冲洗、复晒、入盒记录每一步；冲洗步骤会从所选批次扣量。</h2><div class="grid" id="cards"></div></div>\n' +
'      </div>\n' +
'    </section>\n' +
'    <section id="paneBatches" class="tabpane" style="display:none">\n' +
'      <form id="batchForm" class="panel"><h2>登记药液批次</h2><label>批次编号</label><input name="code" required placeholder="如 B-1001"><label>药液类型</label><select name="type">' + chemicalTypes.map(t => '<option>' + t + '</option>').join('') + '</select><label>容量 ml</label><input name="capacity" type="number" min="1" step="1" required><label>可用开始日期</label><input name="startDate" type="date" required><label>可用截止日期</label><input name="expireDate" type="date" required><div style="margin-top:12px"><button>登记批次</button></div></form>\n' +
'      <div class="panel"><h2>批次列表</h2><div class="grid" id="batchCards"></div></div>\n' +
'    </section>\n' +
'  </main>\n' +
'  <div class="modal-mask" id="modalMask"><div class="modal" id="modalBody"></div></div>\n' +
'  <script>\n' +
clientScript() +
'  </script>\n' +
'</body>\n' +
'</html>';
}

function clientScript() {
  return (
"    const fields = " + JSON.stringify(fields) + ";\n" +
"    const stages = " + JSON.stringify(stages) + ";\n" +
"    const extraFields = " + JSON.stringify(extraFields) + ";\n" +
"    let items = [];\n" +
"    let batches = [];\n" +
"    const $ = sel => document.querySelector(sel);\n" +
"    async function api(path, options) {\n" +
"      const res = await fetch(path, options && options.body ? Object.assign({}, options, { headers:{ 'Content-Type':'application/json' } }) : options);\n" +
"      const data = await res.json();\n" +
"      if (!res.ok) { const err = new Error((data && data.reason) || (data && data.error) || '请求失败'); err.payload = data; throw err; }\n" +
"      return data;\n" +
"    }\n" +
"    function esc(v) { return String(v == null ? '' : v).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c])); }\n" +
"    function renderForms() {\n" +
"      $('#fields').innerHTML = fields.map(function(f){ return '<label>'+f[1]+'</label><input name=\"'+f[0]+'\" type=\"'+f[2]+'\"'+(f[0]==='code'?' required':'')+(f[0]==='chemicalBatch'?' list=\"batchCodes\"':'')+'>'; }).join('');\n" +
"      $('#extraFields').innerHTML = extraFields.map(function(f){ return '<label>'+f[1]+'</label><input name=\"'+f[0]+'\">'; }).join('');\n" +
"    }\n" +
"    function renderBatchCodes() {\n" +
"      $('#batchCodes').innerHTML = batches.map(b => '<option value=\"'+esc(b.code)+'\">').join('');\n" +
"    }\n" +
"    function renderBatchOptions() {\n" +
"      $('#batchSelect').innerHTML = batches.map(b => '<option value=\"'+esc(b.id)+'\">'+esc(b.code)+' · '+esc(b.type)+' · 余 '+b.remaining+'ml'+(b.usable?'':'（不可用）')+'</option>').join('');\n" +
"    }\n" +
"    function fmtAt(at) { return esc(at).replace('T',' ').slice(0,16); }\n" +
"    function render() {\n" +
"      $('#itemSelect').innerHTML = items.map(item => '<option value=\"'+esc(item.id || item.code)+'\">'+esc(item.code || item.id)+' · '+esc(item.name || item.shipType || item.source || item.plateSize || '')+'</option>').join('');\n" +
"      const stats = Object.fromEntries(stages.map(s => [s, items.filter(i => i.status === s).length]));\n" +
"      $('#stats').innerHTML = Object.entries(stats).map(function(e){ return '<div class=\"stat\"><span>'+e[0]+'</span><strong>'+e[1]+'</strong></div>'; }).join('');\n" +
"      const status = $('#statusFilter').value;\n" +
"      const q = $('#search').value.trim();\n" +
"      const visible = items.filter(item => (!status || item.status === status) && (!q || JSON.stringify(item).includes(q)));\n" +
"      $('#cards').innerHTML = visible.map(item => cardHtml(item)).join('');\n" +
"      document.querySelectorAll('[data-status]').forEach(sel => sel.onchange = async () => { await api('/api/items/'+encodeURIComponent(sel.dataset.status), { method:'PATCH', body: JSON.stringify({ status: sel.value }) }); await loadAll(); });\n" +
"      document.querySelectorAll('[data-note]').forEach(btn => btn.onclick = async () => { const id = btn.dataset.note; const note = prompt('记录备注'); if (note) { await api('/api/items/'+encodeURIComponent(id)+'/logs', { method:'POST', body: JSON.stringify({ step:'备注', note }) }); await loadAll(); } });\n" +
"      renderBatches();\n" +
"    }\n" +
"    function historyHtml(item) {\n" +
"      const steps = (item.steps || []).slice(-6).map(s => {\n" +
"        const batch = s.batchCode ? ' <span class=\"pill\">'+esc(s.batchCode)+'</span>用 '+esc(s.dosage)+'ml' : '';\n" +
"        const op = s.operator ? ' · '+esc(s.operator) : '';\n" +
"        return '<div>'+fmtAt(s.at)+' '+esc(s.step)+batch+op+'</div>';\n" +
"      });\n" +
"      const logs = (item.logs || []).filter(l => !l.at || !item.steps || !item.steps.some(s => s.at === l.at)).slice(-3).map(l => '<div>'+fmtAt(l.at)+' '+esc(l.step)+'：'+esc(l.note)+'</div>');\n" +
"      return steps.concat(logs).join('') || '暂无记录';\n" +
"    }\n" +
"    function cardHtml(item) {\n" +
"      const main = fields.slice(0,4).map(function(f){ return '<div><b>'+f[1]+'</b> '+(item[f[0]] == null ? '' : esc(item[f[0]]))+'</div>'; }).join('');\n" +
"      return '<article class=\"card\"><h3>'+esc(item.code || item.id)+'</h3><span class=\"pill\">'+esc(item.status)+'</span>'+main+'<label>状态</label><select data-status=\"'+esc(item.id || item.code)+'\">'+stages.map(s => '<option '+(s===item.status?'selected':'')+'>'+s+'</option>').join('')+'</select><button class=\"secondary\" data-note=\"'+esc(item.id || item.code)+'\">追加备注</button><div class=\"logs meta\">'+historyHtml(item)+'</div></article>';\n" +
"    }\n" +
"    function renderBatches() {\n" +
"      renderBatchCodes(); renderBatchOptions();\n" +
"      $('#batchCards').innerHTML = batches.map(b => {\n" +
"        const pct = Math.max(0, Math.min(100, Math.round(b.remaining / b.capacity * 100)));\n" +
"        const state = b.usable ? '<span class=\"pill ok\">可用</span>' : '<span class=\"pill bad\">不可用</span>';\n" +
"        const why = b.usable ? '' : '<div class=\"warn\">'+esc(b.unusableReason)+'</div>';\n" +
"        const active = b.active ? '' : '<span class=\"pill bad\">停用</span>';\n" +
"        return '<article class=\"card\"><h3>'+esc(b.code)+' '+state+active+'</h3><div class=\"meta\">'+esc(b.type)+' · 容量 '+b.capacity+'ml</div><div>余量 <b>'+b.remaining+'ml</b>（'+pct+'%）</div><div class=\"batchbar\"><span style=\"width:'+pct+'%\"></span></div><div class=\"meta\">可用日期 '+esc(b.startDate)+' 至 '+esc(b.expireDate)+'</div>'+why+'<div style=\"display:flex;gap:6px;flex-wrap:wrap\"><button class=\"tiny\" data-detail=\"'+esc(b.id)+'\">详情/反查底片</button><button class=\"tiny secondary\" data-replenish=\"'+esc(b.id)+'\">补液</button>'+(b.active ? '<button class=\"tiny danger\" data-disable=\"'+esc(b.id)+'\">停用</button>' : '<button class=\"tiny secondary\" data-enable=\"'+esc(b.id)+'\">启用</button>')+'</div></article>';\n" +
"      }).join('') || '<p class=\"meta\">还没有登记批次。</p>';\n" +
"      document.querySelectorAll('[data-detail]').forEach(btn => btn.onclick = () => openDetail(btn.dataset.detail));\n" +
"      document.querySelectorAll('[data-replenish]').forEach(btn => btn.onclick = () => replenish(btn.dataset.replenish));\n" +
"      document.querySelectorAll('[data-disable]').forEach(btn => btn.onclick = () => toggleActive(btn.dataset.detail || btn.dataset.disable, false));\n" +
"      document.querySelectorAll('[data-enable]').forEach(btn => btn.onclick = () => toggleActive(btn.dataset.enable, true));\n" +
"    }\n" +
"    async function openDetail(id) {\n" +
"      try {\n" +
"        const d = await api('/api/batches/'+encodeURIComponent(id));\n" +
"        const ledger = d.ledger.map(l => '<tr><td>'+fmtAt(l.at)+'</td><td>'+esc(l.kind)+'</td><td>'+(l.amount > 0 ? '+' : '')+l.amount+'</td><td>'+esc(l.operator || '')+'</td><td>'+esc(l.note || '')+'</td></tr>').join('');\n" +
"        const usages = d.usages.length ? d.usages.map(u => '<tr><td>'+fmtAt(u.at)+'</td><td><b>'+esc(u.itemCode)+'</b></td><td>'+esc(u.plateSize)+'</td><td>'+esc(u.operator)+'</td><td>'+u.dosage+'ml</td><td>'+esc(u.note)+'</td></tr>').join('') : '<tr><td colspan=\"6\" class=\"meta\">还没有底片用过这缸。</td></tr>';\n" +
"        const state = d.usable ? '<span class=\"pill ok\">可用</span>' : '<span class=\"pill bad\">'+esc(d.unusableReason)+'</span>';\n" +
"        $('#modalBody').innerHTML = '<div class=\"modal-head\"><h2>批次 '+esc(d.code)+' '+state+'</h2><button class=\"secondary tiny\" id=\"modalClose\">关闭</button></div><p class=\"meta\">'+esc(d.type)+' · 容量 '+d.capacity+'ml · 当前余量 <b>'+d.remaining+'ml</b> · 可用日期 '+esc(d.startDate)+' 至 '+esc(d.expireDate)+'</p><h2>用过该批次的底片（反查）</h2><table><thead><tr><th>时间</th><th>底片</th><th>尺寸</th><th>操作人</th><th>用量</th><th>备注</th></tr></thead><tbody>'+usages+'</tbody></table><h2 style=\"margin-top:16px\">批次流水（建档/补液/停用/扣量）</h2><table><thead><tr><th>时间</th><th>类型</th><th>ml</th><th>操作人</th><th>说明</th></tr></thead><tbody>'+ledger+'</tbody></table>';\n" +
"        $('#modalMask').classList.add('show');\n" +
"        $('#modalClose').onclick = closeModal;\n" +
"      } catch (e) { alert(e.message); }\n" +
"    }\n" +
"    function closeModal() { $('#modalMask').classList.remove('show'); }\n" +
"    async function replenish(id) {\n" +
"      const operator = prompt('补液操作人'); if (operator === null) return; if (!operator.trim()) { alert('请填写操作人'); return; }\n" +
"      const amount = prompt('补液量 ml（不得超过登记容量）'); if (amount === null) return;\n" +
"      try {\n" +
"        await api('/api/batches/'+encodeURIComponent(id)+'/replenish', { method:'POST', body: JSON.stringify({ amount: Number(amount), operator: operator.trim() }) });\n" +
"        await loadAll();\n" +
"      } catch (e) { alert(e.message); }\n" +
"    }\n" +
"    async function toggleActive(id, active) {\n" +
"      const operator = prompt((active ? '启用' : '停用') + '操作人'); if (operator === null) return; if (!operator.trim()) { alert('请填写操作人'); return; }\n" +
"      let note = '';\n" +
"      if (!active) { const v = prompt('停用原因（可留空）'); if (v === null) return; note = v; }\n" +
"      try {\n" +
"        await api('/api/batches/'+encodeURIComponent(id), { method:'PATCH', body: JSON.stringify({ active: active, operator: operator.trim(), note: note }) });\n" +
"        await loadAll();\n" +
"      } catch (e) { alert(e.message); }\n" +
"    }\n" +
"    function syncRinseBox() {\n" +
"      const isRinse = $('#stepSelect').value === '冲洗';\n" +
"      $('#rinseBox').style.display = isRinse ? 'block' : 'none';\n" +
"      $('#actionHint').textContent = isRinse ? '冲洗将从所选批次扣量；余量不足、过期或停用的批次不会记录此步骤。' : '';\n" +
"    }\n" +
"    async function loadAll() {\n" +
"      const [it, ba] = await Promise.all([api('/api/items'), api('/api/batches')]);\n" +
"      items = it; batches = ba; render();\n" +
"    }\n" +
"    $('#createForm').onsubmit = async function(event) {\n" +
"      event.preventDefault();\n" +
"      try {\n" +
"        await api('/api/items', { method:'POST', body: JSON.stringify(Object.fromEntries(new FormData($('#createForm')).entries())) });\n" +
"        $('#createForm').reset(); await loadAll();\n" +
"      } catch (e) { alert(e.message); }\n" +
"    };\n" +
"    $('#actionForm').onsubmit = async function(event) {\n" +
"      event.preventDefault();\n" +
"      const fd = Object.fromEntries(new FormData($('#actionForm')).entries());\n" +
"      const payload = { step: fd.step, operator: fd.operator, developStatus: fd.developStatus, defect: fd.defect, repair: fd.repair, note: fd.note };\n" +
"      if (fd.step === '冲洗') { payload.batchId = fd.batchId; payload.dosage = Number(fd.dosage); }\n" +
"      try {\n" +
"        await api('/api/items/'+encodeURIComponent(fd.id)+'/action', { method:'POST', body: JSON.stringify(payload) });\n" +
"        $('#actionForm').reset(); syncRinseBox(); await loadAll();\n" +
"      } catch (e) { alert('本次步骤未记录：' + e.message); }\n" +
"    };\n" +
"    $('#batchForm').onsubmit = async function(event) {\n" +
"      event.preventDefault();\n" +
"      try {\n" +
"        const fd = Object.fromEntries(new FormData($('#batchForm')).entries());\n" +
"        fd.capacity = Number(fd.capacity);\n" +
"        await api('/api/batches', { method:'POST', body: JSON.stringify(fd) });\n" +
"        $('#batchForm').reset(); await loadAll();\n" +
"      } catch (e) { alert(e.message); }\n" +
"    };\n" +
"    $('#stepSelect').onchange = syncRinseBox;\n" +
"    $('#statusFilter').onchange = render; $('#search').oninput = render;\n" +
"    $('#reload').onclick = loadAll;\n" +
"    $('#tabItems').onclick = function(){ $('#tabItems').classList.add('active'); $('#tabBatches').classList.remove('active'); $('#paneItems').style.display='grid'; $('#paneBatches').style.display='none'; renderBatchOptions(); };\n" +
"    $('#tabBatches').onclick = function(){ $('#tabBatches').classList.add('active'); $('#tabItems').classList.remove('active'); $('#paneBatches').style.display='grid'; $('#paneItems').style.display='none'; };\n" +
"    $('#modalMask').onclick = function(e){ if (e.target === $('#modalMask')) closeModal(); };\n" +
"    renderForms(); syncRinseBox(); loadAll();\n"
  );
}
