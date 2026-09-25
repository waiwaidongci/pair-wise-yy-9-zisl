// 存取层：唯一碰 JSON 文件的地方。负责读写、旧数据补齐结构、按编号查找。

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data", "cyanotype-negative-room.json");

const seed = {
  items: [
    {
      code: "CN-001",
      plateSize: "18x24cm",
      chemicalBatch: "B-0620",
      exposure: "8分钟",
      waterSource: "井水过滤",
      box: "蓝盒A-03",
      status: "冲洗中",
      defect: "边角显影不均",
      logs: [{ at: "2026-06-20", step: "曝光", note: "阴天补时2分钟" }],
      steps: []
    }
  ],
  batches: [
    {
      id: "BAT-0620",
      code: "B-0620",
      type: "柠檬酸铁铵显影液",
      capacity: 5000,
      remaining: 5000,
      validFrom: "2026-06-01",
      validUntil: "2026-12-31",
      status: "在用",
      createdAt: "2026-06-01T08:00:00.000Z",
      ledger: [
        { at: "2026-06-01T08:00:00.000Z", kind: "登记", amount: 5000, remaining: 5000, operator: "登记员", note: "批次登记入缸" }
      ]
    },
    {
      id: "BAT-0701",
      code: "B-0701",
      type: "草酸铁铵敏化液",
      capacity: 3000,
      remaining: 800,
      validFrom: "2026-07-01",
      validUntil: "2026-08-31",
      status: "停用",
      createdAt: "2026-07-01T08:00:00.000Z",
      ledger: [
        { at: "2026-07-01T08:00:00.000Z", kind: "登记", amount: 3000, remaining: 3000, operator: "登记员", note: "批次登记入缸" },
        { at: "2026-08-31T09:00:00.000Z", kind: "停用", amount: 0, remaining: 800, operator: "值班员", note: "过了可用期，停用待处理" }
      ]
    }
  ]
};

// 旧档案没有 batches 台账、items 没有 steps，读进来时补齐
function normalize(db) {
  db.items ||= [];
  db.batches ||= [];
  for (const item of db.items) {
    item.logs ||= [];
    item.steps ||= [];
  }
  for (const batch of db.batches) {
    batch.ledger ||= [];
    batch.status ||= "在用";
    batch.remaining ??= batch.capacity;
  }
  return db;
}

export async function loadDb() {
  if (!existsSync(dbPath)) {
    await mkdir(dirname(dbPath), { recursive: true });
    await writeFile(dbPath, JSON.stringify(seed, null, 2));
  }
  return normalize(JSON.parse(await readFile(dbPath, "utf8")));
}

export async function saveDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

export function findItem(db, key) {
  return db.items.find(x => x.id === key || x.code === key);
}

export function findBatch(db, key) {
  return db.batches.find(x => x.id === key || x.code === key);
}

export function newItemId() {
  return "CN-" + Date.now();
}
