# BNB Guardian V0.0.2

Cloudflare 适配开发版：Pages Functions 提供 API，后台 Worker 每分钟监控 Venus BSC Testnet（97），D1 保存心跳与仓位快照。

**尚未公共部署、注册 ERC-8004、上架市场或发送链上交易；尚未完成参赛资格。**

完整源码和验收：[BNB_Guardian_V0.0.2_source.zip](BNB_Guardian_V0.0.2_source.zip)。原版本保留：[V0.0.1](BNB_Guardian_V0.0.1_source.zip)。仓库当前以源码包发布，下载/clone 后先解压。

```sh
unzip BNB_Guardian_V0.0.2_source.zip -d guardian
cd guardian
npm ci --ignore-scripts
npm test
npm run db:local
npm run build:pages
```

两个终端分别运行 `npm run dev:worker` 和 `npm run dev:pages`。本地 Pages API：http://127.0.0.1:8799。手动测试后台定时任务：

```sh
curl 'http://127.0.0.1:8798/cdn-cgi/local/scheduled?format=json'
node scripts/pages-smoke.js
```

18 项自动测试通过；本地真实 RPC、Cron、D1、重启持久化、Pages/Worker 联动和限流验证通过。对应记录在 ZIP 的 docs 目录。历史证据未改写为新版本结果。

健康检查在 Cron 失败或快照超过 3 分钟时返回 503。RPC 传输层拒绝签名/广播。只监控 Chain 97；健康或无债务仓位不为凑次数操作。偿债、注册、上架的未签名草稿仍须用户确认。

拟在原 Cloudflare 账号新增 Pages 项目 bnb-guardian、后台 Worker bnb-guardian-monitor 和独立 D1；待用户确认部署。数据库全零 ID 仅供本地验证，不能直接用于正式发布。

活动钱包：`0x9F81A9588c310b90A0636E8D2fb31523a57fbaDC`。Agent ID、市场链接、公共服务地址尚无。云端 AI 调用未启用，小创功能图标尚待最高质量入口核实。市场交付联动、第二市场核验、三名独立客户和跨三个 UTC 日期的五次合法操作仍待完成。

详细部署方案、安全边界和资格报告见源码包内 README 与 docs/Workers适配与部署说明.md。
官方活动：https://www.bnbchain.org/en/hackathons/smart-money-era-set-and-earn
