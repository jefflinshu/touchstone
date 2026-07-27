import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(
  ROOT,
  'data-archive/gpt5-6/bulk-library-2026-07-09-to-2026-07-23/window-posts.json'
)
const PRODUCT_HUNT_RAW = resolve(
  ROOT,
  'data-archive/gpt5-6/producthunt-openai-day-2026-07-23/producthunt-400.raw.json'
)
const PRODUCT_HUNT_EVENT = 'https://www.producthunt.com/contests/openai-day-july-26'
const OPENAI_RELEASE = 'https://openai.com/index/gpt-5-6/'
const NOTE_RESEARCH = 'https://note.com/kawakijourney_ai/n/nb56a79ec3e0e'
const OPENAI_DEVS_SHOWCASE = 'https://youmind.com/landing/x-viral-articles/gpt-5-6-community-projects-showcase'

const metrics = (likes = 0, replies = 0) => ({
  likes,
  reposts: 0,
  replies,
  quotes: 0,
  views: 0,
  bookmarks: 0,
})

const slug = (value) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')

const productHuntSeedProducts = [
  ['Teable 3.0', 'AI Spreadsheet for Business', 'teable-4', 462],
  ['PromptQL', 'Multiplayer AI that replaces Slack', 'promptql', 478],
  ['PodcastorAI', 'Your AI twin hosts your video podcast', 'podcastorai', 342],
  ['CrawlRaven', 'SEO Hub for GSC + GA4 + a 200-point crawl', 'crawlraven', 301],
  ['AskCodi', 'Orchestrate agents at scale while reducing cost', 'askcodi', 286],
  ['RunEvr', 'Agentic project management environment for creatives', 'runevr', 201],
  ['Moxie Docs: Knowledgebases', 'Automated documentation for developers, users, and AI tools', 'moxie-docs', 179],
  ['Wispro', 'Stop typing, start talking, get perfectly written text', 'wispro', 154],
  ['canitbebuilt', 'Your hardware idea inspected with a verdict, BOM, and 3D model', 'canitbebuilt', 145],
  ['OpenCode Superapp', 'The power of Codex with local, self-hosted models and voice', 'opencode-superapp', 133],
  ['Squishy', 'The screen-time pet you keep alive with someone', 'squishy', 124],
  ['Basement', 'Shopping browser with agentic checkout', 'basement-browser', 119],
  ['Basedash AI Kit', 'Ship AI analytics in your product, powered by GPT-5.6', 'basedash', 117],
  ['Megaphone', "Open-source Mac dictation app that's 100% on-device", 'megaphone-3', 108],
  ['HOL Guard', 'The first firewall for AI agents', 'hol-guard', 110],
  ['AgentLoop', 'Starts a fresh Codex worker and critic every cycle', 'agentloop-2', 107],
  ['Trend Seeker', 'Market research and idea validation from 140K+ signals', 'trend-seeker', 91],
  ['Pulse', "Your company's permission-aware, proactive and agentic brain", 'pulse-47', 89],
  ['Motionly', 'AI-native motion graphics editor', 'motionly', 87],
  ['Vevey', 'A game development tutor now on iOS', 'vevey', 83],
  ['GTA DataCity', 'San Francisco co-working data visualized as a game', 'gta-datacity-san-francisco', 83],
  ['Rechroma', 'Build better color palettes and ship complete color systems', 'rechroma', 83],
  ['Drawsy', 'An AI workspace where your canvas and code work together', 'drawsy', 81],
  ['Caw', 'Open-source web terminal multiplexer for AI agents', 'caw', 81],
  ['Plow Mac App', 'Run GPT-5.6 on OpenClaw and Hermes safely on your Mac', 'plow-mac-app-safely-run-gpt-5-6-agents', 78],
  ['Fable Flight', 'Learn to fly with a live AI instructor', 'fable-flight', 77],
  ['AVE', 'Local-first AI video editor for Mac', 'ave-ai-video-editor', 77],
  ['Speakworld', 'Learn languages by exploring worlds and talking to locals', 'speakworld', 76],
  ['valv', 'Your database, safe for agents to query', 'valv-2', 75],
  ['El Niño', 'See live signals from the Pacific warming climate', 'el-nino', 75],
  ['NotifyBridge', 'Dead-simple IoT push notifications for makers and hobbyists', 'notifybridge', 74],
  ['Findborg', 'A search engine with no ads', 'findborg', 75],
  ['Ombrelle', 'Modern window dimming built for focus on macOS', 'ombrelle', 76],
  ['Fikry', 'A mis-trained AI powered by bad data and confidence', 'mis-trained-model-fikry', 72],
  ['Mnemcore', 'Turns hours of team video and notes into searchable memory', 'mnemcore', 75],
  ['Mufal', 'Undetectable AI copilot for live meetings', 'mufal', 73],
  ['Cubby Clipboard', 'Windows clipboard history that searches inside screenshots', 'cubby-clipboard', 71],
  ['xPitch', 'Strava for casual footballers', 'xpitch-football-match-analytics', 70],
  ['Nugget', 'Capture your rambles and keep what matters', 'nugget-6', 70],
  ['ReExplain', "Explain what you know to AI and discover what you don't", 'reexplain', 73],
  ['AI Eyes', 'Permission-first co-presence controls for AI companions', 'ai-eyes-2', 68],
  ['Rehello', 'Made for introverts to remember people and reconnect naturally', 'rehello', 69],
  ['Swenest', 'A platform that teaches how to navigate real-world code', 'swenest', 68],
  ['SMASH Voice to Invoice', 'Build and send quotes as fast as you can talk', 'smash-voice-to-invoice', 69],
  ['AuraSpeak', 'Break the English–Japanese language barrier with a QR scan', 'auraspeak', 68],
  ['LapuAi', 'OS driver for AI to use computers', 'lapuai', 66],
  ['Chimlo', 'Track Codex and Claude Code and respond from your Notch', 'chimlo-agents-in-your-macbook-notch', 65],
  ['Vizhi', 'Mission control for Codex CLI on a Logitech MX keypad', 'vizhi', 66],
  ['SwiftScale Software', "QA agent that tests apps the way you'd explain them", 'swiftscale-software', 65],
  ['PenguinHarness', 'Let agents autonomously build better agents for $0.02', 'penguinharness', 65],
  ['PromptScout', "Increase your brand's AI visibility on autopilot", 'promptscout', 65],
  ['Fathom', 'Turn messy bank exports into clear financial decisions', 'fathom-6', 61],
]

