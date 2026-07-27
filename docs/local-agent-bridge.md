# Touchstone 本地 Agent 桥接架构

状态：Accepted for incremental implementation
更新时间：2026-07-27

## 决策

Touchstone 的长期主链路是：

```text
Public Web UI
    │ HTTPS / authenticated WebSocket
Public Control Plane
    │ outbound, device-scoped WSS
Local Companion
    ├── Codex app-server (JSON-RPC over stdio)
    ├── Claude Code (stream-json / Agent SDK)
    ├── Gemini CLI (stream-json)
    └── OpenCode (ACP first, REST/SSE second)
```

公网网页不直接启动用户机器上的进程，也不把裸 `browser -> localhost` 作为默认链路。深链只负责下载安装、打开 companion 和提交一次性配对码；配对后的任务与事件走 companion 主动建立的 WSS。

这条边界很重要：网页是展示和控制面，companion 才是本机信任终点。CLI 登录凭证、Git/SSH 凭证、原始工作区和未发布产物默认留在本机。

## 为什么当前实现会误判

旧实现只检查两件事：PATH 中存在命令、登录文件存在。它无法回答：

- 当前实际解析到哪个同名 CLI；
- CLI 是否能在限定时间内启动；
- CLI 版本是否支持选择的模型；
- 结构化输出协议是否存在；
- provider/account 是否真的可用；
- 本地模型缓存是否能被当前 CLI 解析。

因此 `codex 0.137.0 + gpt-5.6-sol` 会显示 ready，真正运行后才收到 400。本仓库现在将健康拆成 `installed`、`authed`、`compatible`、`ready`，并提供逐模型 `modelHealth`；任务创建前会再次做服务端预检。

## Agent 适配优先级

| Agent | 首选接口 | 备用接口 | 备注 |
| --- | --- | --- | --- |
| Codex | `codex app-server` | `codex exec --json` | app-server 有 `model/list`、account、thread/turn、approval、interrupt 等产品级方法。 |
| Claude Code | Agent SDK / `stream-json` | `-p --output-format json` | 现有 CLI 已支持流式输入、工具事件和远程控制，但 Touchstone 不把厂商远控当跨 Agent 总线。 |
| Gemini CLI | headless `stream-json` | headless JSON | 官方事件包含 init、message、tool use/result、error 和 result。 |
| OpenCode | `opencode acp` | `opencode serve` 或 `run --format json` | ACP 便于统一能力协商；REST/SSE 适合服务化接入。 |
| 其他 TUI | 原生 API / ACP | `coder/agentapi` | PTY/TUI diff 解析只作 fallback，不能成为核心事件语义。 |

统一 adapter 至少实现：

```text
inspect() -> version, auth, models, capabilities
start(run) -> session id
events(cursor) -> normalized event stream
sendInput(question/approval)
interrupt()
collectArtifacts()
```

## 协议选择

ACP 适合作为 companion 内部的跨 Agent 抽象：它用 JSON-RPC、初始化能力协商和明确的 session update 表达编辑器与 agent 的关系。远程设备传输仍由 Touchstone 的认证 WSS 负责；不要把尚未稳定的“远程 ACP”直接暴露到公网。

Codex 是例外中的优先原生适配：它的 app-server 能提供比最低公共抽象更完整的模型、账号、审批和线程能力。adapter 可以把这些事件归一化到 Touchstone，同时保留 vendor extension。

## 本地、私有与发布

三种状态必须明确分开：

1. `local/private`：工作区和原始日志留在 companion；控制面只保留最小 run 元数据和可恢复事件游标。
2. `private preview`：只向该 run 的所有者临时转发或加密缓存预览，不进入社区索引。
3. `published`：用户明确点击发布且上传校验完成后，才保存静态 artifact package 并进入公开列表。

`publish: true` 只是意图，不等于公开。服务端以 `publishState: published` 作为公开判定。

作品交付默认采用一个自包含 `index.html`，降低缓存、同步和资源丢失带来的失败率。用户也可以在任务表单中切换为“静态 HTML 入口 + 相对资源目录”或直接编辑自定义约束。用户 Prompt 与交付约束分开保存，服务端在启动 Agent 前完成最终拼接，并把最终约束写入运行目录的 `AGENTS.md`。所有模式都不得依赖 CDN、localhost 服务、密钥或父目录文件；上传时拒绝隐藏文件、凭证、数据库、脚本和超限资源。

