# BNB Guardian V0.0.1

Venus BSC Testnet（Chain ID 97）借贷风险监控、用户确认偿债草稿和 BNB Chain Set and Earn 证据核验工具。

**开发版：尚未注册 ERC-8004、部署公网服务、上架市场或发送任何链上交易；尚未取得参赛资格。**

完整源码、锁定依赖、测试、Docker 模板、规则比较和资格报告包含在本仓库的 [BNB_Guardian_V0.0.1_source.zip](BNB_Guardian_V0.0.1_source.zip) 中。当前使用源码包发布，下载解压后再运行以下命令；直接 clone 后须先解压 ZIP。

```sh
unzip BNB_Guardian_V0.0.1_source.zip -d guardian
cd guardian
npm ci --ignore-scripts
npm test
npm start
```

要求 Node.js 22+。默认服务 `http://127.0.0.1:8797`，不需要钱包私钥。

| 项目 | 已核实状态 |
|---|---|
| 活动钱包/暂定操作钱包 | `0x9F81A9588c310b90A0636E8D2fb31523a57fbaDC` |
| 网络 | BSC Testnet 97；拒绝主网 |
| ERC-8004 注册表 | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Agent ID | 未注册 |
| 公共服务地址 | 未部署 |
| 市场链接 | 未上架；首选 HelloFugu |
| 已执行功能交易 | 0 |
| 测试 | 10 项本地测试通过；6 项真实只读接口检查返回 200 |
| AI | 解释模块已实现但未配置/实测，当前 rules-only |
| 小创功能图标 | 尚未生成/集成 |

功能：读取 Venus Core 测试网 Comptroller、预言机、账户快照，使用 bigint 计算抵押因子覆盖率，低于 1.25 时准备受限偿债方案、目标 1.50。健康或无债务仓位不为计数产生交易。提供健康检查、ERC-8004 注册元数据、MCP 查询和一分钟轮询。

偿债、注册、上架仅生成未签名交易，须用户确认。没有签名器，不接收借款人的私钥。不把 Token 授权、查询、注册或普通转账计入五次功能操作。当前尚未实现市场订阅驱动执行和第二市场事件适配。

资格核验按真实回执、借贷事件、债务减少与 UTC 日期执行；外部资金独立性、报名、原创性等保留人工/官方审核。不能伪造三名客户或为计数循环借还。

详细技术方案、成本估算、使用步骤、限制与来源见源码包内 README 和 docs。公共持续部署、模型调用、注册/上架、真实外部雇佣、跨三日的五次风险管理操作仍待完成。

官方规则：https://www.bnbchain.org/en/hackathons/smart-money-era-set-and-earn