const productHuntProducts = (() => {
  try {
    const products = JSON.parse(readFileSync(PRODUCT_HUNT_RAW, 'utf8'))
    if (Array.isArray(products) && products.length === 400) return products
  } catch {}
  return productHuntSeedProducts.map(([title, tagline, productSlug, upvotes], index) => ({
    rank: index + 1,
    title,
    tagline,
    url: `https://www.producthunt.com/products/${productSlug}`,
    imageUrl: '',
    topics: [],
    comments: 0,
    upvotes,
  }))
})()

const productPosts = productHuntProducts.map((product, index) => {
  const productSlug = product.url.split('/').filter(Boolean).at(-1)
  const rank = product.rank || index + 1
  const topics = Array.isArray(product.topics) ? product.topics.filter(Boolean) : []
  return {
    id: `openai-day-${String(rank).padStart(3, '0')}-${productSlug}`,
    url: product.url,
    author: productSlug,
    authorName: product.title,
    date: '2026-07-23',
    title: product.title,
    text: `Built with GPT-5.6 for OpenAI Day: ${product.tagline}. Product Hunt lists this as participating launch #${rank} in the official OpenAI Day collection.${topics.length ? ` Categories: ${topics.join(', ')}.` : ''}`,
    ...(product.imageUrl ? { media: [{ type: 'image', url: product.imageUrl.split('?')[0] }] } : {}),
    mediaVerified: true,
    metrics: metrics(product.upvotes, product.comments),
    sourceMode: 'product-hunt-openai-day',
    sourceContextUrl: PRODUCT_HUNT_EVENT,
    researchVerified: true,
  }
})

