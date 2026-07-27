export const OSS_RADAR_UPDATED_AT = "2026-07-27"

export const OSS_RADAR_SOURCE = {
  "initializedCount": 43,
  "githubSnapshotAt": "2026-07-27T07:56:08.593Z",
  "discoveryWindow": {
    "createdFrom": "2026-06-01",
    "createdTo": "2026-07-02",
    "status": "github-search-curated"
  },
  "xWindow": {
    "from": "",
    "to": "2026-07-27",
    "status": "not-fetched"
  },
  "curationMode": "recent-emerging-ai-devtools",
  "curationRules": [
    "Prefer repos created within the last month, especially agent, MCP, skills, context, security, sandbox, eval, and workflow tooling.",
    "Exclude famous baseline infrastructure and generic already-known projects unless the repo itself is new and agent-specific.",
    "Require a concrete workflow angle: what changes for builders, agents, reviewers, security, or deployment.",
    "Exclude obvious credential harvesters, exploit dumps, pure hype repos, and projects whose main value is only a PDF/tutorial.",
    "Every included repo needs collectReason, thesis, watchFor, and risks so it reads like a radar, not a star leaderboard."
  ],
  "note": "Expanded to recent GitHub discovery candidates from 2026-06-01 onward. Stars are used as a weak signal; curation favors novelty, workflow specificity, and agent/devtool relevance."
}

