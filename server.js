import http from "node:http";
import { loadDb, saveDb, newId } from "./store.js";
import {
  RuleError,
  stages,
  listBatches,
  batchDetail,
  createBatch,
  replenishBatch,
  setBatchActive,
  findItem,
  recordAction,
  summarize,
  computeStats
} from "./rules.js";
import { page } from "./page.js";

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

    // ---- 药液批次 ----
    if (req.method === "GET" && url.pathname === "/api/batches")
      return send(res, 200, listBatches(db));

    if (req.method === "POST" && url.pathname === "/api/batches") {
      const batch = createBatch(db, await body(req));
      await saveDb(db);
      return send(res, 201, batch);
    }

    const batchReplenish = url.pathname.match(/^\/api\/batches\/([^/]+)\/replenish$/);
    if (batchReplenish && req.method === "POST") {
      const batch = replenishBatch(db, decodeURIComponent(batchReplenish[1]), await body(req));
      await saveDb(db);
      return send(res, 200, batch);
    }

    const batchOne = url.pathname.match(/^\/api\/batches\/([^/]+)$/);
    if (batchOne && req.method === "GET")
      return send(res, 200, batchDetail(db, decodeURIComponent(batchOne[1])));

    if (batchOne && req.method === "PATCH") {
      const input = await body(req);
      const batch = setBatchActive(db, decodeURIComponent(batchOne[1]), Boolean(input.active), input);
      await saveDb(db);
      return send(res, 200, batch);
    }

    // ---- 底片 ----
    if (req.method === "GET" && url.pathname === "/api/items")
      return send(res, 200, db.items.map(summarize));

    if (req.method === "POST" && url.pathname === "/api/items") {
      const input = await body(req);
      const item = { id: newId(), ...input, logs: [{ at: new Date().toISOString(), step: "建档", note: "创建底片" }] };
      db.items.unshift(item);
      await saveDb(db);
      return send(res, 201, item);
    }

    const patch = url.pathname.match(/^\/api\/items\/([^/]+)$/);
    if (patch && req.method === "PATCH") {
      const item = findItem(db, decodeURIComponent(patch[1]));
      if (!item) return send(res, 404, { error: "item_not_found" });
      Object.assign(item, await body(req));
      item.logs ||= [];
      item.logs.push({ at: new Date().toISOString(), step: "状态", note: "更新为" + item.status });
      await saveDb(db);
      return send(res, 200, item);
    }

    const log = url.pathname.match(/^\/api\/items\/([^/]+)\/logs$/);
    if (log && req.method === "POST") {
      const item = findItem(db, decodeURIComponent(log[1]));
      if (!item) return send(res, 404, { error: "item_not_found" });
      const input = await body(req);
      item.logs ||= [];
      item.logs.push({ at: new Date().toISOString(), step: input.step || "记录", note: input.note || "" });
      await saveDb(db);
      return send(res, 201, item);
    }

    const action = url.pathname.match(/^\/api\/items\/([^/]+)\/action$/);
    if (action && req.method === "POST") {
      // 规则层负责判定：余量不足、过期或停用直接抛错，本次步骤不记录、不落盘
      const result = recordAction(db, decodeURIComponent(action[1]), await body(req));
      await saveDb(db);
      return send(res, 201, result);
    }

    if (req.method === "GET" && url.pathname === "/api/stats")
      return send(res, 200, computeStats(db.items));

    return send(res, 404, { error: "not_found" });
  } catch (error) {
    if (error instanceof RuleError)
      return send(res, 422, { error: error.code, reason: error.message });
    send(res, 500, { error: error.message });
  }
});

server.listen(port, () => console.log("古法蓝晒底片整理室 listening on http://localhost:" + port));