const communityCases = [
  ['2075268746315268138', 'mattshumer_', '2026-07-09', 'Voxel Manhattan from a single prompt', 'Built with GPT-5.6 Sol: a navigable voxel model of Manhattan generated from one prompt.'],
  ['2075272635466862777', 'derrickcchoi', '2026-07-09', 'Fifteen website and UI generations', 'Built with GPT-5.6 Sol: fifteen distinct website and interface concepts generated as a broad frontend capability test.'],
  ['2075292795557040391', 'pankajkumar_dev', '2026-07-09', 'Google Earth-style 3D globe clone', 'Built with GPT-5.6 Sol: a browser-based Google Earth-style globe and map exploration clone.'],
  ['2075545587093807111', 'viktoroddy', '2026-07-10', 'Cinematic website generation tutorial', 'Built with GPT-5.6 Sol: a cinematic interactive website and tutorial demonstrating the model’s design workflow.'],
  ['2075275293141700613', 'kidpakerot', '2026-07-09', 'Animated SaaS landing page', 'Built with GPT-5.6 Sol: a polished SaaS landing page with motion, hierarchy, and product storytelling.'],
  ['2075398419766468609', 'om_patel5', '2026-07-10', 'Photo-to-editable Three.js tool', 'Built with GPT-5.6 Sol: a Codex tool that converts a reference photo into an editable procedural Three.js object.'],
  ['2075843206282166674', 'MengTo', '2026-07-11', 'React infinite canvas', 'Built with GPT-5.6 Sol: an infinite spatial canvas in React with direct manipulation and fluid navigation.'],
  ['2075745978880344565', 'CommandCodeAI', '2026-07-11', 'Car racing game comparison', 'Built with GPT-5.6 Sol: a playable racing scene used to compare one-shot game generation and visual polish.'],
  ['2076413550768144749', 'mweinbach', '2026-07-12', 'Adaptive Electron desktop UI', 'Built with GPT-5.6 Sol: an Electron interface that adapts layout and interactions across desktop workflows.'],
  ['2076043834761314504', 'givros', '2026-07-11', '3D character generation pipeline', 'Built with GPT-5.6 Sol: a 3D character pipeline covering generation, scene setup, and browser presentation.'],
  ['2076119698333167737', 'fragiannicola', '2026-07-12', 'Effort slider interface concept', 'Built with GPT-5.6 Sol: an interface concept for choosing reasoning effort with clear visual feedback.'],
  ['2076347110417678502', 'cjzafir', '2026-07-12', 'Codex orchestration plugin', 'Built with GPT-5.6 Sol: a plugin that orchestrates Codex workers across a structured software workflow.'],
  ['2075448000659255624', 'intheworldofai', '2026-07-10', 'macOS browser operating system', 'Built with GPT-5.6 Sol: a browser-based operating-system interface inspired by macOS.'],
  ['2075521679871422694', 'sonnylazuardi', '2026-07-10', 'Compressor product landing page', 'Built with GPT-5.6 Sol: a product landing page for a fictional compressor with rendered product storytelling.'],
  ['2075339959389626877', 'bkase_', '2026-07-09', 'Roblox browser clone', 'Built with GPT-5.6 Sol: a browser recreation of Roblox-style navigation and game discovery.'],
  ['2076341790802886971', 'jadenitripp', '2026-07-12', 'Voidboots platformer', 'Built with GPT-5.6 Sol: a polished browser platformer called Voidboots with responsive movement and level design.'],
  ['2076406428756058430', 'emanueledpt', '2026-07-12', 'Synara AppSnap interaction', 'Built with GPT-5.6 Sol: an AppSnap interaction for Synara with refined motion and product UI states.'],
  ['2075312067565752758', 'ziwenxu_', '2026-07-09', 'Minecraft-style browser world', 'Built with GPT-5.6 Sol: a Minecraft-style browser world with block terrain and first-person exploration.'],
  ['2076164825319645422', 'TokenGremlin', '2026-07-12', 'Real-time cloth simulation', 'Built with GPT-5.6 Sol: an interactive real-time cloth simulation with controllable physics.'],
  ['2076032679527739690', 'aniketjart', '2026-07-11', 'Fairy Ride game', 'Built with GPT-5.6 Sol: a whimsical playable Fairy Ride game with a complete visual world.'],
].map(([id, author, date, title, text]) => ({
  id,
  url: `https://x.com/${author}/status/${id}`,
  author,
  authorName: author,
  date,
  title,
  text,
  mediaVerified: true,
  metrics: metrics(1),
  sourceMode: 'manual-web-research-note-roundup',
  sourceContextUrl: NOTE_RESEARCH,
  researchVerified: true,
  coverMode: 'generated',
}))

