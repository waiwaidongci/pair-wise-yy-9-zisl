// 规则层：药液批次登记、可用性判定、冲洗扣量与双向追溯。
// 全部为纯函数式操作：传入内存台账 db，就地修改对象后由调用方落盘。

export class RuleError extends Error {
  constructor(code, reason) {
    super(reason);
    this.code = code;
    this.reason = reason;
  }
}

export const stages = ["待曝光", "冲洗中", "待入盒", "已交付"];
export const statLabels = ["待曝光", "冲洗中", "待入盒", "已交付"];
export const chemicalTypes = ["显影液", "定影液", "漂白液"];
export const steps = ["涂布", "晾干", "曝光", "冲洗", "复晒", "入盒", "交付"];

export const fields = [["code", "底片编号", "text"], ["plateSize", "玻璃板尺寸", "text"], ["chemicalBatch", "药液批次", "text"], ["exposure", "曝光时间", "text"], ["waterSource", "冲洗水源", "text"], ["box", "存放盒位", "text"]];
export const extraFields = [["developStatus", "显影状态"], ["defect", "缺陷类型"], ["repair", "修补记录"], ["note", "备注"]];

function today() { return new Date().toISOString().slice(0, 10); }
function nowIso() { return new Date().toISOString(); }

function parseAmount(value, label) {
  if (value === undefined || value === null || String(value).trim() === "")
    throw new RuleError("amount_required", "请填写" + label);
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0)
    throw new RuleError("amount_invalid", label + "必须为大于 0 的数字（ml）");
  if (!Number.isInteger(n)) return Math.round(n);
  return n;
}

export function findItem(db, key) {
  return db.items.find(x => x.id === key || x.code === key) || null;
}
export function findBatch(db, key) {
  return db.batches.find(b => b.id === key || b.code === key) || null;
}

// 批次当前可用性：余量、可用日期区间、停用任一不满足即不可用
export function batchState(batch, date = today()) {
  if (!batch.active) return { ok: false, code: "batch_disabled", reason: "批次 " + batch.code + " 已停用，不能使用" };
  if (date < batch.startDate) return { ok: false, code: "batch_not_started", reason: "批次 " + batch.code + " 尚未到可用日期（" + batch.startDate + " 起）" };
  if (date > batch.expireDate) return { ok: false, code: "batch_expired", reason: "批次 " + batch.code + " 已过期（可用至 " + batch.expireDate + "）" };
  if (!(batch.remaining > 0)) return { ok: false, code: "batch_empty", reason: "批次 " + batch.code + " 余量为 0" };
  return { ok: true };
}

// 登记编号、类型、容量和可用日期
export function createBatch(db, input) {
  const code = String(input.code || "").trim();
  const type = String(input.type || "").trim();
  const startDate = String(input.startDate || "").trim();
  const expireDate = String(input.expireDate || "").trim();
  if (!code) throw new RuleError("code_required", "请填写批次编号");
  if (!type) throw new RuleError("type_required", "请选择药液类型");
  const capacity = parseAmount(input.capacity, "容量");
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate))
    throw new RuleError("start_date_invalid", "请填写可用开始日期");
  if (!expireDate || !/^\d{4}-\d{2}-\d{2}$/.test(expireDate))
    throw new RuleError("expire_date_invalid", "请填写可用截止日期");
  if (expireDate < startDate)
    throw new RuleError("date_range_invalid", "可用截止日期不能早于开始日期");
  if (findBatch(db, code)) throw new RuleError("code_duplicate", "批次编号 " + code + " 已存在");

  const batch = {
    id: "CB-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(),
    code,
    type,
    capacity,
    remaining: capacity,
    startDate,
    expireDate,
    active: true,
    ledger: [{ at: nowIso(), kind: "建档", amount: capacity, operator: "", note: "登记建档，初始容量 " + capacity + "ml" }]
  };
  db.batches.unshift(batch);
  return batch;
}

// 补液：增加余量（不超过登记容量），写入批次流水
export function replenishBatch(db, key, input) {
  const batch = findBatch(db, key);
  if (!batch) throw new RuleError("batch_not_found", "批次不存在");
  const amount = parseAmount(input.amount, "补液量");
  const operator = String(input.operator || "").trim();
  if (!operator) throw new RuleError("operator_required", "请填写操作人");
  if (batch.remaining + amount > batch.capacity)
    throw new RuleError("over_capacity", "补液后余量 " + (batch.remaining + amount) + "ml 超过登记容量 " + batch.capacity + "ml");
  batch.remaining += amount;
  batch.ledger.push({
    at: nowIso(), kind: "补液", amount, operator,
    note: "补液 " + amount + "ml，余量 " + batch.remaining + "ml"
  });
  return batch;
}

