# BNB Guardian V0.0.3

独立的 Venus Core BSC Testnet（Chain 97）风险监控与用户确认偿债 Agent。**V0.0.3 是本地开发/验收版本；正式云端仍运行 V0.0.2。**

正式服务：[BNB Guardian](https://bnb-guardian.pages.dev) · [健康检查](https://bnb-guardian.pages.dev/healthz)。目前尚无 ERC-8004 身份、真实上架或链上功能交易，**qualified=false**。

## 正常源码目录

`src/`：链读取、风险计算、元数据、AI、市场及回执审计；`scripts/`：草稿与验收命令；`config/`：链/活动参数；`migrations/`：D1 迁移；`test/`：自动测试；`docs/`：来源、真实测试和待确认事项。旧 ZIP 为历史归档，新代码可直接审阅。

## 本地运行

Node.js 22.13+（node:sqlite），已安装的 Ollama 服务可选。不要把私钥写入任何文件；本项目不需要私钥。

```sh
npm ci --ignore-scripts
npm test
AI_PROVIDER=ollama OLLAMA_MODEL=qwen3.5:9b-mlx PORT=8803 npm start
```

本地：http://127.0.0.1:8803。Node 与 Pages/Worker 共用 `src/worker.js`，本地 SQLite 持久化，线上 D1 结构单向增加。不会自动更新 Cloudflare。

| 路径 | 功能 |
|---|---|
| `/healthz`、`/v1/watch` | 定时监控/心跳；过期或失败返回 503 |
| `/agent-registration.json` | ERC-8004 注册元数据 |
| `/.well-known/agent-registration.json` | 域名身份引用 |
| `/.well-known/agent-card.json` | 同一 ERC-8004 元数据的兼容别名；不声称 A2A |
| `/mcp` | 只读 `venus_position` |
| `/v1/position?account=0x…` | 真实仓位与确定性风险 |
| `POST /v1/explain`，JSON `{ "account": "0x…" }` | 模型风险解释；不改变资金动作 |
| `/v1/marketplace/challenge?subId=1&account=0x…` | 用户待确认的只读签名文本 |
| `POST /v1/marketplace/invoke` | 核对真实订阅与订阅者签名，再交付风险报告并保存哈希 |

## ERC-8004 / HelloFugu

Chain 97 IdentityRegistry：`0x8004A818BFB912233c491871b3d84c89A494BD9e`。报名/所有者/暂定操作钱包：`0x9F81A9588c310b90A0636E8D2fb31523a57fbaDC`。

```sh
npm run preflight
npm run prepare -- register config/register-input.json
npm run prepare -- list /绝对路径/list-input.json
npm run prepare -- hire /绝对路径/hire-input.json
npm run prepare -- claim /绝对路径/claim-input.json
npm run prepare -- repay /绝对路径/repay-input.json
npm run qualify
```

只准备短有效期草稿，`broadcast=false`。仿真预测 ID 不是 agent_id。用户签名发送注册后，必须从 `Registered` 回执取得 ID；更新 `config/campaign.json` 的 `registrationTx`、`agentId` 和报名证据，再单独确认上架/雇佣/结算。上架 category 为 3，市场元数据用 inline data URI，身份元数据用正式 HTTPS URI。不能使用他人的身份或重复身份冒充我们的 Agent。

## AI 与资金边界

本轮实测现有本地 `qwen3.5:9b-mlx`，不产生 API 费用。云端不能访问你电脑的 localhost；部署 V0.0.3 并不自动让本地模型持续公网在线。OpenAI Responses 适配也已实现，但默认禁用付费调用；需明确预算确认、`ALLOW_PAID_AI=true`、模型和 secret，公网还需要 `EXPLAIN_API_TOKEN`。AI 仅生成文字，交易参数始终由确定性规则给出并由用户签名。

不得直接把 Ollama 端口暴露到公网。AI 的 `aiVerified=true` 仅证明模型实际响应，不证明文字全部正确；空的 collateral-market 列表不能证明整个协议无未抵押存款。

## 资格与限制

见 [规则与兼容性核验](docs/规则与兼容性核验.md)、[五次功能操作方案](docs/五次功能操作方案.md)、[资格审计报告](docs/资格审计报告.json)、[待确认事项](docs/待确认事项.md)。

仍待：报名证明、测试币、正式 V0.0.3 持续 AI 服务、最高质量小创图标、注册、上架、成功付费雇佣端到端、第二市场、三名独立外部客户及五次真实风险操作跨三日。平台和活动最终审核仍可拒绝资格。所有证据缺失时如实输出 null/[]，不造交易、ID、客户或 listing 链接。