const openaiDevsCases = [
  ['2075374512401711203', 'evayzh', '2026-07-10', 'Blender scene generation', 'Built with GPT-5.6 Sol: a Blender scene generation workflow demonstrating 3D composition and tool use.'],
  ['2075950897029374334', 'emollick', '2026-07-11', 'Five-hour randomized game build', 'Built with GPT-5.6 Sol: a randomized game produced during a five-hour autonomous build experiment.'],
  ['2075269373426536691', 'emollick', '2026-07-09', 'Playable goblins game', 'Built with GPT-5.6 Sol: a complete playable goblins game generated as an early launch-day test.'],
  ['2075708679639195878', 'earthtojake', '2026-07-10', 'Millennium Falcon vortex scene', 'Built with GPT-5.6 Sol: an interactive 3D Millennium Falcon scene flying through a spatial vortex.'],
  ['2075270869992264003', 'arcprize', '2026-07-09', 'ARC-AGI-3 interactive game', 'Built with GPT-5.6 Sol: an interactive ARC-AGI-3 game used to explore visual reasoning behavior.'],
  ['2075267820225782007', 'petergyang', '2026-07-09', 'Star Fox game and six launch experiments', 'Built with GPT-5.6 Sol: a Star Fox-style game plus six additional launch-day coding and design experiments.'],
  ['2075277718367744257', 'bryantchou', '2026-07-09', 'Brand website generation', 'Built with GPT-5.6 Sol: a polished brand website from a high-level creative brief.'],
  ['2075335761759539669', 'charliehelps', '2026-07-09', 'Proactive multi-agent workflow', 'Built with GPT-5.6 Sol: a proactive agent workflow that coordinates work and continues without constant prompting.'],
  ['2075273931892613367', 'JustinGorya', '2026-07-09', 'Terra automotive website', 'Built with GPT-5.6 Terra: a complete automotive marketing website generated from a concise brief.'],
].map(([id, author, date, title, text]) => ({
  id,
  url: `https://x.com/${author}/status/${id}`,
  author,
  authorName: author,
  date,
  title,
  text,
  mediaVerified: true,
  metrics: metrics(1),
  sourceMode: 'openai-devs-showcase-research',
  sourceContextUrl: OPENAI_DEVS_SHOWCASE,
  researchVerified: true,
  coverMode: 'generated',
}))

