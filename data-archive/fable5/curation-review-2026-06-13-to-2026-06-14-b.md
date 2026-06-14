# Fable5 低成本审核机制与抽样确认 B

生成时间：2026-06-14

本文件只做审核建议，不修改抓取脚本，也不修改 `web/public/fable5-data` 最终输出。

## 已读输入

- `scripts/update-fable5-showcases.mjs`
- `data-archive/fable5/curation-review-latest.json`
- `data-archive/fable5/incremental-2026-06-12-to-2026-06-13-q0/run-summary.json`
- `data-archive/fable5/incremental-2026-06-12-to-2026-06-13-q0/window-posts.json`
- `data-archive/fable5/incremental-2026-06-12-to-2026-06-13-creators1/run-summary.json`
- `data-archive/fable5/incremental-2026-06-12-to-2026-06-13-creators1/window-posts.json`
- `data-archive/fable5/official-claudeai-2026-06-12-to-2026-06-13/run-summary.json`
- `data-archive/fable5/official-claudeai-2026-06-12-to-2026-06-13/window-posts.json`
- `data-archive/fable5/incremental-2026-06-13-to-2026-06-14-q2/run-summary.json`
- `data-archive/fable5/incremental-2026-06-13-to-2026-06-14-q2/window-posts.json`
- `data-archive/fable5/incremental-2026-06-13-to-2026-06-14-creators7/run-summary.json`
- `data-archive/fable5/incremental-2026-06-13-to-2026-06-14-creators7/window-posts.json`

## 当前过滤标准

当前脚本的核心判断是 `curationDecision(post)`：

- 删除：缺 URL/作者/正文；seed conversation 里不含 Fable/Mythos/Claude；roundup/thread index；弱文本、无公开证据；新闻、平台公告、营销；没有具体 case evidence。
- 保留：有强 artifact evidence；有可见 case evidence；或 linked item 里有 case evidence。
- 强证据大致包括：正文出现 asked/gave/fed/built/created/made/recreated/one-shotted 等动作，且对象是 game/website/web app/app/video/animation/3D/WebGL/shader/UI/workflow/agent/prototype/repo/codebase/dashboard 等；或媒体配合 playable/live demo/source code/GitHub/public link；或可提取 `Prompt:`。
- 硬删除原因会进入 `blockedUrls`：`weak-text-only-or-no-public-evidence`、`news-platform-announcement-or-marketing`、`roundup-or-thread-index`。这会覆盖历史已入池 item。
- 最终还有 `passesFinalNegativeFilter(item)`，会再次剔除政府/安全/发布/可用性/价格/roundup/弱证据/营销类内容。

建议收紧后的人工口径：

- 保留：必须是“真实用 Fable5 做了东西/有效果/demo/case”。优先是作者一手 claim + 媒体/公开 demo/source/可复现 prompt/明确结果。
- 删除：纯口嗨、localhost-only、官方/媒体新闻、模型发布、benchmark 口播、系统提示词泄露/复活教程、导流赚钱、教程索引、roundup/listicle、竞品借 Fable5 引流。
- 灰区：有媒体且文本声称 built/one-shotted，但被营销关键词或非英语表达误伤；这类不应直接硬删，应进抽样或 LLM。

## LLM 入池前判断 schema

LLM 只处理灰区，不全量调用。建议每条输入控制在 URL、作者、日期、正文前 900 字、媒体数量、raw.urls/articleTitle、当前规则 reason。

```json
{
  "url": "string",
  "decision": "keep | delete | human_review",
  "confidence": 0.0,
  "is_fable5_specific": true,
  "is_firsthand_or_direct_case": true,
  "artifact_type": "game | web_app | website | video | animation | 3d | ui | workflow | code | prompt_pack | news | roundup | marketing | unknown",
  "evidence": {
    "has_media": true,
    "has_public_demo_or_source": false,
    "has_prompt": false,
    "has_specific_result_description": true,
    "has_only_localhost": false
  },
  "reject_reasons": [
    "pure_news",
    "roundup_or_thread_index",
    "tutorial_index",
    "money_or_course_funnel",
    "competitor_or_model_release",
    "text_only_hype",
    "localhost_only",
    "not_fable5_made",
    "insufficient_evidence"
  ],
  "short_reason": "one sentence, no chain-of-thought"
}
```

合格标准：`keep` 需要 `is_fable5_specific=true`，并且至少满足 `has_media`、`has_public_demo_or_source`、`has_prompt`、`has_specific_result_description` 中两个；如果只有一个强证据但内容高度具体，返回 `human_review`。

## 低成本触发条件

先用规则，后用少量 LLM：

1. 确定删除不调用 LLM：官方发布、访问/价格/安全政策、纯 benchmark、roundup/listicle、localhost-only、赚钱/course/DM/comment prompt、竞品模型发布、无正文短链。
2. 确定保留不调用 LLM：作者一手说明 Fable5 生成具体 artifact，且有媒体或公开 demo/source/prompt。
3. 只对灰区调用 LLM：
   - 当前规则删除但 `mediaCount > 0` 且正文含 built/created/made/one-shotted/recreated/asked/gave/prompt/demo/play/try/visualizer/Minecraft/landing page/video/animation/3D/WebGL/UI。
   - 非英语 + 有媒体 + 含 Fable/Claude/Mythos 和“做成/可玩/复刻/生成”等语义。
   - 高热度被删：按 `scoreMetrics` 排名前 50 的 removed，或者 likes >= 500 / bookmarks >= 200 / views >= 50k。
   - 当前 keep 但命中强垃圾词：roundup、collection、comment prompt、bookmark this、course、$、make money、system prompt leaked、not made with Fable。
   - 仅有 t.co 短链但 raw.urls/articleTitle 暗示 demo/source/app，规则无法判断。
