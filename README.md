# BNB Guardian V0.0.2

Cloudflare 适配开发版：Pages Functions 提供公网 API，独立 Worker 每分钟监控 Venus BSC Testnet（97）仓位，D1 保存监控快照和心跳。已于 2026-10-12 部署至 https://bnb-guardian.pages.dev。Agent 尚未注册、上架或执行链上交易。

## 本地运行

要求 Node.js 22+。

```sh
npm ci --ignore-scripts
npm test
npm run db:local
npm run build:pages
```

在两个终端分别启动：

```sh
npm run dev:worker
npm run dev:pages
```

- 后台 Worker 本地地址：http://127.0.0.1:8798
- Pages API 本地地址：http://127.0.0.1:8799
- 健康检查：/healthz；注册卡：/agent-registration.json；MCP：/mcp
- 在本地手动触发 Cron（公开 Pages 不提供此入口）：

```sh
curl 'http://127.0.0.1:8798/cdn-cgi/local/scheduled?format=json'
node scripts/pages-smoke.js
```

本地开发不会自动按云端 Cron 调度；需手动调用上述入口。首次成功执行前或结果超过 3 分钟，健康检查返回 503。云端 Cron 默认每分钟，部署后才会自动运行。

## 风险与安全

保留 V0.0.1 的 Venus 快照、预言机、抵押因子覆盖率计算与用户确认偿债草稿。默认触发 1.25，目标 1.50，主网拒绝。无债务/健康仓位不生成偿债方案。覆盖率不是 Aave 清算阈值 HF。

RPC 传输改为标准 fetch，可同时运行于 Node 和 Workers。传输层显式拒绝签名/广播方法；Worker 每次调用最多 45 次 RPC，定时监控最多 3 个地址，超限明确失败。公网 API 每分钟每来源最多 60 次请求；Pages 使用 D1 原子计数，后台 Worker 使用平台限流。D1 不保存原始 IP，过期限流记录由 Cron 清理。

用户确认交易工具仍为本地 CLI：

```sh
node scripts/prepare.js repay /绝对路径/输入.json
node scripts/prepare.js register /绝对路径/输入.json
node scripts/prepare.js list /绝对路径/输入.json
npm run qualify
```

没有签名器，没有私钥。本版云端不启用收费 AI 调用，AI 解释保留在本地 scripts/explain.js；未配置模型时标记 rules-only。

## 部署准备

同一 Cloudflare 账号中已新增三个独立资源：Pages 项目 bnb-guardian、Cron Worker bnb-guardian-monitor、D1 bnb-guardian-monitor。公网域名为 bnb-guardian.pages.dev，两份配置已设置实际 D1 ID。

用户确认部署后：创建数据库→把实际 ID 写入两个配置→应用远端迁移→建立 Pages 项目→上传 Pages→部署后台 Worker→等待 Cron 生效并从公网验证。完整步骤见 docs/Workers适配与部署说明.md。

## 验收和剩余工作

18 项自动测试通过；真实测试网本地 Cron、持久化、重启后查询与 Pages/Worker 联动结果见 docs 的 JSON 报告。V0.0.1 的历史证据按原字节保存在 docs/history/v0.0.1，未改写为新版本结果。

仍待完成：公网持续运行验证、最高质量小创功能图标、真实 AI 调用、ERC-8004 注册、市场上架与交付联动、第二市场事件适配、真实独立外部雇佣和跨三个 UTC 日期的五次合法功能操作。qualified=false，不承诺获奖。

活动钱包：0x9F81A9588c310b90A0636E8D2fb31523a57fbaDC。
公开仓库：https://github.com/259906573-ship-it/bnb-guardian