const redditCases = [
  ['1v0ufs4', 'codex', '2026-07-19', 'Real-time multiplayer penalty shootout', 'Built with GPT-5.6 Sol in Codex Goal mode: a real-time multiplayer penalty game with matchmaking, WebSockets, Cloudflare Workers, and Durable Objects.'],
  ['1utgszp', 'OpenAI', '2026-07-11', 'Interactive 3D Central London', 'Built with GPT-5.6 Sol: an interactive 3D reconstruction of central London used to challenge long-horizon spatial generation.'],
  ['1uy532q', 'codex', '2026-07-16', 'Generated freerun game', 'Built with GPT-5.6 Sol in Codex: a generated freerun game pushed from an initial prototype into a playable browser experience.'],
  ['1uu96qg', 'AISEOInsider', '2026-07-12', 'Eight-game GPT-5.6 versus Fable 5 comparison', 'Built with GPT-5.6 Sol: eight playable games generated side by side with Fable 5 to compare design and coding behavior.'],
  ['1uu1zyd', 'PayloadCMS', '2026-07-12', 'WordPress to Payload and Nuxt migration', 'Built with GPT-5.6 Sol: a complete WordPress migration to Payload CMS and Nuxt with content, schema, and frontend work.'],
  ['1uyb1i9', 'ClaudeAI', '2026-07-16', 'One-hundred-prompt frontend benchmark', 'Built with GPT-5.6 Sol and competing models: one hundred frontend generations used for a broad visual implementation benchmark.'],
  ['1uxj3cy', 'math', '2026-07-15', 'Convex optimization proof exploration', 'Built with GPT-5.6 Sol: a mathematical proof exploration using a convex-optimization route after OpenAI’s CDC proof announcement.'],
  ['1ux396z', 'OpenAI', '2026-07-16', 'Three-body problem simulation', 'Built with GPT-5.6 Sol: an interactive simulation and investigation of the three-body problem.'],
  ['1uvrtl0', 'singularity', '2026-07-13', 'Erdős problem research result', 'Built with GPT-5.6 Sol: a research workflow addressing a decades-old Erdős problem with source-linked reasoning and verification.'],
  ['1usossd', 'ChatGPT', '2026-07-10', 'Reverse-engineered desktop app', 'Built with GPT-5.6 Sol: a desktop application reverse-engineered from its own visible behavior and interface.'],
  ['1uvh2z6', 'codex', '2026-07-13', 'Image-to-3D GPT-5.6 versus Fable 5', 'Built with GPT-5.6 Sol: a side-by-side image-to-3D procedural generation comparison with Fable 5.'],
  ['1uy2jxk', 'codex', '2026-07-16', 'Giant alien space squid game expansion', 'Built with GPT-5.6 Sol: an overnight game expansion that added a giant alien space squid and related gameplay systems.'],
].map(([id, subreddit, date, title, text]) => ({
  id,
  url: `https://www.reddit.com/r/${subreddit}/comments/${id}/`,
  author: `reddit-${id}`,
  authorName: `r/${subreddit}`,
  date,
  title,
  text,
  mediaVerified: true,
  metrics: metrics(),
  sourceMode: 'manual-web-research',
  researchVerified: true,
  coverMode: 'generated',
}))

const officialArtifacts = [
  ['tiny-voids-game', 'Tiny voids game', 'Built with GPT-5.6: a tiny-voids game shown by OpenAI as a launch example of stronger frontend and game-design judgment.'],
  ['museum-website', 'Museum website', 'Built with GPT-5.6: a polished museum website shown by OpenAI as a launch example of functional interface design.'],
  ['clockwork-village-game', 'Clockwork village game', 'Built with GPT-5.6: an interactive clockwork village game shown in OpenAI’s official design showcase.'],
  ['interior-design-presentation', 'Interior design presentation', 'Built with GPT-5.6: an editable interior-design presentation with coherent visual hierarchy and layout.'],
  ['interactive-spirograph', 'Interactive spirograph', 'Built with GPT-5.6: an interactive spirograph that turns a natural-language request into an explorable visualization.'],
  ['wave-interference', 'Interactive wave interference', 'Built with GPT-5.6: an interactive wave-interference explainer shown in ChatGPT Work.'],
  ['tokenizer-explainer', 'Interactive GPT tokenizer explainer', 'Built with GPT-5.6: an interactive tokenizer explainer generated as a polished educational artifact.'],
  ['equity-research-document', 'Equity research document', 'Built with GPT-5.6: a visually refined equity-research document following a professional reference format.'],
  ['leveraged-buyout-model', 'Leveraged buyout model', 'Built with GPT-5.6: an editable leveraged-buyout spreadsheet model with improved equations and worksheet layout.'],
].map(([id, title, text]) => ({
  id,
  url: `${OPENAI_RELEASE}#${id}`,
  author: 'openai',
  authorName: 'OpenAI',
  date: '2026-07-09',
  title,
  text,
  mediaVerified: true,
  metrics: metrics(),
  sourceMode: 'openai-first-party-launch',
  researchVerified: true,
  coverMode: 'generated',
}))

