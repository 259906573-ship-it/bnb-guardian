# BNB Guardian V0.0.2 Cloudflare 适配

本轮授权：修改代码与本地验证。用户最初要求签名、付款、部署等须确认，因此本轮没有创建云端资源、启用收费计划或执行链上操作。

## 已完成

- 保留 V0.0.1，另存 V0.0.2。
- 去掉链读取代码对本机文件系统/Node HTTP RPC 客户端的依赖；使用 JSON 模块和 fetch RPC。
- Worker `scheduled()` 每分钟读取链 97 和 Venus 仓位，D1 原子批次保存快照及心跳。
- Pages Advanced Mode `_worker.js` 提供 HTTP 与 MCP，读取同一 D1 的定时结果。
- 成功心跳过期 3 分钟或失败时健康状态为 503，Agent Card active=false。
- API 请求体最多 8 KiB；单次 RPC 最多 45 次；监控地址最多 3 个；60 次/分钟限流。
- 存储旧心跳时使用时间条件，避免晚到的旧任务覆盖新结果；失败信息不含 RPC URL/密钥。
- RPC 方法白名单中没有签名、发交易方法。后台只读监控；偿债草稿仍需本地生成和用户确认。

## 为什么使用 Pages + 后台 Worker

之前的 `.pages.dev` 托管环境和账号已经实时确认。旧 DeQQ 的 workers.dev 地址在当前网络请求超时，不能据此断言全球不可用。新项目选择 pages.dev API 入口，后台 Worker 不开放 workers.dev HTTP 路由，只执行 Cron。

## 拟部署的具体资源

| 资源 | 名称/配置 | 作用 |
|---|---|---|
| Pages | bnb-guardian / wrangler.json | 公共注册卡、健康接口、MCP 和仓位查询 |
| Worker | bnb-guardian-monitor / wrangler.worker.json | 每分钟的 UTC Cron 检查 |
| D1 | bnb-guardian-monitor | 独立监控/限流数据库 |

拟公开地址 `https://bnb-guardian.pages.dev`，尚未创建或验证，名称可用性以实际创建结果为准。两个配置使用相同的真实 D1 ID；当前全零 ID 是本地占位。

预计先在既有免费额度内试运行，不购买服务器/域名。CPU、动态请求、D1 额度由同账号共享，正式上线后须核对实际用量；不能根据本地测试保证免费套餐一定够用。需要收费升级时另行确认。

## 用户确认后执行的部署步骤

以下仅为准备好的步骤，本轮未执行。

1. 在已核实的 Cloudflare 账号创建 `bnb-guardian-monitor` D1，保存实际数据库 ID。
2. 把实际 ID 写入两个配置，确保绑定仅指向新数据库；应用 migrations/0001_monitor.sql 和 0002_rate_limits.sql。
3. 创建独立 Pages 项目 bnb-guardian（生产分支 main）。设置实际 HTTPS `PUBLIC_BASE_URL`，保持 chain 97。
4. 本地重新构建并扫描包；上传 dist-pages。暂未有 Cron 成功结果时健康检查应为 503。
5. 部署后台 Worker，启用 `* * * * *` Cron。调度配置可能需要最多约 15 分钟传播。
6. 验证公网 Pages 健康状态、注册卡域名、MCP 实际调用、D1 定时记录至少两次更新、过期/故障状态、额度和限流。
7. 记录实际部署 URL、发布 ID 和 UTC 观测区块；随后再准备 ERC-8004 注册，上链仍单独确认。

Wrangler compatibility_date 固定 2026-10-02，对应所锁定本地运行时支持的日期；这是行为兼容日期，不是文档日期。Wrangler 固定 4.141.0，依赖可复现。

## 当前不足

没有公共部署结果。AI 接口没有实际模型调用；小创功能图标未生成/集成，因为当前工具未暴露最高质量模型/设置的核实入口。这些不足在本版继续保留，不冒充正式参赛 Agent。

## 官方参考

- https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/pages/functions/advanced-mode/
- https://developers.cloudflare.com/pages/functions/wrangler-configuration/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/workers/platform/pricing/
