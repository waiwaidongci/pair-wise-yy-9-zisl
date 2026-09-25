// 路由层：只做 HTTP 解析和应答，规则在 src/rules.js，存取在 src/store.js，页面在 src/page.js。

import http from "node:http";
import { loadDb, saveDb, findItem, findBatch, newItemId } from "./src/store.js";
import {
  canDeduct, validateBatchRegistration, buildBatch, validateReplenish,
  applyReplenish, applyBatchStatus, applyStep, filmsForBatch, batchView,
  computeStats, summarize
} from "./src/rules.js";
import { page } from "./src/page.js";

const port = Number(process.env.PORT || 3040);

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}
function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}
function html(res, text) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const db = await loadDb();

    if (req.method === "GET" && url.pathname === "/") return html(res, page());

    if (req.method === "GET" && url.pathname === "/api/items") return send(res, 200, db.items.map(summarize));

    if (req.method === "POST" && url.pathname === "/api/items") {
      const input = await body(req);
      const item = { id: newItemId(), ...input, logs: [{ at: new Date().toISOString(), step: "建档", note: "创建底片" }], steps: [] };
      db.items.unshift(item);
      await saveDb(db);
      return send(res, 201, item);
    }

    const patch = url.pathname.match(/^\/api\/items\/([^/]+)$/);
    if (patch && req.method === "PATCH") {
      const item = findItem(db, patch[1]);
      if (!item) return send(res, 404, { error: "item_not_found" });
      Object.assign(item, await body(req));
      item.logs ||= [];
      item.logs.push({ at: new Date().toISOString(), step: "状态", note: "更新为" + item.status });
      await saveDb(db);
      return send(res, 200, item);
    }

    const log = url.pathname.match(/^\/api\/items\/([^/]+)\/logs$/);
    if (log && req.method === "POST") {
      const item = findItem(db, log[1]);
      if (!item) return send(res, 404, { error: "item_not_found" });
      const input = await body(req);
      item.logs ||= [];
      item.logs.push({ at: new Date().toISOString(), step: input.step || "记录", note: input.note || "" });
      await saveDb(db);
      return send(res, 201, item);
    }

    const action = url.pathname.match(/^\/api\/items\/([^/]+)\/action$/);
    if (action && req.method === "POST") {
      const item = findItem(db, action[1]);
      if (!item) return send(res, 404, { error: "item_not_found" });
      const input = await body(req);
      let batch = null;
      if (input.step === "冲洗") {
        const operator = String(input.operator || "").trim();
        if (!operator) return send(res, 400, { error: "operator_required", reason: "冲洗必须填写操作人" });
        const amount = Number(input.amount);
        if (!(amount > 0)) return send(res, 400, { error: "amount_invalid", reason: "冲洗必须填写大于 0 的用量（ml）" });
        batch = findBatch(db, String(input.batchId || ""));
        if (!batch) return send(res, 400, { error: "batch_required", reason: "冲洗必须选择已登记的药液批次" });
        const check = canDeduct(batch, amount);
        if (!check.ok) return send(res, 409, { error: "batch_not_usable", reason: check.reason });
        input.amount = amount;
        input.operator = operator;
      }
      applyStep(item, input, batch);
      await saveDb(db);
      return send(res, 201, item);
    }

    if (req.method === "GET" && url.pathname === "/api/batches") {
      return send(res, 200, db.batches.map(b => batchView(b, db.items)));
    }

    if (req.method === "POST" && url.pathname === "/api/batches") {
      const input = await body(req);
      const check = validateBatchRegistration(input, db.batches);
      if (!check.ok) return send(res, 400, { error: "batch_invalid", reason: check.reason });
      const batch = buildBatch(input);
      db.batches.unshift(batch);
      await saveDb(db);
      return send(res, 201, batchView(batch, db.items));
    }

    const batchGet = url.pathname.match(/^\/api\/batches\/([^/]+)$/);
    if (batchGet && req.method === "GET") {
      const batch = findBatch(db, batchGet[1]);
      if (!batch) return send(res, 404, { error: "batch_not_found" });
      return send(res, 200, { ...batchView(batch, db.items), films: filmsForBatch(db.items, batch) });
    }

    const replenish = url.pathname.match(/^\/api\/batches\/([^/]+)\/replenish$/);
    if (replenish && req.method === "POST") {
      const batch = findBatch(db, replenish[1]);
      if (!batch) return send(res, 404, { error: "batch_not_found" });
      const input = await body(req);
      const check = validateReplenish(batch, Number(input.amount));
      if (!check.ok) return send(res, 409, { error: "replenish_invalid", reason: check.reason });
      applyReplenish(batch, { amount: Number(input.amount), operator: input.operator, note: input.note });
      await saveDb(db);
      return send(res, 200, batchView(batch, db.items));
    }

    const status = url.pathname.match(/^\/api\/batches\/([^/]+)\/status$/);
    if (status && req.method === "POST") {
      const batch = findBatch(db, status[1]);
      if (!batch) return send(res, 404, { error: "batch_not_found" });
      const input = await body(req);
      if (!["在用", "停用"].includes(input.status)) return send(res, 400, { error: "status_invalid", reason: "状态只能是在用或停用" });
      applyBatchStatus(batch, input.status, input.operator);
      await saveDb(db);
      return send(res, 200, batchView(batch, db.items));
    }

    if (req.method === "GET" && url.pathname === "/api/stats") return send(res, 200, computeStats(db.items));

    send(res, 404, { error: "not_found" });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
});
server.listen(port, () => console.log("古法蓝晒底片整理室 listening on http://localhost:" + port));
