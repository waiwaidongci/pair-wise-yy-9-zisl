// 存取层：只负责 JSON 文件台账的读写和初始化，不含任何业务判断。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "data", "cyanotype-negative-room.json");

const seed = {
  "batches": [
    {
      "id": "CB-2026060101",
      "code": "B-0620",
      "type": "显影液",
      "capacity": 1000,
      "remaining": 520,
      "startDate": "2026-06-01",
      "expireDate": "2026-07-15",
      "active": true,
      "ledger": [
        { "at": "2026-06-01T01:00:00.000Z", "kind": "建档", "amount": 1000, "operator": "", "note": "登记建档，初始容量 1000ml" }
      ]
    },
    {
      "id": "CB-2026092001",
      "code": "B-0920",
      "type": "显影液",
      "capacity": 800,
      "remaining": 800,
      "startDate": "2026-09-20",
      "expireDate": "2026-10-20",
      "active": true,
      "ledger": [
        { "at": "2026-09-20T01:00:00.000Z", "kind": "建档", "amount": 800, "operator": "", "note": "登记建档，初始容量 800ml" }
      ]
    }
  ],
  "items": [
    {
      "code": "CN-001",
      "plateSize": "18x24cm",
      "chemicalBatch": "B-0620",
      "exposure": "8分钟",
      "waterSource": "井水过滤",
      "box": "蓝盒A-03",
      "status": "冲洗中",
      "defect": "边角显影不均",
      "logs": [
        {
          "at": "2026-06-20",
          "step": "曝光",
          "note": "阴天补时2分钟"
        }
      ]
    }
  ]
};

export async function loadDb() {
  if (!existsSync(dbPath)) {
    await mkdir(dirname(dbPath), { recursive: true });
    await writeFile(dbPath, JSON.stringify(seed, null, 2));
  }
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  // 旧台账没有批次表时补齐，规则层始终能拿到数组
  db.items ||= [];
  db.batches ||= [];
  return db;
}

export async function saveDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

export function newId() { return "CN-" + Date.now(); }