// 停用 / 重新启用
export function setBatchActive(db, key, active, input = {}) {
  const batch = findBatch(db, key);
  if (!batch) throw new RuleError("batch_not_found", "批次不存在");
  const operator = String(input.operator || "").trim();
  if (!operator) throw new RuleError("operator_required", "请填写操作人");
  if (batch.active === active)
    throw new RuleError("no_change", active ? "该批次本就处于启用状态" : "该批次本就处于停用状态");
  batch.active = active;
  batch.ledger.push({
    at: nowIso(),
    kind: active ? "启用" : "停用",
    amount: 0,
    operator,
    note: (active ? "重新启用" : "停用") + (input.note ? "：" + String(input.note).trim() : "")
  });
  return batch;
}

// 记录工艺步骤；冲洗时必须从所选批次扣量并记操作人和底片
// 余量不足、过期或停用：不记录这次步骤，返回原因
export function recordAction(db, itemKey, input) {
  const item = findItem(db, itemKey);
  if (!item) throw new RuleError("item_not_found", "底片不存在");
  const step = String(input.step || "").trim();
  if (!step) throw new RuleError("step_required", "请选择工艺步骤");
  const operator = String(input.operator || "").trim();

  let batch = null;
  let dosage = 0;

  if (step === "冲洗") {
    if (!operator) throw new RuleError("operator_required", "冲洗必须记录操作人");
    const batchKey = String(input.batchId || "").trim();
    if (!batchKey) throw new RuleError("batch_required", "冲洗必须选择药液批次");
    batch = findBatch(db, batchKey);
    if (!batch) throw new RuleError("batch_not_found", "所选药液批次不存在");
    dosage = parseAmount(input.dosage, "本次用量");

    const state = batchState(batch);
    if (!state.ok) throw new RuleError(state.code, state.reason);
    if (batch.remaining < dosage)
      throw new RuleError("insufficient_remaining", "批次 " + batch.code + " 余量不足：余量 " + batch.remaining + "ml，本次需 " + dosage + "ml");
  }

  // 校验通过后才落步骤：扣量 → 批次流水 → 底片步骤/日志
  if (batch) {
    batch.remaining -= dosage;
    batch.ledger.push({
      at: nowIso(),
      kind: "冲洗",
      amount: -dosage,
      operator,
      itemCode: item.code,
      itemId: item.id || "",
      note: "冲洗底片 " + item.code + "，扣减 " + dosage + "ml，余量 " + batch.remaining + "ml"
    });
  }

  const at = nowIso();
  item.logs ||= [];
  item.steps ||= [];

  const entry = {
    at,
    step,
    operator,
    developStatus: input.developStatus || "",
    defect: input.defect || "",
    repair: input.repair || "",
    note: input.note || ""
  };
  if (batch) {
    entry.batchId = batch.id;
    entry.batchCode = batch.code;
    entry.batchType = batch.type;
    entry.dosage = dosage;
  }
  item.steps.push(entry);

  if (input.defect) item.defect = input.defect;
  if (step === "冲洗") item.status = "冲洗中";
  else if (step === "入盒") item.status = "待入盒";
  else if (step === "交付") item.status = "已交付";
  else item.status = "待曝光";

  const parts = [];
  if (batch) parts.push("药液 " + batch.code + " 扣减 " + dosage + "ml");
  if (operator) parts.push("操作人 " + operator);
  if (input.note) parts.push(String(input.note));
  item.logs.push({
    at,
    step,
    operator,
    batchCode: batch ? batch.code : "",
    dosage: batch ? dosage : 0,
    note: parts.join("，") || (input.developStatus || "步骤记录")
  });

  return { item, batch: batch || null, dosage };
}

// 批次详情反查：所有用过该批次的底片（来自扣量流水）
export function batchDetail(db, key) {
  const batch = findBatch(db, key);
  if (!batch) throw new RuleError("batch_not_found", "批次不存在");
  const usages = [];
  for (const item of db.items) {
    for (const s of item.steps || []) {
      if (s.step === "冲洗" && s.batchId === batch.id) {
        usages.push({
          itemId: item.id || "",
          itemCode: item.code,
          plateSize: item.plateSize || "",
          at: s.at,
          operator: s.operator || "",
          dosage: s.dosage,
          note: s.note || ""
        });
      }
    }
  }
  usages.sort((a, b) => (a.at < b.at ? 1 : -1));
  return { ...batchSummary(batch, today()), ledger: batch.ledger || [], usages };
}

export function batchSummary(batch, date = today()) {
  const state = batchState(batch, date);
  return {
    id: batch.id,
    code: batch.code,
    type: batch.type,
    capacity: batch.capacity,
    remaining: batch.remaining,
    startDate: batch.startDate,
    expireDate: batch.expireDate,
    active: batch.active,
    usable: state.ok,
    unusableReason: state.ok ? "" : state.reason,
    ledgerCount: (batch.ledger || []).length
  };
}

export function listBatches(db) {
  return db.batches.map(b => batchSummary(b, today()));
}

export function summarize(item) {
  const logCount = (item.logs || []).length + (item.tasks || []).reduce((n, t) => n + (t.logs || []).length, 0);
  return { ...item, logCount };
}

export function computeStats(items) {
  const stats = Object.fromEntries(statLabels.map(label => [label, 0]));
  for (const item of items) {
    if (stats[item.status] !== undefined) stats[item.status] += 1;
  }
  return stats;
}