4. 每次运行固定输出抽样：
   - 自动删除前 10 个高热度样本给用户确认。
   - 灰区删除前 10 个样本给用户确认。
   - 自动保留前 10 个高热度样本给用户确认。
5. 用户确认后把 URL 放入小型 allowlist/blocklist，比 LLM 更便宜且稳定。

## 建议删除样本 10 个

| URL | 理由 |
| --- | --- |
| https://x.com/claudeai/status/2064394146916229443 | 官方发布/模型可用性公告，不是用户 case。 |
| https://x.com/claudeai/status/2065456678909227064 | “Some projects people built” roundup 入口，本身没有具体 demo。 |
| https://x.com/viktoroddy/status/2064703131808584116 | 12 分钟教程导流，重点是教程，不是具体产物 case。 |
| https://x.com/neerajjj6785/status/2064549419589198050 | 三个 localhost 链接，缺少公开 demo/source/media。 |
| https://x.com/minchoi/status/2064547105662996921 | “10 examples” roundup/listicle，不是单条真实产物。 |
| https://x.com/alan_earn/status/2065678107764502539 | articleTitle 是赚钱/Fanvue MCP 教程，属于导流赚钱。 |
| https://x.com/meta_alchemist/status/2065407757390672225 | Kimi 2.7 对比/模型价格讨论，不是 Fable5 产物。 |
| https://x.com/oax_foundation/status/2065303803239469203 | 发布新闻和政策/价格背景，非 case。 |
| https://x.com/claudedevs/status/2064414264807616883 | 使用 `/model` 的访问说明，不是 showcase。 |
| https://x.com/tesanaai/status/2066019261437677913 | 竞品 Tesana 宣传，“是否比 Fable5 更疯狂”，不是 Fable5 产物。 |

## 建议保留样本 10 个

| URL | 理由 |
| --- | --- |
| https://x.com/bijanbowen/status/2064473191163035814 | 明确“Had Claude Fable 5 log network packets and display them as cars”，有具体可视化效果；当前已保留，应该继续保留。 |
| https://x.com/hayashimon1/status/2064658158698782873 | Fable5 流体墨水互动效果，有媒体和“这里可以玩”的公开体验证据。 |
| https://x.com/ann_nnng/status/2065376737471729945 | 一手 claim：Fable5 one-shot 图片转 ASCII 工具；有视频、技术栈和 Try it。 |
| https://x.com/marclou/status/2065029898243318093 | 一手 claim：Fable5 基于 web analytics API 做 DataEmpire；有 Demo 链接。 |
| https://x.com/eijo_aiart/status/2064685137552613852 | 日文一手 claim：让 Fable5 复刻可玩广告游戏；有媒体。当前规则可能误删，建议保留/人工复核。 |
| https://x.com/alexprokhorov/status/2064467938522857562 | 明确 Fable5 one-shot landing page，有媒体；当前规则因 artifact 词表漏掉 landing page 而有误删风险。 |
| https://x.com/chrissgpt/status/2064441716908703780 | 明确 “Make a Minecraft clone”，含多 biomes/day-night/ores/caves 等具体结果和媒体；应保留。 |
| https://x.com/dawnedeuw/status/2064466352375525585 | 明确一 prompt 做 League of Legends champion design，列出 kit/model/abilities/VFX/lore/all working；有媒体。 |
| https://x.com/misbahsy/status/2064578147719249947 | Fable5 one-shot geometric pattern visualizer app，可 play/download，有媒体。 |
| https://x.com/mengto/status/2066035231782740092 | 06-13/06-14 新窗口样本：用 Fable5 prompt landing page，有媒体；建议灰区保留，必要时人工确认是否一手。 |

## 风险点

- `news-platform-announcement-or-marketing` 过宽：有媒体但没有 public evidence 的帖子会被删；这误伤了 landing page、Minecraft clone、视频、日文游戏复刻等真实 demo。
- artifact 词表漏掉 `landing page`、`visualizer app`、`clone`、非英语“作った/できた/再現/遊べます”等表达，导致强 case 走到 marketing 删除。
- `extractPrompt(text)` 会把纯 prompt/tutorial 也视作保留证据；用户口径是不收入教程索引，所以 prompt 不能单独等于 showcase，除非同时有结果/demo。
- `curation-review-latest.json` 的 removedSamples 只取高分前 40，不能覆盖长尾误删；建议新增“灰区删除样本”独立抽样。
- 06-13/06-14 新窗口大量是 “Fable5 被禁/系统提示词泄露/复活教程/竞品替代” 新闻，不应因为含 Fable5 和 media 自动入池。
- `blockedUrls` 对硬删除 URL 有覆盖历史的效果；一旦误删会把历史已保留的好 case 清掉，灰区不要直接进入 hard reject。
