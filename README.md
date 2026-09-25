# 古法蓝晒底片整理室

运行：

```bash
npm start
```

访问`http://localhost:3040`。数据保存在`data/cyanotype-negative-room.json`。

## 分层

- `src/rules.js` — 规则：批次登记校验、可用性判定（停用 / 过期 / 余量不足）、冲洗扣量、补液、停用启用、按批次反查底片。纯函数，不碰文件。
- `src/store.js` — 存取：JSON 文件读写、旧档案结构补齐（自动补 `batches` 台账）、按编号查找。
- `src/page.js` — 页面：全部 HTML/前端脚本。
- `server.js` — 路由：只做 HTTP 解析与应答，串起上面三层。

## 药液批次台账

- 登记批次：编号、类型、容量（ml）、可用起止日期，登记即入台账。
- 冲洗（步骤选"冲洗"）必须选批次、填用量和操作人：从批次余量扣量，台账记一笔"冲洗扣量"（含操作人、底片去向），底片步骤里也记下批次编号，双向可查。
- 余量不足、已过可用日期、已停用的批次会拒绝冲洗并说明原因，本次步骤不记录。
- 补液、停用、启用都进台账流水；批次详情可反查所有用过它的底片。

## 接口

- `GET/POST /api/batches`，`GET /api/batches/:id`（含 `films` 反查）
- `POST /api/batches/:id/replenish` `{amount, operator, note}`
- `POST /api/batches/:id/status` `{status: "在用"|"停用", operator}`
- `POST /api/items/:id/action` 冲洗时带 `{step:"冲洗", batchId, amount, operator}`
