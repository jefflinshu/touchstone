export const OSS_RADAR_UPDATED_AT = "2026-07-01"

export const OSS_RADAR_SOURCE = {
  "initializedCount": 21,
  "githubSnapshotAt": "2026-07-01T13:04:48.534Z",
  "xWindow": {
    "from": "",
    "to": "2026-07-01",
    "status": "not-fetched"
  },
  "curationMode": "emerging-ai-devtools",
  "note": "Curated for discovery value: emerging AI agent, MCP, context-engineering, security, gateway, and workflow projects. Famous baseline projects are intentionally excluded."
}

export const OSS_RADAR_REPOS = [
  {
    "id": "dao-code",
    "repo": "tigicion/dao-code",
    "categories": [
      "ai-agents"
    ],
    "tags": [
      "terminal agent",
      "DeepSeek",
      "Claude Code compatible"
    ],
    "collectReason": "收录。不是通用大项目，而是针对 DeepSeek V4 价格/缓存特性做工程化的终端 coding agent，适合观察低成本 agent 方向。",
    "thesis": "If prefix-cache economics matter, coding agents may fork into model-native harnesses instead of one-size-fits-all clients.",
    "watchFor": "Whether byte-stable prompts, cache-reusing forks, and Claude Code-compatible config become reproducible advantages.",
    "risks": "Young repo, small maintainer surface, and DeepSeek-specific assumptions may age quickly.",
    "xKeywords": [
      "dao-code",
      "DeepSeek coding agent",
      "Claude Code compatible agent"
    ],
    "name": "dao-code",
    "url": "https://github.com/tigicion/dao-code",
    "homepage": "https://www.npmjs.com/package/dao-code",
    "description": "Open-source TypeScript terminal coding agent for DeepSeek-V4 — builds on DeepSeek's strong price-performance and ultra-cheap cache pricing, engineering byte-stable prefixes and cache-reusing forks so cross-session memory and a continuous self-correction layer add almost no token cost; 1M context, Skills/MCP/Hooks, Claude Code config compatible.",
    "language": "TypeScript",
    "stars": 929,
    "forks": 19,
    "issues": 3,
    "license": "MIT",
    "pushedAt": "2026-07-01T13:00:20Z",
    "createdAt": "2026-06-08T08:10:42Z",
    "decision": "include"
  },
  {
    "id": "trace-mcp",
    "repo": "nikolai-vysotskyi/trace-mcp",
    "categories": [
      "mcp",
      "context"
    ],
    "tags": [
      "MCP",
      "trace",
      "agent exploration"
    ],
    "collectReason": "收录。定位很窄：减少 Claude Code/Codex 的探索成本。比泛 MCP server 更像一个可验证的 agent workflow primitive。",
    "thesis": "Trace-oriented MCP tools can compress the expensive “figure out this codebase” phase of coding agents.",
    "watchFor": "Real before/after traces, supported languages, and whether agents consistently avoid redundant grep/read loops.",
    "risks": "Claim depends on project shape; weak if it only helps demo repositories.",
    "xKeywords": [
      "trace-mcp",
      "MCP Claude Code Codex",
      "agent exploration MCP"
    ],
    "name": "trace-mcp",
    "url": "https://github.com/nikolai-vysotskyi/trace-mcp",
    "homepage": "https://trace-mcp.com",
    "description": "MCP server for Claude Code and Codex. One tool call replaces ~42 minutes of agent exploration",
    "language": "TypeScript",
    "stars": 90,
    "forks": 13,
    "issues": 11,
    "license": "MIT",
    "pushedAt": "2026-07-01T13:04:08Z",
    "createdAt": "2026-04-03T09:54:03Z",
    "decision": "include"
  },
  {
    "id": "lean-ctx",
    "repo": "yvgude/lean-ctx",
    "categories": [
      "context",
      "security"
    ],
    "tags": [
      "context engineering",
      "local-first",
      "MCP"
    ],
    "collectReason": "收录。把“agent 能看到什么、记住什么、改什么”做成本地 Rust context layer，方向比普通 RAG 更接近 agent control plane。",
    "thesis": "Context control is becoming infrastructure: selection, memory, permissions, and receipts need one local layer.",
    "watchFor": "Whether it can stay simple while supporting many MCP tools and real coding-agent policies.",
    "risks": "Large tool surface can become hard to audit; verify security claims before trusting it with private repos.",
    "xKeywords": [
      "LeanCTX",
      "context engineering agents",
      "MCP context layer"
    ],
    "name": "lean-ctx",
    "url": "https://github.com/yvgude/lean-ctx",
    "homepage": "https://leanctx.com",
    "description": "Control what your AI can see. LeanCTX (Lean Context) is the context intelligence layer for AI agents — one local Rust binary that decides what they read, remembers what they learn, guards what they touch, and proves what they save. 60–90% fewer tokens as the receipt. 76 MCP tools, 30+ agents, local-first.",
    "language": "Rust",
    "stars": 3043,
    "forks": 292,
    "issues": 3,
    "license": "Apache-2.0",
    "pushedAt": "2026-07-01T12:57:39Z",
    "createdAt": "2026-03-23T19:48:59Z",
    "decision": "include"
  },
  {
    "id": "context-mode",
    "repo": "mksglu/context-mode",
    "categories": [
      "context",
      "devtools"
    ],
    "tags": [
      "context window",
      "hooks",
      "MCP"
    ],
    "collectReason": "收录。聚焦 context window 优化和工具输出沙箱，解决的是 coding agent 实际跑长任务时的成本/噪音问题。",
    "thesis": "The next agent productivity gain may come from shrinking tool output before it reaches the model.",
    "watchFor": "Measured token savings, integration quality across clients, and whether routing rules are maintainable.",
    "risks": "Compression can hide important failure context if policies are too aggressive.",
    "xKeywords": [
      "context-mode",
      "AI coding agent context window",
      "MCP hooks context"
    ],
    "name": "context-mode",
    "url": "https://github.com/mksglu/context-mode",
    "homepage": "https://context-mode.com",
    "description": "Context window optimization for AI coding agents. Sandboxes tool output (98% reduction), persists session memory, and   enforces routing across 17 platforms via MCP + hooks.",
    "language": "TypeScript",
    "stars": 18418,
    "forks": 1293,
    "issues": 25,
    "license": "NOASSERTION",
    "pushedAt": "2026-07-01T12:54:06Z",
    "createdAt": "2026-02-23T05:56:28Z",
    "decision": "include"
  },
  {
    "id": "headroom",
    "repo": "headroomlabs-ai/headroom",
    "categories": [
      "context",
      "devtools"
    ],
    "tags": [
      "token compression",
      "MCP server",
      "proxy"
    ],
    "collectReason": "收录。对 tool outputs/logs/RAG chunks 做压缩，直接对应 agent 成本和上下文污染问题。",
    "thesis": "Agent infrastructure will need loss-aware compression between tools and models.",
    "watchFor": "Quality benchmarks under real debugging/log-heavy workloads, not only synthetic compression ratios.",
    "risks": "High compression ratios are easy to market; harder to preserve rare but important details.",
    "xKeywords": [
      "headroomlabs headroom",
      "tool output compression",
      "MCP token compression"
    ],
    "name": "headroom",
    "url": "https://github.com/headroomlabs-ai/headroom",
    "homepage": "https://headroomlabs-ai.github.io/headroom/",
    "description": "Compress tool outputs, logs, files, and RAG chunks before they reach the LLM. 60-95% fewer tokens, same answers. Library, proxy, MCP server.",
    "language": "Python",
    "stars": 55014,
    "forks": 3967,
    "issues": 463,
    "license": "Apache-2.0",
    "pushedAt": "2026-07-01T04:53:00Z",
    "createdAt": "2026-01-07T19:58:51Z",
    "decision": "include"
  },
  {
    "id": "codegraph",
    "repo": "colbymchenry/codegraph",
    "categories": [
      "context",
      "devtools"
    ],
    "tags": [
      "code graph",
      "local index",
      "semantic retrieval"
    ],
    "collectReason": "收录。预索引 code knowledge graph，面向 Claude Code/Codex/Gemini 等工具，是“少读文件少烧 token”的明确尝试。",
    "thesis": "Local code graphs can become a standard sidecar for serious coding agents.",
    "watchFor": "Index freshness, language coverage, and whether graph retrieval beats ripgrep plus embedding search.",
    "risks": "May be expensive to maintain on large monorepos; stale graph data can mislead agents.",
    "xKeywords": [
      "codegraph coding agent",
      "local code knowledge graph",
      "Claude Code Codex codegraph"
    ],
    "name": "codegraph",
    "url": "https://github.com/colbymchenry/codegraph",
    "homepage": "https://colbymchenry.github.io/codegraph/",
    "description": "Pre-indexed code knowledge graph, auto syncs on code changes, for Claude Code, Codex, Gemini, Cursor, OpenCode, AntiGravity, Kiro, and Hermes Agent — fewer tokens, fewer tool calls, 100% local",
    "language": "TypeScript",
    "stars": 56641,
    "forks": 3493,
    "issues": 268,
    "license": "MIT",
    "pushedAt": "2026-07-01T11:50:01Z",
    "createdAt": "2026-01-18T21:45:37Z",
    "decision": "include"
  },
  {
    "id": "multica",
    "repo": "multica-ai/multica",
    "categories": [
      "ai-agents",
      "workflow"
    ],
    "tags": [
      "managed agents",
      "team workflows",
      "skills"
    ],
    "collectReason": "收录。把 coding agents 包装成可分配任务、可跟踪进度、可复用技能的团队协作层，值得观察产品化路径。",
    "thesis": "The interface for agents may shift from chat/CLI to task assignment and progress tracking.",
    "watchFor": "Whether it supports real multi-repo work, permission boundaries, and durable skill reuse.",
    "risks": "Could become another project-management wrapper if execution reliability is not there.",
    "xKeywords": [
      "multica agents",
      "managed coding agents",
      "agent teammate platform"
    ],
    "name": "multica",
    "url": "https://github.com/multica-ai/multica",
    "homepage": "https://multica.ai",
    "description": "The open-source managed agents platform. Turn coding agents into real teammates — assign tasks, track progress, compound skills.",
    "language": "Go",
    "stars": 38690,
    "forks": 4835,
    "issues": 1131,
    "license": "NOASSERTION",
    "pushedAt": "2026-07-01T12:12:43Z",
    "createdAt": "2026-01-13T17:59:46Z",
    "decision": "include"
  },
  {
    "id": "repoprompt-ce",
    "repo": "repoprompt/repoprompt-ce",
    "categories": [
      "context",
      "devtools"
    ],
    "tags": [
      "macOS",
      "context engineering",
      "MCP CLI"
    ],
    "collectReason": "收录。RepoPrompt CE 是面向 coding agents 的本地 context app，不是泛 AI 工具，和日常 repo 工作流贴得很近。",
    "thesis": "Human-curated context packs may remain valuable even as agents get better retrieval.",
    "watchFor": "MCP CLI depth, native macOS UX, and whether teams can share reproducible context sets.",
    "risks": "Desktop-first workflow may limit server/CI agent adoption.",
    "xKeywords": [
      "RepoPrompt CE",
      "context engineering app",
      "AI coding agents MCP"
    ],
    "name": "repoprompt-ce",
    "url": "https://github.com/repoprompt/repoprompt-ce",
    "homepage": "https://repoprompt.com",
    "description": "Community edition of RepoPrompt: a native macOS context engineering app for AI coding agents, with an MCP CLI.",
    "language": "Swift",
    "stars": 734,
    "forks": 92,
    "issues": 76,
    "license": "Apache-2.0",
    "pushedAt": "2026-07-01T13:04:16Z",
    "createdAt": "2026-05-12T19:44:16Z",
    "decision": "include"
  },
  {
    "id": "mfs",
    "repo": "zilliztech/mfs",
    "categories": [
      "context",
      "mcp"
    ],
    "tags": [
      "file-like context",
      "memory",
      "search"
    ],
    "collectReason": "收录。把分散的代码、记忆、文档、数据库、SaaS context 抽成可搜索浏览的 file-like interface，适合 agent 长任务。",
    "thesis": "Agents need a filesystem metaphor for heterogeneous context, not just separate connectors.",
    "watchFor": "Connector quality, latency, and whether permissions map cleanly to the file-like abstraction.",
    "risks": "Broad scope can dilute reliability; enterprise connectors increase security burden.",
    "xKeywords": [
      "zilliz mfs",
      "agent context harness",
      "file-like interface agents"
    ],
    "name": "mfs",
    "url": "https://github.com/zilliztech/mfs",
    "homepage": "https://zilliztech.github.io/mfs/",
    "description": "A context harness for AI agents: all your scattered context — code, memory, docs, databases, SaaS — in one searchable, browsable, file-like interface.",
    "language": "Python",
    "stars": 70,
    "forks": 9,
    "issues": 1,
    "license": "Apache-2.0",
    "pushedAt": "2026-07-01T12:58:14Z",
    "createdAt": "2026-04-20T09:43:04Z",
    "decision": "include"
  },
  {
    "id": "better-code-review-graph",
    "repo": "n24q02m/better-code-review-graph",
    "categories": [
      "devtools",
      "context"
    ],
    "tags": [
      "code review",
      "knowledge graph",
      "semantic search"
    ],
    "collectReason": "收录。小而具体：把语义搜索和调用图用于 token-efficient code review，比大而全 agent 更容易验证价值。",
    "thesis": "Review agents need structure-aware retrieval more than raw diff summarization.",
    "watchFor": "Whether call-graph resolution catches real review issues across languages.",
    "risks": "Low star base and narrow scope; may be prototype-quality.",
    "xKeywords": [
      "better-code-review-graph",
      "AI code review graph",
      "token efficient code review"
    ],
    "name": "better-code-review-graph",
    "url": "https://github.com/n24q02m/better-code-review-graph",
    "homepage": "https://mcp.n24q02m.com/servers/better-code-review-graph/",
    "description": "Knowledge graph for token-efficient code reviews -- semantic search and call-graph resolution across your codebase.",
    "language": "Python",
    "stars": 57,
    "forks": 9,
    "issues": 2,
    "license": "MIT",
    "pushedAt": "2026-07-01T12:59:37Z",
    "createdAt": "2026-03-20T11:11:32Z",
    "decision": "include"
  },
  {
    "id": "codex-pooler",
    "repo": "icoretech/codex-pooler",
    "categories": [
      "devtools",
      "workflow"
    ],
    "tags": [
      "Codex gateway",
      "self-hosted",
      "teams"
    ],
    "collectReason": "收录。自托管 Codex gateway 是一个明确的团队基础设施需求，不是泛泛的 agent demo。",
    "thesis": "Teams will want shared gateways for rate limits, routing, audit, and cost control around coding agents.",
    "watchFor": "Queueing semantics, auth model, and whether it survives concurrent team workloads.",
    "risks": "Needs careful credential handling; immature gateways can create hidden operational risk.",
    "xKeywords": [
      "codex-pooler",
      "self-hosted Codex gateway",
      "Codex team gateway"
    ],
    "name": "codex-pooler",
    "url": "https://github.com/icoretech/codex-pooler",
    "homepage": "https://docs.codex-pooler.com/",
    "description": "The full featured self-hosted Codex gateway, for teams, agents and you",
    "language": "Elixir",
    "stars": 78,
    "forks": 4,
    "issues": 6,
    "license": "NOASSERTION",
    "pushedAt": "2026-07-01T12:54:58Z",
    "createdAt": "2026-05-24T02:16:31Z",
    "decision": "include"
  },
  {
    "id": "blade-deepseek",
    "repo": "echoVic/blade-deepseek",
    "categories": [
      "ai-agents"
    ],
    "tags": [
      "DeepSeek",
      "coding agent",
      "terminal"
    ],
    "collectReason": "收录。DeepSeek-native terminal coding agent，和 dao-code 一起观察“模型原生 coding agent”分叉趋势。",
    "thesis": "Cheaper reasoning models can create a parallel ecosystem of cost-optimized coding agents.",
    "watchFor": "Tool loop quality, edit reliability, and whether prefix-cache tricks are real product advantages.",
    "risks": "Very early project; likely volatile API and small community.",
    "xKeywords": [
      "blade-deepseek",
      "DeepSeek-native coding agent",
      "Orca coding agent"
    ],
    "name": "blade-deepseek",
    "url": "https://github.com/echoVic/blade-deepseek",
    "homepage": "",
    "description": "Orca is a DeepSeek-native coding agent.",
    "language": "Rust",
    "stars": 134,
    "forks": 0,
    "issues": 0,
    "license": "NOASSERTION",
    "pushedAt": "2026-07-01T12:54:34Z",
    "createdAt": "2026-06-05T07:19:56Z",
    "decision": "include"
  },
  {
    "id": "clownfish",
    "repo": "openclaw/clownfish",
    "categories": [
      "workflow",
      "ai-agents"
    ],
    "tags": [
      "issue triage",
      "Codex harness",
      "maintainers"
    ],
    "collectReason": "收录。面向 maintainer 的批量 issue cluster 处理，切入点比“又一个聊天 agent”更实际。",
    "thesis": "Maintainer workflows may be one of the first places coding agents become batch infrastructure.",
    "watchFor": "Issue clustering quality, patch review loop, and safe failure handling at scale.",
    "risks": "Automation around issue resolution can create noisy PRs if guardrails are weak.",
    "xKeywords": [
      "openclaw clownfish",
      "maintainer codex harness",
      "bulk issue coding agent"
    ],
    "name": "clownfish",
    "url": "https://github.com/openclaw/clownfish",
    "homepage": "",
    "description": "Clownfish is a maintainer codex harness for resolving clusters of issues identified in bulk at scale. 🐠",
    "language": "JavaScript",
    "stars": 56,
    "forks": 18,
    "issues": 1,
    "license": "NOASSERTION",
    "pushedAt": "2026-07-01T12:53:25Z",
    "createdAt": "2026-04-25T01:05:15Z",
    "decision": "include"
  },
  {
    "id": "skills-manager",
    "repo": "Rito-w/skills-manager",
    "categories": [
      "skills",
      "devtools"
    ],
    "tags": [
      "skills marketplace",
      "Claude",
      "Cursor"
    ],
    "collectReason": "收录。跨 AI IDE 的 skills manager，反映 agent 技能分发开始从 repo 手抄走向 marketplace/installer。",
    "thesis": "Skills/plugins may become the package manager layer for agent behavior.",
    "watchFor": "Registry quality, versioning, trust model, and support across Claude/Cursor/Windsurf.",
    "risks": "Skill marketplaces can become prompt spam without curation and signing.",
    "xKeywords": [
      "skills-manager AI IDE",
      "Claude skills manager",
      "agent skills marketplace"
    ],
    "name": "skills-manager",
    "url": "https://github.com/Rito-w/skills-manager",
    "homepage": "https://rito-w.github.io/skills-manager/",
    "description": "A cross-platform skills manager for AI IDEs. Search marketplace, download locally, and install to Claude, Cursor, Windsurf, and more with one click.",
    "language": "Vue",
    "stars": 189,
    "forks": 14,
    "issues": 7,
    "license": "NOASSERTION",
    "pushedAt": "2026-07-01T13:00:52Z",
    "createdAt": "2026-02-04T16:01:42Z",
    "decision": "include"
  },
  {
    "id": "caido-mcp-server",
    "repo": "c0tton-fluff/caido-mcp-server",
    "categories": [
      "mcp",
      "security"
    ],
    "tags": [
      "Caido",
      "HTTP traffic",
      "security testing"
    ],
    "collectReason": "收录。把 Caido proxy 暴露给 MCP，说明安全测试工具正在变成 agent 可操作环境。",
    "thesis": "Security agents need controlled access to traffic inspection tools, not just scanners.",
    "watchFor": "Permissioning, audit logs, and whether it supports safe read-only analysis modes.",
    "risks": "High misuse potential; should be treated as security tooling, not casual automation.",
    "xKeywords": [
      "caido mcp server",
      "MCP security testing",
      "Claude Code Caido"
    ],
    "name": "caido-mcp-server",
    "url": "https://github.com/c0tton-fluff/caido-mcp-server",
    "homepage": "",
    "description": "MCP server for Caido proxy integration. Enables AI assistants like Claude Code to browse, analyse, and interact with HTTP traffic.",
    "language": "Go",
    "stars": 76,
    "forks": 17,
    "issues": 0,
    "license": "MIT",
    "pushedAt": "2026-07-01T12:51:36Z",
    "createdAt": "2026-01-29T19:26:12Z",
    "decision": "include"
  },
  {
    "id": "aigis",
    "repo": "killertcell428/aigis",
    "categories": [
      "security"
    ],
    "tags": [
      "agent firewall",
      "prompt injection",
      "compliance"
    ],
    "collectReason": "收录。Agent firewall 是真实刚需，尤其是 MCP rug-pull、memory poisoning、exfiltration 这些新型攻击面。",
    "thesis": "As agents get tool access, policy enforcement needs to sit inside the tool loop.",
    "watchFor": "Rule transparency, false positives, and coverage against indirect prompt injection.",
    "risks": "Security claims need adversarial testing; zero-dependency does not imply robust.",
    "xKeywords": [
      "aigis agent firewall",
      "MCP rug-pull",
      "agent memory poisoning"
    ],
    "name": "aigis",
    "url": "https://github.com/killertcell428/aigis",
    "homepage": "https://pypi.org/project/pyaigis/",
    "description": "Deterministic, zero-dependency Python firewall for AI agents — MCP rug-pull, memory poisoning, indirect injection, exfil channels. 44 compliance templates (US/CN/JP/EU).",
    "language": "Python",
    "stars": 51,
    "forks": 6,
    "issues": 11,
    "license": "Apache-2.0",
    "pushedAt": "2026-07-01T12:55:08Z",
    "createdAt": "2026-04-11T02:56:13Z",
    "decision": "include"
  },
  {
    "id": "acodex",
    "repo": "maksimzayats/acodex",
    "categories": [
      "mcp",
      "devtools"
    ],
    "tags": [
      "Codex desktop",
      "automation bridge",
      "MCP"
    ],
    "collectReason": "收录。直接面向 Codex desktop 的本地 MCP automation bridge，贴近实际工作流集成。",
    "thesis": "Desktop coding agents will need local automation bridges before they become scriptable platforms.",
    "watchFor": "Tool coverage, permission boundaries, and stability across Codex app updates.",
    "risks": "Tight coupling to local app internals can break quickly.",
    "xKeywords": [
      "acodex",
      "Codex desktop MCP",
      "codex_app automation bridge"
    ],
    "name": "acodex",
    "url": "https://github.com/maksimzayats/acodex",
    "homepage": "http://docs.acodex.dev/",
    "description": "Local MCP automation bridge for the Codex desktop app, with CLI, HTTP server, and live codex_app.* tool access.",
    "language": "Python",
    "stars": 55,
    "forks": 1,
    "issues": 0,
    "license": "MIT",
    "pushedAt": "2026-07-01T12:38:06Z",
    "createdAt": "2026-02-14T14:26:20Z",
    "decision": "include"
  },
  {
    "id": "vibeproxy",
    "repo": "automazeio/vibeproxy",
    "categories": [
      "devtools",
      "gateways"
    ],
    "tags": [
      "macOS",
      "subscription bridge",
      "coding tools"
    ],
    "collectReason": "收录。用 macOS 菜单栏把 Claude Code/ChatGPT 订阅接到 coding tools，是“个人 agent 路由层”的现实需求。",
    "thesis": "Individual developers want local routing over subscriptions and API keys, not another SaaS console.",
    "watchFor": "Provider compatibility, local privacy model, and reliability under long coding sessions.",
    "risks": "Subscription bridging may be brittle or policy-sensitive depending on provider terms.",
    "xKeywords": [
      "vibeproxy",
      "Claude Code ChatGPT subscriptions coding tools",
      "macOS AI coding proxy"
    ],
    "name": "vibeproxy",
    "url": "https://github.com/automazeio/vibeproxy",
    "homepage": "",
    "description": "Native macOS menu bar app to use your Claude Code & ChatGPT subscriptions with AI coding tools - no API keys needed",
    "language": "Swift",
    "stars": 3074,
    "forks": 213,
    "issues": 21,
    "license": "MIT",
    "pushedAt": "2026-07-01T12:58:06Z",
    "createdAt": "2025-10-04T00:36:21Z",
    "decision": "include"
  },
  {
    "id": "omniroute",
    "repo": "diegosouzapw/OmniRoute",
    "categories": [
      "gateways",
      "devtools"
    ],
    "tags": [
      "AI gateway",
      "provider routing",
      "MCP"
    ],
    "collectReason": "收录。AI gateway + provider fallback + MCP/A2A，适合观察个人/团队如何绕开单一模型供应商绑定。",
    "thesis": "Routing, fallback, and compression are becoming a core layer between coding agents and model providers.",
    "watchFor": "Real provider support, failure semantics, and whether free-provider claims hold over time.",
    "risks": "Gateway projects can accumulate fragile provider integrations and unclear terms.",
    "xKeywords": [
      "OmniRoute AI gateway",
      "coding agent provider fallback",
      "MCP AI gateway"
    ],
    "name": "OmniRoute",
    "url": "https://github.com/diegosouzapw/OmniRoute",
    "homepage": "https://omniroute.online",
    "description": "Never stop coding. Free AI gateway: one endpoint, 231+ providers (50+ free), connect Claude Code, Codex, Cursor, Cline & Copilot to FREE Claude/GPT/Gemini. RTK+Caveman stacked compression saves 15-95% tokens, smart auto-fallback, MCP/A2A, multimodal APIs, Desktop/PWA.",
    "language": "TypeScript",
    "stars": 9126,
    "forks": 1432,
    "issues": 148,
    "license": "MIT",
    "pushedAt": "2026-07-01T13:01:53Z",
    "createdAt": "2026-02-13T12:38:31Z",
    "decision": "include"
  },
  {
    "id": "openviking",
    "repo": "volcengine/OpenViking",
    "categories": [
      "context",
      "memory"
    ],
    "tags": [
      "context database",
      "agent memory",
      "filesystem paradigm"
    ],
    "collectReason": "收录。上下文数据库方向值得看，尤其是把 memory/resources/skills 做成层级文件系统范式。",
    "thesis": "Agent memory may consolidate into context databases that manage resources and skills together.",
    "watchFor": "Interoperability with existing agents, local/hosted modes, and migration path from ad hoc memory files.",
    "risks": "Platform-backed projects can be heavy; verify whether the abstraction is useful outside its ecosystem.",
    "xKeywords": [
      "OpenViking",
      "agent context database",
      "AI agent memory resources skills"
    ],
    "name": "OpenViking",
    "url": "https://github.com/volcengine/OpenViking",
    "homepage": "https://openviking.ai",
    "description": "OpenViking is an open-source context database designed specifically for AI Agents(such as openclaw). OpenViking unifies the management of context (memory, resources, and skills) that Agents need through a file system paradigm, enabling hierarchical context delivery and self-evolving.",
    "language": "Python",
    "stars": 26216,
    "forks": 2036,
    "issues": 274,
    "license": "AGPL-3.0",
    "pushedAt": "2026-07-01T13:03:38Z",
    "createdAt": "2026-01-05T07:11:17Z",
    "decision": "include"
  },
  {
    "id": "agent-reach",
    "repo": "Panniantong/Agent-Reach",
    "categories": [
      "mcp",
      "research"
    ],
    "tags": [
      "social search",
      "web research",
      "no API"
    ],
    "collectReason": "收录。让 agent 读/搜 X、Reddit、YouTube、GitHub 等信息源，解决 agent research 的入口问题。",
    "thesis": "Research agents need practical source access layers before synthesis quality matters.",
    "watchFor": "Rate limits, source fidelity, and whether no-API scraping remains stable.",
    "risks": "Scraping-based access can break often and may carry compliance concerns.",
    "xKeywords": [
      "Agent-Reach",
      "AI agent internet search CLI",
      "agent read Twitter Reddit YouTube GitHub"
    ],
    "name": "Agent-Reach",
    "url": "https://github.com/Panniantong/Agent-Reach",
    "homepage": "",
    "description": "Give your AI agent eyes to see the entire internet. Read & search Twitter, Reddit, YouTube, GitHub, Bilibili, XiaoHongShu — one CLI, zero API fees.",
    "language": "Python",
    "stars": 47908,
    "forks": 3802,
    "issues": 113,
    "license": "MIT",
    "pushedAt": "2026-06-29T15:22:51Z",
    "createdAt": "2026-02-24T02:10:24Z",
    "decision": "include"
  }
]

export function xSearchUrl(keywords = []) {
  const query = [...keywords, 'GitHub', 'open source'].filter(Boolean).join(' OR ')
  return `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=top`
}
