// 规则层：纯函数，不做任何 IO。药液批次的登记、扣量、补液、停用判定都在这里。

export const STAGES = ["待曝光", "冲洗中", "待入盒", "已交付"];
export const STEP_NAMES = ["涂布", "晾干", "曝光", "冲洗", "复晒", "入盒", "交付"];

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// 批次当前能否投入使用（与用量无关的部分：停用、可用日期）
export function batchAvailability(batch, onDate = today()) {
  if (batch.status === "停用") {
    return { ok: false, reason: `批次 ${batch.code} 已停用` };
  }
  if (batch.validFrom && onDate < batch.validFrom) {
    return { ok: false, reason: `批次 ${batch.code} 未到可用期（${batch.validFrom} 起可用）` };
  }
  if (batch.validUntil && onDate > batch.validUntil) {
    return { ok: false, reason: `批次 ${batch.code} 已过可用日期（可用至 ${batch.validUntil}）` };
  }
  return { ok: true, reason: "" };
}

// 冲洗扣量前的完整校验：停用、过期、余量不足都会给出原因
export function canDeduct(batch, amount, onDate = today()) {
  const avail = batchAvailability(batch, onDate);
  if (!avail.ok) return avail;
  if (!(Number(amount) > 0)) return { ok: false, reason: "冲洗用量必须大于 0ml" };
  if (batch.remaining < amount) {
    return { ok: false, reason: `批次 ${batch.code} 余量不足（余 ${batch.remaining}ml，需 ${amount}ml）` };
  }
  return { ok: true, reason: "" };
}

export function validateBatchRegistration(input, batches) {
  const code = String(input.code || "").trim();
  if (!code) return { ok: false, reason: "请填写批次编号" };
  if (batches.some(b => b.code === code)) return { ok: false, reason: `批次编号 ${code} 已登记过` };
  if (!String(input.type || "").trim()) return { ok: false, reason: "请填写药液类型" };
  if (!(Number(input.capacity) > 0)) return { ok: false, reason: "容量必须大于 0ml" };
  if (!input.validFrom || !input.validUntil) return { ok: false, reason: "请填写可用起止日期" };
  if (input.validFrom > input.validUntil) return { ok: false, reason: "可用起始日期不能晚于截止日期" };
  return { ok: true, reason: "" };
}

export function buildBatch(input, now = new Date()) {
  const capacity = Number(input.capacity);
  const at = now.toISOString();
  return {
    id: "BAT-" + now.getTime(),
    code: String(input.code).trim(),
    type: String(input.type).trim(),
    capacity,
    remaining: capacity,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    status: "在用",
    createdAt: at,
    ledger: [
      {
        at,
        kind: "登记",
        amount: capacity,
        remaining: capacity,
        operator: String(input.operator || "").trim() || "登记员",
        note: "批次登记入缸"
      }
    ]
  };
}

export function validateReplenish(batch, amount) {
  if (!(Number(amount) > 0)) return { ok: false, reason: "补液量必须大于 0ml" };
  const room = Math.round((batch.capacity - batch.remaining) * 100) / 100;
  if (batch.remaining + Number(amount) > batch.capacity) {
    return { ok: false, reason: `补液后超出容量（容量 ${batch.capacity}ml，余 ${batch.remaining}ml，最多再补 ${room}ml）` };
  }
  return { ok: true, reason: "" };
}

export function applyReplenish(batch, { amount, operator, note }, at = new Date().toISOString()) {
  batch.remaining = Math.round((batch.remaining + Number(amount)) * 100) / 100;
  batch.ledger.push({
    at,
    kind: "补液",
    amount: Number(amount),
    remaining: batch.remaining,
    operator: String(operator || "").trim() || "未署名",
    note: String(note || "").trim()
  });
}

export function applyBatchStatus(batch, status, operator, at = new Date().toISOString()) {
  batch.status = status;
  batch.ledger.push({
    at,
    kind: status,
    amount: 0,
    remaining: batch.remaining,
    operator: String(operator || "").trim() || "未署名",
    note: status === "停用" ? "批次停用，暂停冲洗扣量" : "批次重新启用"
  });
}

export function nextStatus(step) {
  if (step === "冲洗") return "冲洗中";
  if (step === "入盒") return "待入盒";
  if (step === "交付") return "已交付";
  return "待曝光";
}

// 记录一步工艺；冲洗时带上批次扣量信息。调用前必须先通过 canDeduct。
export function applyStep(item, input, batch, now = new Date()) {
  const at = now.toISOString();
  item.logs ||= [];
  item.steps ||= [];
  const step = { at, ...input };
  if (batch) {
    batch.remaining = Math.round((batch.remaining - Number(input.amount)) * 100) / 100;
    batch.ledger.push({
      at,
      kind: "冲洗扣量",
      amount: -Number(input.amount),
      remaining: batch.remaining,
      operator: input.operator,
      filmId: item.id,
      filmCode: item.code || item.id,
      note: String(input.note || "").trim()
    });
    step.batchId = batch.id;
    step.batchCode = batch.code;
    step.batchRemaining = batch.remaining;
    item.chemicalBatch = batch.code;
  }
  item.steps.push(step);
  if (input.defect) item.defect = input.defect;
  item.status = nextStatus(input.step);
  const batchNote = batch ? `（批次 ${batch.code} 扣 ${input.amount}ml，余 ${batch.remaining}ml，操作人 ${input.operator}）` : "";
  item.logs.push({
    at,
    step: input.step || "工艺",
    note: (input.note || input.developStatus || "步骤记录") + batchNote
  });
}

// 批次详情反查：哪些底片的哪一步用过这一缸
export function filmsForBatch(items, batch) {
  const rows = [];
  for (const item of items) {
    for (const s of item.steps || []) {
      if (s.batchId === batch.id || (s.batchCode && s.batchCode === batch.code)) {
        rows.push({
          filmId: item.id,
          filmCode: item.code || item.id,
          at: s.at,
          step: s.step,
          amount: s.amount,
          operator: s.operator || "",
          note: s.note || ""
        });
      }
    }
  }
  return rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export function batchView(batch, items, onDate = today()) {
  const avail = batchAvailability(batch, onDate);
  return {
    ...batch,
    usable: avail.ok,
    unusableReason: avail.reason,
    usedCount: filmsForBatch(items, batch).length
  };
}

export function computeStats(items) {
  const stats = Object.fromEntries(STAGES.map(label => [label, 0]));
  for (const item of items) {
    if (stats[item.status] !== undefined) stats[item.status] += 1;
  }
  return stats;
}

export function summarize(item) {
  const logCount = (item.logs || []).length + (item.tasks || []).reduce((n, t) => n + (t.logs || []).length, 0);
  return { ...item, logCount };
}