const partnerCases = [
  ['cursor', 'Cursor coding persistence and efficiency', 'Cursor reported GPT-5.6 among its strongest models for persistence, intelligence, and overall coding efficiency.'],
  ['qodo', 'Qodo agentic code review', 'Qodo reported GPT-5.6 was its strongest model on agentic code-review tests, with better F1, lower latency, and fewer tokens.'],
  ['notion', 'Notion custom agents and memory refinement', 'Notion reported GPT-5.6 stayed focused for days and improved custom agents and evolving workspace memories.'],
  ['cognition', 'Cognition production coding agents', 'Cognition reported GPT-5.6 as a top-tier production coding-agent model with strong cost efficiency.'],
  ['rogo', 'Rogo financial research agents', 'Rogo reported GPT-5.6 improved financial-research rubric quality and accuracy while reducing tokens and completion time.'],
  ['ramp', 'Ramp end-to-end technical operator', 'Ramp reported GPT-5.6 could inspect live systems, debug, edit code, validate results, publish artifacts, and retain context.'],
  ['shopify', 'Shopify staged repository workflow', 'Shopify reported GPT-5.6 followed intent better across research, planning, staged implementation, and line-linked code references.'],
  ['cisco', 'Cisco research and design workflows', 'Cisco reported GPT-5.6 stayed focused through long tasks and produced clear reports and intuitive diagrams.'],
  ['clio', 'Clio legal research and document workflows', 'Clio reported GPT-5.6 improved legal research quality while reducing tokens in multi-step document analysis.'],
  ['balyasny', 'Balyasny multi-hop financial research', 'Balyasny reported GPT-5.6 led multiple financial-research categories with higher token efficiency.'],
  ['basis', 'Basis autonomous accounting agents', 'Basis reported GPT-5.6 improved reasoning, decision making, autonomy, and subagent use for complex accounting.'],
  ['lovable', 'Lovable production-grade app building', 'Lovable reported GPT-5.6 completed app-building workflows with fewer steps and tool calls while reducing stuck runs.'],
  ['model-ml', 'Model ML client-ready presentations', 'Model ML reported GPT-5.6 generated more polished and legible client decks with clearer data visualizations.'],
  ['triple-whale', 'Triple Whale responsive frontend benchmark', 'Triple Whale reported GPT-5.6 was its best overall frontend model across ecommerce, dashboard, and product briefs.'],
  ['playco', 'PlayCo structured Unity scene construction', 'PlayCo used GPT-5.6 with programmatic tool calling to build detailed Unity scenes with fewer tokens and model turns.'],
  ['canva', 'Canva presentation creation', 'Canva reported GPT-5.6 was especially strong for presentation creation and more token-efficient in early design evaluations.'],
  ['microsoft', 'Microsoft 365 artifact generation', 'Microsoft reported GPT-5.6 produced cohesive and accurate productivity artifacts that required less refinement.'],
  ['base44', 'Base44 real-world app conversations', 'Base44 reported GPT-5.6 reduced input and output tokens across real-world app-building conversations.'],
  ['legora', 'Legora legal drafting and precedent review', 'Legora reported GPT-5.6 improved structured legal drafting and precedent review while staying cautious.'],
  ['figma', 'Figma Make design-to-code prototypes', 'Figma reported GPT-5.6 turned complex designs into interactive prototypes and raised the bar for design-to-code.'],
].map(([id, title, result]) => ({
  id: `partner-${id}`,
  url: `${OPENAI_RELEASE}#partner-${id}`,
  author: id,
  authorName: title.split(' ')[0],
  date: '2026-07-09',
  title,
  text: `Built and evaluated with GPT-5.6: ${result}`,
  mediaVerified: true,
  metrics: metrics(),
  sourceMode: 'openai-first-party-partner-evaluation',
  researchVerified: true,
  coverMode: 'generated',
}))

const posts = [
  ...productPosts,
  ...communityCases,
  ...openaiDevsCases,
  ...redditCases,
  ...officialArtifacts,
  ...partnerCases,
]

const urls = new Set()
for (const post of posts) {
  if (urls.has(post.url)) throw new Error(`Duplicate source URL: ${post.url}`)
  urls.add(post.url)
}

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, `${JSON.stringify(posts, null, 2)}\n`)
console.log(`[gpt56:bulk-archive] wrote ${posts.length} cases to ${OUTPUT}`)