所有服务端预览必须在无 `allow-same-origin` 的 iframe/CSP sandbox 中运行。更成熟的部署应把 artifact renderer 放在独立的无 Cookie 域名，例如 `preview.touchstoneusercontent.com`。

## Skills

- Local Bridge 只扫描各 Agent 的标准本地 Skill 目录，不上传 `SKILL.md` 内容或本机路径。
- 用户可以为一次任务显式选择已安装的 Skills；服务端会验证每个目标 Agent 都已安装，然后把 Skill 名称追加到执行 Prompt。
- 一键安装只接受 `skills/catalog.json` 白名单。Touchstone 自维护 Skill 从随仓库发布的目录复制；第三方热门 Skill 通过 Vercel Labs 的 `skills` CLI 安装到指定 Agent。
- 生产环境默认关闭本机写入。可信的个人本地服务需要显式设置 `TOUCHSTONE_ALLOW_SKILL_INSTALL=1`。
- 第三方 Skill 属于供应链输入；界面必须展示来源、维护方和安装目标，不支持用户从网页提交任意 Git URL 或 shell 命令。

## 配对与安全边界

companion 配对流程：

1. 已登录用户在网页请求一次性 enrollment code；
2. 用户通过已签名 companion 或深链提交 code；
3. 控制面签发设备级 token，只显示一次，服务端仅存哈希；
4. companion 用 token 主动连接 WSS，并上报版本与 adapter capabilities；
5. 每个 run 明确绑定 `userId + deviceId`；
6. 用户可在网页撤销设备，服务端立即关闭连接并拒绝重连。

要求：

- token 不进入 URL 日志；配对码短期、单次使用；
- 每条任务、事件、输入和 artifact 都做 owner/device 校验；
- WebSocket 不做全局广播；
- adapter 命令和工作目录由服务端结构化下发，不能接受任意 shell 字符串；
- approval 决策可审计，危险操作默认不能静默升级；
- companion 与 CLI 版本要有最低兼容矩阵和强制升级提示；
- 日志上传前做 secret redaction，公开发布不包含原始执行日志。

## 可借鉴的仓库

- [openai/codex app-server](https://github.com/openai/codex/tree/main/codex-rs/app-server)：Codex 原生结构化集成。
- [agentclientprotocol/agent-client-protocol](https://github.com/agentclientprotocol/agent-client-protocol)：统一 Agent 客户端协议与 SDK。
- [anomalyco/opencode](https://github.com/anomalyco/opencode)：原生 ACP、headless server、REST/SSE。
- [coder/agentapi](https://github.com/coder/agentapi)：多 CLI HTTP/SSE fallback，覆盖 Codex、Claude、Gemini、OpenCode 等。
- [tiann/hapi](https://github.com/tiann/hapi)：最接近 Touchstone 的多 Agent 远程 gateway 参考。
- [summon-app/happy](https://github.com/summon-app/happy)：远程启动、查看和管理本机 coding session 的产品参考。
- [aaif-goose/goose](https://github.com/aaif-goose/goose)：多 provider、API、ACP 和 MCP 的组合参考。
- [coder/coder](https://github.com/coder/coder)：设备/工作区控制面、网络与审计参考。
- [MDN native-messaging example](https://github.com/mdn/webextensions-examples/tree/master/native-messaging)：只有需要浏览器 Cookie/标签页能力时才采用的扩展桥。
- [tauri-apps/plugins-workspace](https://github.com/tauri-apps/plugins-workspace)：companion 的深链、shell、WebSocket 与更新能力参考。

## 分阶段落地

### Phase 0：当前仓库

- 版本、启动超时、认证和逐模型兼容预检；
- Codex 去掉废弃 `--full-auto`；
- Claude/Gemini/OpenCode 结构化输出配置；
- 私有 run 的 REST、WebSocket、日志、文件和 workspace 隔离；
- sandbox preview；
- 部署脚本同步 `agents.json` 与完整 server modules。

### Phase 1：Local Companion

- 设备 enrollment、撤销和 outbound WSS；
- adapter registry 与 capability negotiation；
- durable event cursor、断线重连和 run interrupt；
- 默认只传事件，不上传工作区。

### Phase 2：私有预览与发布

- 独立 preview origin；
- 私有按需 artifact relay 或端到端加密缓存；
- 显式 publish package、哈希清单和内容扫描；
- companion 签名更新与兼容矩阵。

### Phase 3：浏览器扩展（可选）

只有任务需要现有浏览器 session、Cookie 或标签页控制时，才增加 extension + Native Messaging host。它不是 coding CLI 主链路。