export const OSS_RADAR_REPOS = [
  {
    "id": "ponytail",
    "repo": "DietrichGebert/ponytail",
    "name": "ponytail",
    "url": "https://github.com/DietrichGebert/ponytail",
    "homepage": "https://ponytail.dev",
    "description": "Makes your AI agent think like the laziest senior dev in the room. The best code is the code you never wrote.",
    "language": "JavaScript",
    "stars": 90017,
    "forks": 4951,
    "issues": 105,
    "license": "MIT",
    "pushedAt": "2026-07-15T21:32:15Z",
    "createdAt": "2026-06-12T00:52:37Z",
    "categories": [
      "ai-agents"
    ],
    "tags": [
      "agent-behavior",
      "ai-agents"
    ],
    "decision": "include",
    "collectReason": "让 agent 少写没必要的代码，切的是“判断力/懒惰高级工程师”这个很具体的行为层。",
    "thesis": "Behavior constraints may beat bigger prompts in everyday coding.",
    "watchFor": "Look for smaller diffs, fewer files changed, and less overengineering beyond jokes.",
    "risks": "Could be mostly prompt packaging if it lacks repeatable evals.",
    "xKeywords": [
      "ponytail",
      "DietrichGebert/ponytail",
      "agent-behavior"
    ]
  },
  {
    "id": "mimo-code",
    "repo": "XiaomiMiMo/MiMo-Code",
    "name": "MiMo-Code",
    "url": "https://github.com/XiaomiMiMo/MiMo-Code",
    "homepage": "https://mimo.xiaomi.com/mimocode",
    "description": "MiMo Code: Where Models and Agents Co-Evolve",
    "language": "TypeScript",
    "stars": 12479,
    "forks": 1271,
    "issues": 824,
    "license": "MIT",
    "pushedAt": "2026-07-27T07:55:05Z",
    "createdAt": "2026-06-10T11:52:41Z",
    "categories": [
      "ai-agents"
    ],
    "tags": [
      "model-agent co-evolution",
      "ai-agents"
    ],
    "decision": "include",
    "collectReason": "模型和 agent 协同进化，来自小米 MiMo 生态，适合观察模型厂开始做自家 agent harness。",
    "thesis": "Model labs may ship agent runtimes tuned to their own model behavior.",
    "watchFor": "Look for open evals, tool-loop details, and whether it works outside MiMo models.",
    "risks": "Vendor-native harnesses can become closed ecosystem demos.",
    "xKeywords": [
      "MiMo-Code",
      "XiaomiMiMo/MiMo-Code",
      "model-agent co-evolution"
    ]
  },
  {
    "id": "omnigent",
    "repo": "omnigent-ai/omnigent",
    "name": "omnigent",
    "url": "https://github.com/omnigent-ai/omnigent",
    "homepage": "https://omnigent.ai",
    "description": "Omnigent is an open-source AI agent framework and meta-harness: orchestrate Claude Code, Codex, Cursor, Pi, and custom agents — swap harnesses without rewriting, enforce policies and sandboxing, and collaborate in real time from any device.",
    "language": "Python",
    "stars": 7790,
    "forks": 1134,
    "issues": 722,
    "license": "Apache-2.0",
    "pushedAt": "2026-07-27T07:43:33Z",
    "createdAt": "2026-06-11T12:18:13Z",
    "categories": [
      "ai-agents"
    ],
    "tags": [
      "meta-harness",
      "ai-agents"
    ],
    "decision": "include",
    "collectReason": "把 Claude Code、Codex、Cursor 等不同 harness 抽象成可切换 meta-harness，命中多 agent 工具碎片化问题。",
    "thesis": "Agent work may need orchestration above individual coding CLIs.",
    "watchFor": "Policy, sandboxing, real-time collaboration, and adapter quality across tools.",
    "risks": "Abstraction layers often leak when underlying CLIs change.",
    "xKeywords": [
      "omnigent",
      "omnigent-ai/omnigent",
      "meta-harness"
    ]
  },
  {
    "id": "loop-engineering",
    "repo": "cobusgreyling/loop-engineering",
    "name": "loop-engineering",
    "url": "https://github.com/cobusgreyling/loop-engineering",
    "homepage": "https://cobusgreyling.github.io/loop-engineering/",
    "description": "Practical patterns, starters & CLI tools for loop engineering with AI coding agents. Design systems that prompt and orchestrate agents (inspired by Addy Osmani and Boris Cherny). Includes loop-audit, loop-init, loop-cost.",
    "language": "JavaScript",
    "stars": 9463,
    "forks": 1297,
    "issues": 23,
    "license": "MIT",
    "pushedAt": "2026-07-27T03:25:55Z",
    "createdAt": "2026-06-09T06:28:20Z",
    "categories": [
      "workflow"
    ],
    "tags": [
      "loop engineering",
      "workflow"
    ],
    "decision": "include",
    "collectReason": "专门讲/做 agent loop 的 starter 和 CLI，不是单次 prompt，而是重复执行系统。",
    "thesis": "Loop design is becoming a practical engineering discipline for coding agents.",
    "watchFor": "Whether loop-audit/loop-cost produce measurable savings or fewer runaway sessions.",
    "risks": "Could drift into content/guide repo rather than executable tooling.",
    "xKeywords": [
      "loop-engineering",
      "cobusgreyling/loop-engineering",
      "loop engineering"
    ]
  },
  {
    "id": "lottie",
    "repo": "diffusionstudio/lottie",
    "name": "lottie",
    "url": "https://github.com/diffusionstudio/lottie",
    "homepage": "https://diffusion.studio",
    "description": "Generate production-ready Lottie animations with Claude Code or Codex",
    "language": "TypeScript",
    "stars": 4969,
    "forks": 271,
    "issues": 0,
    "license": "MIT",
    "pushedAt": "2026-07-25T07:22:58Z",
    "createdAt": "2026-06-04T13:39:32Z",
    "categories": [
      "media-tools"
    ],
    "tags": [
      "agent-generated animation",
      "media-tools"
    ],
    "decision": "include",
    "collectReason": "让 Claude Code/Codex 生成 production-ready Lottie，属于 agent 进入专业设计交付的窄场景。",
    "thesis": "Agents will specialize into asset pipelines, not just app scaffolding.",
    "watchFor": "Quality of generated animations and whether designers can edit the output cleanly.",
    "risks": "May be impressive demos but weak production control.",
    "xKeywords": [
      "lottie",
      "diffusionstudio/lottie",
      "agent-generated animation"
    ]
  },
  {
    "id": "eve",
    "repo": "vercel/eve",
    "name": "eve",
    "url": "https://github.com/vercel/eve",
    "homepage": "https://eve.dev",
    "description": "The Framework for Building Agents",
    "language": "TypeScript",
    "stars": 4096,
    "forks": 393,
    "issues": 392,
    "license": "Apache-2.0",
    "pushedAt": "2026-07-27T07:53:15Z",
    "createdAt": "2026-06-16T10:51:20Z",
    "categories": [
      "ai-agents"
    ],
    "tags": [
      "agent framework",
      "ai-agents"
    ],
    "decision": "include",
    "collectReason": "Vercel 新 agent framework，虽然背后是大厂，但项目新且方向直接影响 Web agent 开发栈。",
    "thesis": "Agent frameworks are moving into mainstream app frameworks.",
    "watchFor": "Runtime model, deployment path, and whether it avoids being another abstraction wrapper.",
    "risks": "Vercel projects can become platform-coupled quickly.",
    "xKeywords": [
      "eve",
      "vercel/eve",
      "agent framework"
    ]
  },
  {
    "id": "skills",
    "repo": "BuilderIO/skills",
    "name": "skills",
    "url": "https://github.com/BuilderIO/skills",
    "homepage": "https://www.agent-native.com/",
    "description": "Skills for coding agents",
    "language": "JavaScript",
    "stars": 3802,
    "forks": 190,
    "issues": 4,
    "license": "MIT",
    "pushedAt": "2026-07-26T19:14:24Z",
    "createdAt": "2026-06-10T16:04:20Z",
    "categories": [
      "skills"
    ],
    "tags": [
      "coding-agent skills",
      "skills"
    ],
    "decision": "include",
    "collectReason": "Builder.io 做 coding-agent skills，说明技能分发正在从个人 prompt 变成产品化资产。",
    "thesis": "Skills may become the npm layer for agent behavior.",
    "watchFor": "Versioning, install UX, and whether skills survive across Claude/Codex/Cursor.",
    "risks": "Skill repos can become prompt dumps without quality control.",
    "xKeywords": [
      "skills",
      "BuilderIO/skills",
      "coding-agent skills"
    ]
  },
  {
    "id": "devspace",
    "repo": "Waishnav/devspace",
    "name": "devspace",
    "url": "https://github.com/Waishnav/devspace",
    "homepage": "",
    "description": "Turn ChatGPT into Codex! OR Turn Claude Web into Claude Code!",
    "language": "TypeScript",
    "stars": 3384,
    "forks": 360,
    "issues": 48,
    "license": "MIT",
    "pushedAt": "2026-07-26T20:58:59Z",
    "createdAt": "2026-06-14T16:57:27Z",
    "categories": [
      "devtools"
    ],
    "tags": [
      "ChatGPT-to-Codex bridge",
      "devtools"
    ],
    "decision": "include",
    "collectReason": "把 ChatGPT 变成 Codex 式本地 coding flow，切的是用户已有订阅和本地 repo 工作流之间的缝。",
    "thesis": "Developers want bridges from chat subscriptions into coding agents.",
    "watchFor": "Auth model, local privacy, and whether edits are reviewable.",
    "risks": "Subscription bridging is brittle and may be policy-sensitive.",
    "xKeywords": [
      "devspace",
      "Waishnav/devspace",
      "ChatGPT-to-Codex bridge"
    ]
  },
  {
    "id": "loopy",
    "repo": "Forward-Future/loopy",
    "name": "loopy",
    "url": "https://github.com/Forward-Future/loopy",
    "homepage": "https://signals.forwardfuture.ai/loop-library/",
    "description": "A library of practical AI-agent loops and an installable skill for finding, adapting, and designing repeatable agent workflows.",
    "language": "JavaScript",
    "stars": 2880,
    "forks": 261,
    "issues": 4,
    "license": "MIT",
    "pushedAt": "2026-07-26T11:04:33Z",
    "createdAt": "2026-06-12T14:44:22Z",
    "categories": [
      "workflow"
    ],
    "tags": [
      "agent loops library",
      "workflow"
    ],
    "decision": "include",
    "collectReason": "可安装 skill + agent loop pattern 库，适合观察 loop 模式能否复用。",
    "thesis": "Reusable loops may become a higher-level primitive than reusable prompts.",
    "watchFor": "Whether loops include stop conditions, verification, and cost controls.",
    "risks": "Loop libraries can encourage automation without enough guardrails.",
    "xKeywords": [
      "loopy",
      "Forward-Future/loopy",
      "agent loops library"
    ]
  },
  {
    "id": "baoyu-design",
    "repo": "JimLiu/baoyu-design",
    "name": "baoyu-design",
    "url": "https://github.com/JimLiu/baoyu-design",
    "homepage": "",
    "description": "Run Claude Design locally as an Agent Skill — Cursor, Claude Code & more. Produce polished UI mockups, prototypes, decks & wireframes as self-contained HTML, without claude.ai/design. Best with Opus 4.8.",
    "language": "JavaScript",
    "stars": 2851,
    "forks": 211,
    "issues": 1,
    "license": "MIT",
    "pushedAt": "2026-07-26T03:01:59Z",
    "createdAt": "2026-06-07T01:16:18Z",
    "categories": [
      "skills"
    ],
    "tags": [
      "local Claude Design skill",
      "skills"
    ],
    "decision": "include",
    "collectReason": "把 Claude Design 风格本地化成 agent skill，用 HTML 交付 UI mock/prototype/deck，设计工作流价值明确。",
    "thesis": "Design generation may move into local skills around coding agents.",
    "watchFor": "Output polish, editability, and compatibility with real product design constraints.",
    "risks": "Could overfit to one aesthetic or model behavior.",
    "xKeywords": [
      "baoyu-design",
      "JimLiu/baoyu-design",
      "local Claude Design skill"
    ]
  },
  {
    "id": "security-audit-skill",
    "repo": "cloudflare/security-audit-skill",
    "name": "security-audit-skill",
    "url": "https://github.com/cloudflare/security-audit-skill",
    "homepage": "",
    "description": "A coding-agent skill for multi-phase security audits with independently verified, machine-readable findings",
    "language": "JavaScript",
    "stars": 2665,
    "forks": 194,
    "issues": 3,
    "license": "MIT",
    "pushedAt": "2026-07-06T13:36:03Z",
    "createdAt": "2026-06-18T14:08:44Z",
    "categories": [
      "security"
    ],
    "tags": [
      "machine-readable audit skill",
      "security"
    ],
    "decision": "include",
    "collectReason": "多阶段安全审计 skill，要求独立验证和机器可读 findings，比普通“让 AI 审代码”更靠谱。",
    "thesis": "Security review agents need structured evidence, not prose confidence.",
    "watchFor": "Finding schema, verification steps, and false-positive rate.",
    "risks": "Even audited skills need human review for security-critical changes.",
    "xKeywords": [
      "security-audit-skill",
      "cloudflare/security-audit-skill",
      "machine-readable audit skill"
    ]
  },
  {
    "id": "open-knowledge",
    "repo": "inkeep/open-knowledge",
    "name": "open-knowledge",
    "url": "https://github.com/inkeep/open-knowledge",
    "homepage": "https://openknowledge.ai",
    "description": "Beautiful, AI-native markdown IDE and LLM wiki",
    "language": "TypeScript",
    "stars": 3135,
    "forks": 198,
    "issues": 35,
    "license": "GPL-3.0",
    "pushedAt": "2026-07-27T06:30:49Z",
    "createdAt": "2026-06-03T11:12:40Z",
    "categories": [
      "knowledge"
    ],
    "tags": [
      "AI-native wiki/editor",
      "knowledge"
    ],
    "decision": "include",
    "collectReason": "AI-native markdown editor和 LLM wiki，偏知识库但对 agent knowledge workflow 有意义。",
    "thesis": "Agent work needs editable knowledge surfaces, not only chat history.",
    "watchFor": "Import/export, source fidelity, and whether agents can update docs safely.",
    "risks": "May be more editor product than agent infrastructure.",
    "xKeywords": [
      "open-knowledge",
      "inkeep/open-knowledge",
      "AI-native wiki/editor"
    ]
  },
  {
    "id": "org2",
    "repo": "org2AI/ORG2",
    "name": "ORG2",
    "url": "https://github.com/org2AI/ORG2",
    "homepage": "",
    "description": "Coding agent orgs: built for reviewability and team collaboration. Built-in rust harness & 20+ CLIs.",
    "language": "TypeScript",
    "stars": 2168,
    "forks": 118,
    "issues": 60,
    "license": "AGPL-3.0",
    "pushedAt": "2026-07-27T05:59:45Z",
    "createdAt": "2026-06-01T12:52:57Z",
    "categories": [
      "ide"
    ],
    "tags": [
      "reviewable agent IDE",
      "ide"
    ],
    "decision": "include",
    "collectReason": "Cursor-style agent IDE，但强调 reviewability/control 和 Rust harness，切中 agent IDE 可控性问题。",
    "thesis": "The agent IDE race may split around control and review, not just autocomplete.",
    "watchFor": "Diff review, permissioning, CLI support, and harness transparency.",
    "risks": "New IDEs are hard to sustain against incumbents.",
    "xKeywords": [
      "ORG2",
      "yorgai/ORG2",
      "reviewable agent IDE"
    ]
  },
  {
    "id": "effective-html",
    "repo": "plannotator/effective-html",
    "name": "effective-html",
    "url": "https://github.com/plannotator/effective-html",
    "homepage": "https://plannotator.ai",
    "description": "Agent skill for elegant and simple html plans, architecture diagrams, or whatever else you can think of.",
    "language": "HTML",
    "stars": 1416,
    "forks": 109,
    "issues": 2,
    "license": "MIT",
    "pushedAt": "2026-07-08T04:22:30Z",
    "createdAt": "2026-06-09T23:24:51Z",
    "categories": [
      "skills"
    ],
    "tags": [
      "HTML planning skill",
      "skills"
    ],
    "decision": "include",
    "collectReason": "用 agent skill 生成优雅 HTML plan/diagram，把规划从 markdown 拉到可视化交付。",
    "thesis": "Agent planning artifacts can become visual, inspectable files.",
    "watchFor": "Whether outputs stay simple and useful under real architecture planning.",
    "risks": "Could become decorative if not tied to execution and review.",
    "xKeywords": [
      "effective-html",
      "plannotator/effective-html",
      "HTML planning skill"
    ]
  },
  {
    "id": "agent-apprenticeship",
    "repo": "ray-r-ren/agent-apprenticeship",
    "name": "agent-apprenticeship",
    "url": "https://github.com/ray-r-ren/agent-apprenticeship",
    "homepage": "https://forsy.ai",
    "description": "The living ecosystem where AI agents complete tasks through workflow loops, improve through iterative execution, are evaluated by mentor agents or humans in the loop, and turn completed work into reusable work experience and data to improve future agents.",
    "language": "Python",
    "stars": 1340,
    "forks": 58,
    "issues": 0,
    "license": "MIT",
    "pushedAt": "2026-07-06T15:17:36Z",
    "createdAt": "2026-06-19T16:19:37Z",
    "categories": [
      "workflow"
    ],
    "tags": [
      "self-improving workflow loops",
      "workflow"
    ],
    "decision": "include",
    "collectReason": "把每次 agent run 变成可复用经验/数据，直接命中 agent 学习闭环。",
    "thesis": "Future agents may improve through accumulated run experience rather than static prompts.",
    "watchFor": "Data format, replayability, and whether improvement is measurable.",
    "risks": "Self-improvement claims are easy to overstate without evals.",
    "xKeywords": [
      "agent-apprenticeship",
      "Forsy-AI/agent-apprenticeship",
      "self-improving workflow loops"
    ]
  },
  {
    "id": "anima",
    "repo": "Fullive-AI/Anima",
    "name": "Anima",
    "url": "https://github.com/Fullive-AI/Anima",
    "homepage": "",
    "description": "Make Every Hardware Intelligent — an open-source Agent OS for hardware intelligence",
    "language": "Python",
    "stars": 770,
    "forks": 29,
    "issues": 9,
    "license": "Apache-2.0",
    "pushedAt": "2026-07-01T23:16:47Z",
    "createdAt": "2026-06-01T10:06:21Z",
    "categories": [
      "hardware"
    ],
    "tags": [
      "agent OS for hardware",
      "hardware"
    ],
    "decision": "include",
    "collectReason": "面向硬件智能的 open-source Agent OS，和纯软件 coding agent 不同，有跨设备想象空间。",
    "thesis": "Agent operating systems may extend into hardware orchestration.",
    "watchFor": "Device abstraction, safety boundaries, and real hardware demos.",
    "risks": "Hardware-agent claims need strict safety and reproducibility.",
    "xKeywords": [
      "Anima",
      "Fullive-AI/Anima",
      "agent OS for hardware"
    ]
  },
  {
    "id": "codexpro",
    "repo": "rebel0789/codexpro",
    "name": "codexpro",
    "url": "https://github.com/rebel0789/codexpro",
    "homepage": "https://rebel0789.github.io/codexpro/",
    "description": "Use ChatGPT Developer Mode as a local coding agent for your repo through MCP.",
    "language": "JavaScript",
    "stars": 1422,
    "forks": 130,
    "issues": 9,
    "license": "MIT",
    "pushedAt": "2026-07-24T20:10:49Z",
    "createdAt": "2026-06-16T21:22:43Z",
    "categories": [
      "mcp"
    ],
    "tags": [
      "ChatGPT developer mode coding agent",
      "mcp"
    ],
    "decision": "include",
    "collectReason": "通过 MCP 把 ChatGPT Developer Mode 接成本地 repo coding agent，方向有争议但需求真实。",
    "thesis": "MCP is enabling unofficial bridges between chat products and local coding workflows.",
    "watchFor": "Local file permissions, auth handling, and reviewable edits.",
    "risks": "Can break quickly if upstream UI/API changes.",
    "xKeywords": [
      "codexpro",
      "rebel0789/codexpro",
      "ChatGPT developer mode coding agent"
    ]
  },
  {
    "id": "dao-code",
    "repo": "tigicion/dao-code",
    "name": "dao-code",
    "url": "https://github.com/tigicion/dao-code",
    "homepage": "https://www.npmjs.com/package/dao-code",
    "description": "Open-source TypeScript terminal coding agent for DeepSeek-V4 — builds on DeepSeek's strong price-performance and ultra-cheap cache pricing, engineering byte-stable prefixes and cache-reusing forks so cross-session memory and a continuous self-correction layer add almost no token cost; 1M context, Skills/MCP/Hooks, Claude Code config compatible.",
    "language": "TypeScript",
    "stars": 1378,
    "forks": 51,
    "issues": 6,
    "license": "MIT",
    "pushedAt": "2026-07-26T17:43:56Z",
    "createdAt": "2026-06-08T08:10:42Z",
    "categories": [
      "ai-agents"
    ],
    "tags": [
      "DeepSeek-native terminal agent",
      "ai-agents"
    ],
    "decision": "include",
    "collectReason": "DeepSeek V4 原生终端 coding agent，利用低价/cache 经济性，适合观察模型原生 agent 分叉。",
    "thesis": "Cheap model economics may create separate coding-agent stacks.",
    "watchFor": "Cache reuse, edit reliability, and Claude Code compatibility.",
    "risks": "Young project and DeepSeek-specific assumptions may age quickly.",
    "xKeywords": [
      "dao-code",
      "tigicion/dao-code",
      "DeepSeek-native terminal agent"
    ]
  },
  {
    "id": "superlog",
    "repo": "superloglabs/superlog",
    "name": "superlog",
    "url": "https://github.com/superloglabs/superlog",
    "homepage": "https://superlog.sh",
    "description": "Open-source observability tool that uses AI agents to self-heal your software",
    "language": "TypeScript",
    "stars": 1060,
    "forks": 79,
    "issues": 61,
    "license": "Apache-2.0",
    "pushedAt": "2026-07-26T06:51:59Z",
    "createdAt": "2026-06-02T19:13:48Z",
    "categories": [
      "observability"
    ],
    "tags": [
      "self-healing observability",
      "observability"
    ],
    "decision": "include",
    "collectReason": "AI agents 做软件自愈 observability，属于 agent 进入 production ops 的有趣方向。",
    "thesis": "Observability tools may evolve from alerting to agentic repair loops.",
    "watchFor": "Rollback safety, audit trails, and boundaries between suggestion and action.",
    "risks": "Self-healing can create production risk if actions are too autonomous.",
    "xKeywords": [
      "superlog",
      "superloglabs/superlog",
      "self-healing observability"
    ]
  },
  {
    "id": "guard-skills",
    "repo": "amElnagdy/guard-skills",
    "name": "guard-skills",
    "url": "https://github.com/amElnagdy/guard-skills",
    "homepage": "https://skills.sh/amElnagdy/guard-skills",
    "description": "Guard skills for coding agents, quality gates that catch AI-generated failure modes in code, tests, and docs",
    "language": "",
    "stars": 1109,
    "forks": 130,
    "issues": 4,
    "license": "MIT",
    "pushedAt": "2026-07-04T15:26:29Z",
    "createdAt": "2026-06-06T16:59:27Z",
    "categories": [
      "security"
    ],
    "tags": [
      "AI failure guard skills",
      "security"
    ],
    "decision": "include",
    "collectReason": "专门抓 AI 生成代码/测试/文档常见失败模式，是 agent 质量门方向。",
    "thesis": "Guard skills could become standard CI gates for agent-generated work.",
    "watchFor": "Coverage of real failure modes and integration into PR/CI workflows.",
    "risks": "Quality gates can become noisy if too generic.",
    "xKeywords": [
      "guard-skills",
      "amElnagdy/guard-skills",
      "AI failure guard skills"
    ]
  },
  {
    "id": "autocve",
    "repo": "larlarua/AutoCVE",
    "name": "AutoCVE",
    "url": "https://github.com/larlarua/AutoCVE",
    "homepage": "",
    "description": "Agent-driven automated CVE discovery platform for source code auditing, vulnerability verification, and report generation.",
    "language": "Python",
    "stars": 1262,
    "forks": 89,
    "issues": 11,
    "license": "AGPL-3.0",
    "pushedAt": "2026-07-27T07:15:12Z",
    "createdAt": "2026-06-15T14:50:47Z",
    "categories": [
      "security"
    ],
    "tags": [
      "agent-driven CVE discovery",
      "security"
    ],
    "decision": "include",
    "collectReason": "自动化 CVE 发现/验证/报告，安全方向很强也有风险，适合谨慎观察。",
    "thesis": "Security agents are moving from review assistant to vulnerability discovery pipeline.",
    "watchFor": "Verification rigor, scope limits, and responsible disclosure support.",
    "risks": "Dual-use risk is high; should not be promoted as casual automation.",
    "xKeywords": [
      "AutoCVE",
      "larlarua/AutoCVE",
      "agent-driven CVE discovery"
    ]
  },
  {
    "id": "fanbox",
    "repo": "alchaincyf/fanbox",
    "name": "fanbox",
    "url": "https://github.com/alchaincyf/fanbox",
    "homepage": "https://github.com/alchaincyf/fanbox/releases/latest",
    "description": "vibe coding 的驾驶舱：左边文件，右边/下边终端，中间看清每一次改动。 / The cockpit for vibe coding: browse files on the left, command agents on the right, watch every change in between.",
    "language": "JavaScript",
    "stars": 952,
    "forks": 137,
    "issues": 18,
    "license": "MIT",
    "pushedAt": "2026-07-27T03:21:53Z",
    "createdAt": "2026-06-10T01:01:42Z",
    "categories": [
      "devtools"
    ],
    "tags": [
      "vibe coding cockpit",
      "devtools"
    ],
    "decision": "include",
    "collectReason": "文件、终端、diff 可视化 cockpit，解决 vibe coding 看不清 agent 每一步的问题。",
    "thesis": "Agent UIs need cockpit views for review, not only chat panes.",
    "watchFor": "Change visualization, terminal control, and multi-agent ergonomics.",
    "risks": "Can become another IDE wrapper if workflow is shallow.",
    "xKeywords": [
      "fanbox",
      "alchaincyf/fanbox",
      "vibe coding cockpit"
    ]
  },
  {
    "id": "qiaomu-goal-meta-skill",
    "repo": "joeseesun/qiaomu-goal-meta-skill",
    "name": "qiaomu-goal-meta-skill",
    "url": "https://github.com/joeseesun/qiaomu-goal-meta-skill",
    "homepage": "",
    "description": "Turn vague or complex Codex tasks into strong `/goal` commands with outcome, verification, constraints, boundaries, iteration policy, completion evide",
    "language": "Python",
    "stars": 800,
    "forks": 60,
    "issues": 4,
    "license": "MIT",
    "pushedAt": "2026-06-11T15:10:56Z",
    "createdAt": "2026-06-11T15:10:51Z",
    "categories": [
      "skills"
    ],
    "tags": [
      "goal shaping skill",
      "skills"
    ],
    "decision": "include",
    "collectReason": "把模糊 Codex 任务转成强 `/goal` 命令，解决 agent 任务定义质量问题。",
    "thesis": "Task framing may be as important as model capability for long-running agents.",
    "watchFor": "Whether generated goals improve completion rate and verification quality.",
    "risks": "Meta-skills can become verbose boilerplate if not measured.",
    "xKeywords": [
      "qiaomu-goal-meta-skill",
      "joeseesun/qiaomu-goal-meta-skill",
      "goal shaping skill"
    ]
  },
  {
    "id": "oh-my-taiyiforge",
    "repo": "Dong90/oh-my-taiyiforge",
    "name": "oh-my-taiyiforge",
    "url": "https://github.com/Dong90/oh-my-taiyiforge",
    "homepage": "",
    "description": "AI workflow automation plugin for intelligent code generation with Claude/Codex",
    "language": "TypeScript",
    "stars": 1019,
    "forks": 25,
    "issues": 3,
    "license": "MIT",
    "pushedAt": "2026-07-27T01:08:47Z",
    "createdAt": "2026-06-05T02:25:33Z",
    "categories": [
      "workflow"
    ],
    "tags": [
      "Claude/Codex workflow plugin",
      "workflow"
    ],
    "decision": "include",
    "collectReason": "AI workflow automation plugin，面向 Claude/Codex 的智能代码生成流程。",
    "thesis": "Agent workflow plugins may become user-level automation layers.",
    "watchFor": "Plugin hooks, repeatability, and compatibility with common coding CLIs.",
    "risks": "Potential overlap with existing skill/plugin managers.",
    "xKeywords": [
      "oh-my-taiyiforge",
      "Dong90/oh-my-taiyiforge",
      "Claude/Codex workflow plugin"
    ]
  },
  {
    "id": "sandboxd",
    "repo": "tastyeffectco/sandboxd",
    "name": "sandboxd",
    "url": "https://github.com/tastyeffectco/sandboxd",
    "homepage": "https://sandboxd.io/",
    "description": "Open-source, self-hosted AI app builder — an agent builds real apps in isolated sandboxes on your own server, each live at a preview URL. Self-host in one command. MIT.",
    "language": "Go",
    "stars": 866,
    "forks": 49,
    "issues": 13,
    "license": "MIT",
    "pushedAt": "2026-07-22T03:36:02Z",
    "createdAt": "2026-06-03T18:55:02Z",
    "categories": [
      "sandboxes"
    ],
    "tags": [
      "self-hosted dev sandboxes",
      "sandboxes"
    ],
    "decision": "include",
    "collectReason": "一条命令起 self-hosted dev sandbox + preview URL，正好服务 coding agents 和 SaaS factory。",
    "thesis": "Agent coding needs cheap, isolated, previewable sandboxes.",
    "watchFor": "Startup speed, isolation model, preview routing, and cleanup behavior.",
    "risks": "Sandbox security is easy to get subtly wrong.",
    "xKeywords": [
      "sandboxd",
      "tastyeffectco/sandboxd",
      "self-hosted dev sandboxes"
    ]
  },
  {
    "id": "qwen-agentworld",
    "repo": "QwenLM/Qwen-AgentWorld",
    "name": "Qwen-AgentWorld",
    "url": "https://github.com/QwenLM/Qwen-AgentWorld",
    "homepage": "https://arxiv.org/abs/2606.24597",
    "description": "Qwen-AgentWorld: Language World Models for General Agents",
    "language": "Python",
    "stars": 893,
    "forks": 89,
    "issues": 6,
    "license": "Apache-2.0",
    "pushedAt": "2026-07-20T11:52:07Z",
    "createdAt": "2026-06-22T13:48:37Z",
    "categories": [
      "evals"
    ],
    "tags": [
      "language world models",
      "evals"
    ],
    "decision": "include",
    "collectReason": "Qwen-AgentWorld 偏通用 agent world/eval，能观察模型厂如何定义 general agents。",
    "thesis": "Agent evaluation may shift toward simulated worlds and long-horizon tasks.",
    "watchFor": "Benchmark design, task diversity, and reproducibility.",
    "risks": "Model-lab benchmarks can be hard to compare independently.",
    "xKeywords": [
      "Qwen-AgentWorld",
      "QwenLM/Qwen-AgentWorld",
      "language world models"
    ]
  },
  {
    "id": "flock",
    "repo": "duckbugio/flock",
    "name": "flock",
    "url": "https://github.com/duckbugio/flock",
    "homepage": "https://roost.duckbug.io",
    "description": "Autonomous AI dev-team bot",
    "language": "Go",
    "stars": 533,
    "forks": 5,
    "issues": 0,
    "license": "MIT",
    "pushedAt": "2026-07-24T11:40:38Z",
    "createdAt": "2026-06-08T15:48:15Z",
    "categories": [
      "workflow"
    ],
    "tags": [
      "autonomous dev-team bot",
      "workflow"
    ],
    "decision": "include",
    "collectReason": "Autonomous AI dev-team bot，直接挑战“agent team”协作场景。",
    "thesis": "Multi-agent dev teams need coordination and review mechanics more than more agents.",
    "watchFor": "Task decomposition, PR quality, and human approval flow.",
    "risks": "Autonomous teams can generate low-quality volume fast.",
    "xKeywords": [
      "flock",
      "duckbugio/flock",
      "autonomous dev-team bot"
    ]
  },
  {
    "id": "fablize",
    "repo": "fivetaku/fablize",
    "name": "fablize",
    "url": "https://github.com/fivetaku/fablize",
    "homepage": "",
    "description": "A Claude Code plugin that makes Opus behave like Fable — completion, evidence, and verification enforced as procedure. Ships only what a Fable-vs-Opus comparison proved transferable.",
    "language": "Python",
    "stars": 884,
    "forks": 117,
    "issues": 6,
    "license": "MIT",
    "pushedAt": "2026-07-06T00:42:27Z",
    "createdAt": "2026-06-14T05:49:06Z",
    "categories": [
      "skills"
    ],
    "tags": [
      "Fable-like verification skill",
      "skills"
    ],
    "decision": "include",
    "collectReason": "把 Fable 风格的 completion/evidence/verification 迁移为 Claude Code plugin，切 verification 这个关键点。",
    "thesis": "Agent behavior can be ported as procedural skills across models.",
    "watchFor": "Whether verification reduces bad completions on non-demo tasks.",
    "risks": "May overfit to Fable-vs-Opus comparison anecdotes.",
    "xKeywords": [
      "fablize",
      "fivetaku/fablize",
      "Fable-like verification skill"
    ]
  },
  {
    "id": "luban-skill",
    "repo": "LearnPrompt/luban-skill",
    "name": "luban-skill",
    "url": "https://github.com/LearnPrompt/luban-skill",
    "homepage": "",
    "description": "鲁班 | Luban — 把'能用的Skill'打磨成'能被装、能传播、能验证、能进化'的公共资产。Agent skill-polishing workshop: 验料·访行·过尺·慢刨·回炉",
    "language": "Shell",
    "stars": 901,
    "forks": 152,
    "issues": 0,
    "license": "MIT",
    "pushedAt": "2026-07-10T16:39:25Z",
    "createdAt": "2026-06-11T08:49:42Z",
    "categories": [
      "skills"
    ],
    "tags": [
      "skill polishing workshop",
      "skills"
    ],
    "decision": "include",
    "collectReason": "把 skill 打磨成可安装、可传播、可验证资产，关注 skill 质量而不是数量。",
    "thesis": "Skill ecosystems need packaging and QA norms.",
    "watchFor": "Validation workflow, distribution format, and community quality bar.",
    "risks": "May be more methodology than tooling.",
    "xKeywords": [
      "luban-skill",
      "LearnPrompt/luban-skill",
      "skill polishing workshop"
    ]
  },
  {
    "id": "junction",
    "repo": "Plaer1/junction",
    "name": "junction",
    "url": "https://github.com/Plaer1/junction",
    "homepage": "",
    "description": "VS Code chat sidebar for local AI coding agents",
    "language": "TypeScript",
    "stars": 640,
    "forks": 10,
    "issues": 0,
    "license": "MIT",
    "pushedAt": "2026-06-29T03:47:59Z",
    "createdAt": "2026-06-17T05:27:09Z",
    "categories": [
      "ide"
    ],
    "tags": [
      "VS Code sidebar for local agents",
      "ide"
    ],
    "decision": "include",
    "collectReason": "VS Code chat sidebar for local AI coding agents，轻量但命中本地 agent UI。",
    "thesis": "Local agents need native editor surfaces that expose state and edits.",
    "watchFor": "Supported agents, review UX, and how it handles long tasks.",
    "risks": "Could be thin UI over existing CLIs.",
    "xKeywords": [
      "junction",
      "Plaer1/junction",
      "VS Code sidebar for local agents"
    ]
  },
  {
    "id": "recall",
    "repo": "raiyanyahya/recall",
    "name": "recall",
    "url": "https://github.com/raiyanyahya/recall",
    "homepage": "https://recallplugin.dev",
    "description": "Stop wasting tokens and re-explaining your project every session. Recall gives Claude Code durable memory — entirely offline.",
    "language": "Python",
    "stars": 728,
    "forks": 44,
    "issues": 1,
    "license": "MIT",
    "pushedAt": "2026-07-25T16:39:44Z",
    "createdAt": "2026-06-19T20:36:41Z",
    "categories": [
      "memory"
    ],
    "tags": [
      "offline Claude Code memory",
      "memory"
    ],
    "decision": "include",
    "collectReason": "给 Claude Code 提供离线 durable memory，解决每次重讲项目的问题。",
    "thesis": "Local memory may become standard for serious coding-agent sessions.",
    "watchFor": "Privacy model, retrieval quality, and stale memory handling.",
    "risks": "Memory can mislead agents if not scoped/versioned.",
    "xKeywords": [
      "recall",
      "raiyanyahya/recall",
      "offline Claude Code memory"
    ]
  },
  {
    "id": "threejs-game-skills",
    "repo": "majidmanzarpour/threejs-game-skills",
    "name": "threejs-game-skills",
    "url": "https://github.com/majidmanzarpour/threejs-game-skills",
    "homepage": "",
    "description": "Agent skills for building playable, polished Three.js browser games with gameplay, AAA-style graphics, UI, QA, and optional AI-generated 3D, image, and audio assets.",
    "language": "Python",
    "stars": 1133,
    "forks": 115,
    "issues": 3,
    "license": "MIT",
    "pushedAt": "2026-07-16T19:55:17Z",
    "createdAt": "2026-06-14T04:06:26Z",
    "categories": [
      "skills"
    ],
    "tags": [
      "game-building agent skills",
      "skills"
    ],
    "decision": "include",
    "collectReason": "面向 Three.js 游戏的 agent skills，垂直技能包比泛 coding prompt 更有用。",
    "thesis": "Domain-specific skills may outperform generic coding agents for creative software.",
    "watchFor": "Playable outputs, QA loop, and asset pipeline quality.",
    "risks": "Game demos are easy to look good but hard to make robust.",
    "xKeywords": [
      "threejs-game-skills",
      "majidmanzarpour/threejs-game-skills",
      "game-building agent skills"
    ]
  },
  {
    "id": "awesome-evals",
    "repo": "benchflow-ai/awesome-evals",
    "name": "awesome-evals",
    "url": "https://github.com/benchflow-ai/awesome-evals",
    "homepage": "",
    "description": "A curated, non-BS library of the best resources for building and evaluating AI agents — papers, blogs, talks, tools, benchmarks. Maintained by BenchFlow.",
    "language": "",
    "stars": 759,
    "forks": 69,
    "issues": 19,
    "license": "NOASSERTION",
    "pushedAt": "2026-07-01T22:53:19Z",
    "createdAt": "2026-06-24T08:10:33Z",
    "categories": [
      "evals"
    ],
    "tags": [
      "agent eval library",
      "evals"
    ],
    "decision": "include",
    "collectReason": "非 BS 的 agent eval 资源库，虽然是 curated list，但能帮助判断哪些项目真有评估。",
    "thesis": "The agent ecosystem needs better eval literacy to filter hype.",
    "watchFor": "Whether it links to runnable benchmarks and maintained tools.",
    "risks": "Awesome lists can decay without strong curation.",
    "xKeywords": [
      "awesome-evals",
      "benchflow-ai/awesome-evals",
      "agent eval library"
    ]
  },
  {
    "id": "launch-your-agent",
    "repo": "anthropics/launch-your-agent",
    "name": "launch-your-agent",
    "url": "https://github.com/anthropics/launch-your-agent",
    "homepage": "",
    "description": "Claude Code skills that take a founder from idea to a live Claude Managed Agent: interview, scope a v0, launch in their own account, grade it, iterate, and schedule it",
    "language": "HTML",
    "stars": 870,
    "forks": 167,
    "issues": 2,
    "license": "Apache-2.0",
    "pushedAt": "2026-07-07T12:53:08Z",
    "createdAt": "2026-06-16T14:49:50Z",
    "categories": [
      "skills"
    ],
    "tags": [
      "founder-to-agent launch skills",
      "skills"
    ],
    "decision": "include",
    "collectReason": "从 idea 到 Claude Managed Agent 的 launch skills，展示 skills 能覆盖产品化流程。",
    "thesis": "Skills can encode whole business workflows, not just coding techniques.",
    "watchFor": "How much is executable versus guidance, and whether grading/iteration is grounded.",
    "risks": "Vendor-specific workflow may not generalize.",
    "xKeywords": [
      "launch-your-agent",
      "anthropics/launch-your-agent",
      "founder-to-agent launch skills"
    ]
  },
  {
    "id": "agentspace",
    "repo": "HKUDS/AgentSpace",
    "name": "AgentSpace",
    "url": "https://github.com/HKUDS/AgentSpace",
    "homepage": "https://hire-an-agent.online/",
    "description": "\"AgentSpace: Human + Agents. One Team. One Workspace\"",
    "language": "TypeScript",
    "stars": 859,
    "forks": 118,
    "issues": 6,
    "license": "Apache-2.0",
    "pushedAt": "2026-07-24T03:40:37Z",
    "createdAt": "2026-06-22T04:08:03Z",
    "categories": [
      "workspace"
    ],
    "tags": [
      "human-agent workspace",
      "workspace"
    ],
    "decision": "include",
    "collectReason": "Human + Agents 的协作 workspace，关注人和 agent 同队工作。",
    "thesis": "Agent products may converge on shared workspaces rather than chat windows.",
    "watchFor": "Role assignment, activity visibility, and artifact ownership.",
    "risks": "Workspace products need strong execution primitives to avoid being dashboards.",
    "xKeywords": [
      "AgentSpace",
      "HKUDS/AgentSpace",
      "human-agent workspace"
    ]
  },
  {
    "id": "visa-vulnerability-agentic-harness",
    "repo": "visa/visa-vulnerability-agentic-harness",
    "name": "visa-vulnerability-agentic-harness",
    "url": "https://github.com/visa/visa-vulnerability-agentic-harness",
    "homepage": "",
    "description": "Visa Vulnerability Agentic Harness",
    "language": "Python",
    "stars": 1677,
    "forks": 209,
    "issues": 0,
    "license": "NOASSERTION",
    "pushedAt": "2026-07-03T18:21:44Z",
    "createdAt": "2026-06-05T00:26:33Z",
    "categories": [
      "security"
    ],
    "tags": [
      "vulnerability agent harness",
      "security"
    ],
    "decision": "include",
    "collectReason": "Visa 做 vulnerability agentic harness，企业安全 agent 方向值得看。",
    "thesis": "Large organizations are experimenting with agentic security harnesses.",
    "watchFor": "Disclosure workflow, benchmark tasks, and guardrails.",
    "risks": "Security automation needs conservative defaults.",
    "xKeywords": [
      "visa-vulnerability-agentic-harness",
      "visa/visa-vulnerability-agentic-harness",
      "vulnerability agent harness"
    ]
  },
  {
    "id": "fable-mode",
    "repo": "mrtooher/fable-mode",
    "name": "fable-mode",
    "url": "https://github.com/mrtooher/fable-mode",
    "homepage": "",
    "description": "A Claude skill that activates Fable-style agentic behavior: explicit multi-stage planning, sub-agent delegation, and self-verification.",
    "language": "",
    "stars": 802,
    "forks": 86,
    "issues": 0,
    "license": "NOASSERTION",
    "pushedAt": "2026-07-10T19:41:20Z",
    "createdAt": "2026-06-13T05:33:14Z",
    "categories": [
      "skills"
    ],
    "tags": [
      "Fable-style agent behavior",
      "skills"
    ],
    "decision": "include",
    "collectReason": "Claude skill 激活 Fable-style multi-stage planning/sub-agent/self-verification，适合观察行为模式移植。",
    "thesis": "Model behavior may be shaped by reusable operating modes.",
    "watchFor": "Whether planning/delegation improves outcomes or adds overhead.",
    "risks": "Can become ritualized prompting without measurable gains.",
    "xKeywords": [
      "fable-mode",
      "mrtooher/fable-mode",
      "Fable-style agent behavior"
    ]
  },
  {
    "id": "opentag",
    "repo": "amplifthq/opentag",
    "name": "opentag",
    "url": "https://github.com/amplifthq/opentag",
    "homepage": "",
    "description": "Open-source @agent mentions for Slack and GitHub. OpenTag routes tagged requests to Codex, Claude Code, then returns results in thread.",
    "language": "TypeScript",
    "stars": 1373,
    "forks": 76,
    "issues": 2,
    "license": "MIT",
    "pushedAt": "2026-07-27T07:39:56Z",
    "createdAt": "2026-06-24T08:05:12Z",
    "categories": [
      "workflow"
    ],
    "tags": [
      "agent mentions for Slack/GitHub",
      "workflow"
    ],
    "decision": "include",
    "collectReason": "Open-source @agent mentions，Slack/GitHub 里 tag Codex/Claude Code 并回线程，工作流很现实。",
    "thesis": "Agents may enter teams through existing collaboration surfaces.",
    "watchFor": "Auth, routing, result threading, and auditability.",
    "risks": "Chatops agents need strict permission and noise controls.",
    "xKeywords": [
      "opentag",
      "amplifthq/opentag",
      "agent mentions for Slack/GitHub"
    ]
  },
  {
    "id": "codeseek",
    "repo": "CodeBendKit/codeseek",
    "name": "codeseek",
    "url": "https://github.com/CodeBendKit/codeseek",
    "homepage": "",
    "description": "Rust-powered code intelligence CLI for AI coding agents. Builds call graphs and hybrid semantic search indexes (Dense + Sparse + RRF + Reranker) across 7 languages. Ships as native MCP tools for Claude Code and Codex CLI.",
    "language": "Rust",
    "stars": 788,
    "forks": 42,
    "issues": 0,
    "license": "MIT",
    "pushedAt": "2026-07-26T01:07:51Z",
    "createdAt": "2026-06-03T05:41:22Z",
    "categories": [
      "context"
    ],
    "tags": [
      "code intelligence MCP",
      "context"
    ],
    "decision": "include",
    "collectReason": "Rust code intelligence CLI，call graph + hybrid semantic search + MCP，直接服务 Claude Code/Codex。",
    "thesis": "Code intelligence sidecars can reduce blind file exploration.",
    "watchFor": "Language coverage, index speed, and retrieval precision under real repos.",
    "risks": "Complex indexing may be heavy for small projects.",
    "xKeywords": [
      "codeseek",
      "CodeBendKit/codeseek",
      "code intelligence MCP"
    ]
  },
  {
    "id": "tau",
    "repo": "huggingface/tau",
    "name": "tau",
    "url": "https://github.com/huggingface/tau",
    "homepage": "http://twotimespi.dev/",
    "description": "A Python port of Pi’s minimalist coding agent.",
    "language": "Python",
    "stars": 2045,
    "forks": 225,
    "issues": 60,
    "license": "MIT",
    "pushedAt": "2026-07-27T07:35:11Z",
    "createdAt": "2026-06-11T16:33:44Z",
    "categories": [
      "learning"
    ],
    "tags": [
      "minimalist coding-agent teacher",
      "learning"
    ],
    "decision": "include",
    "collectReason": "Hugging Face 的 minimalist agent 教你创建 coding agents，偏教育但对理解 agent primitives 有价值。",
    "thesis": "Small teaching agents can clarify what is essential in coding-agent design.",
    "watchFor": "Whether examples are runnable and minimal enough to adapt.",
    "risks": "Education repos may not become production tools.",
    "xKeywords": [
      "tau",
      "huggingface/tau",
      "minimalist coding-agent teacher"
    ]
  },
  {
    "id": "nubase",
    "repo": "OtterMind/Nubase",
    "name": "Nubase",
    "url": "https://github.com/OtterMind/Nubase",
    "homepage": "https://nubase.ai",
    "description": "🔥🔥🔥 Turn AI-written code into real apps. Nubase is an open-source, AI-native backend platform for AI Coding, agentic applications, and modern product teams: Memory, Database, Storage, and Auth in one self-hostable service.",
    "language": "Java",
    "stars": 655,
    "forks": 73,
    "issues": 0,
    "license": "Apache-2.0",
    "pushedAt": "2026-07-21T09:12:14Z",
    "createdAt": "2026-06-08T08:42:51Z",
    "categories": [
      "backend"
    ],
    "tags": [
      "AI-native backend platform",
      "backend"
    ],
    "decision": "include",
    "collectReason": "把 memory/database/storage/auth 打包给 AI-written apps，解决 vibe coding 从 demo 到真实 app 的后端缺口。",
    "thesis": "AI coding workflows need backend platforms designed for generated apps.",
    "watchFor": "Migration path, self-hosting, and data model clarity.",
    "risks": "Platform scope is broad; reliability matters more than demo speed.",
    "xKeywords": [
      "Nubase",
      "OtterMind/Nubase",
      "AI-native backend platform"
    ]
  },
  {
    "id": "canary",
    "repo": "0xnyn/canary",
    "name": "canary",
    "url": "https://github.com/0xnyn/canary",
    "homepage": "",
    "description": "QA harness built for Claude Code | E2E testing with screen recordings, console logs, network HARs, and Playwright traces",
    "language": "TypeScript",
    "stars": 452,
    "forks": 35,
    "issues": 2,
    "license": "NOASSERTION",
    "pushedAt": "2026-06-20T23:05:12Z",
    "createdAt": "2026-06-03T19:16:55Z",
    "categories": [
      "qa"
    ],
    "tags": [
      "QA harness for Claude Code",
      "qa"
    ],
    "decision": "include",
    "collectReason": "E2E 测试、录屏、console、HAR、Playwright traces 给 Claude Code，命中 verification。",
    "thesis": "Coding agents need rich QA artifacts to self-correct frontend work.",
    "watchFor": "Trace packaging, replayability, and integration with agent loops.",
    "risks": "QA harnesses can be noisy if failures are not summarized well.",
    "xKeywords": [
      "canary",
      "wizenheimer/canary",
      "QA harness for Claude Code"
    ]
  },
  {
    "id": "metaharness",
    "repo": "ruvnet/metaharness",
    "name": "metaharness",
    "url": "https://github.com/ruvnet/metaharness",
    "homepage": "https://Cognitum.One",
    "description": "🛠️ The meta-harness for AI agents — scaffold your own focused, branded agent harness with its own npx CLI, MCP server, memory, learning loop, and witness-signed releases. Works with Claude Code, Codex, pi.dev, Hermes, OpenClaw, and RVM (hardware-isolated sandbox).",
    "language": "TypeScript",
    "stars": 519,
    "forks": 59,
    "issues": 23,
    "license": "MIT",
    "pushedAt": "2026-07-17T22:47:22Z",
    "createdAt": "2026-06-13T18:29:11Z",
    "categories": [
      "ai-agents"
    ],
    "tags": [
      "agent harness scaffolder",
      "ai-agents"
    ],
    "decision": "include",
    "collectReason": "生成专注的 branded agent harness，带 CLI/MCP/memory/learning loop，适合观察 agent factory 方向。",
    "thesis": "Teams may scaffold custom harnesses instead of using one generic agent.",
    "watchFor": "Template quality, witness-signed releases, and hardware sandbox story.",
    "risks": "Scaffolders can produce shallow forks without maintenance.",
    "xKeywords": [
      "metaharness",
      "ruvnet/metaharness",
      "agent harness scaffolder"
    ]
  }
]

export function xSearchUrl(keywords = []) {
  const query = [...keywords, 'GitHub', 'open source'].filter(Boolean).join(' OR ')
  return `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=top`
}
