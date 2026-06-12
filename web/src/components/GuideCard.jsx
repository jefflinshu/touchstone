import { useState } from 'react'
import { Check, Copy, TriangleAlert, Loader2, X, ExternalLink, Globe } from 'lucide-react'
import AgentIcon from './AgentIcon.jsx'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'

// 各 CLI 的安装引导（health.fix 是登录类问题的修复提示，未安装时用这里的命令）
const INSTALL = {
  claude: { cmd: 'npm install -g @anthropic-ai/claude-code', doc: 'https://claude.com/claude-code' },
  codex: { cmd: 'npm install -g @openai/codex', doc: 'https://developers.openai.com/codex/cli' },
  gemini: { cmd: 'npm install -g @google/gemini-cli', doc: 'https://github.com/google-gemini/gemini-cli' },
}

const STEPS = [
  { n: '01', title: '描述想法', desc: '一句话描述你想做的东西，项目名和分类自动生成' },
  { n: '02', title: '多 Agent 同跑', desc: '同一个 prompt 发给多个 CLI Agent，本地并行实现' },
  { n: '03', title: '对比作品', desc: '跑完直接在浏览器里打开对比，看哪个模型最强' },
]

function CmdLine({ cmd }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-1.5 flex items-center overflow-hidden rounded border border-white/10 bg-black/30">
      <code className="flex-1 truncate px-2 py-1 font-mono text-[11px] text-white/70">{cmd}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(cmd)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="cursor-pointer border-l border-white/10 px-2 py-1 text-white/40 transition-colors hover:text-white"
      >
        {copied ? <Check className="h-3 w-3 text-acid" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  )
}

function AgentStatus({ agent }) {
  const h = agent.health || {}
  const ready = h.ready !== false
  const install = INSTALL[agent.id]
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] px-3.5 py-3">
      <div className="flex items-center gap-2">
        <AgentIcon agentId={agent.id} color={agent.color} className="h-4 w-4" />
        <span className="text-[13px] font-medium whitespace-nowrap">{agent.name}</span>
        {ready ? (
          <span className="ml-auto flex items-center gap-1 font-mono text-[10px] tracking-[0.15em] text-acid uppercase">
            <Check className="h-3 w-3" /> Ready
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1 font-mono text-[10px] tracking-[0.15em] text-amber-400 uppercase">
            <TriangleAlert className="h-3 w-3" /> {h.installed ? '未登录' : '未安装'}
          </span>
        )}
      </div>
      {!ready && (
        <div className="mt-2.5 border-t border-white/8 pt-2.5">
          <p className="text-xs leading-5 text-white/60">{h.fix}</p>
          {!h.installed && install && <CmdLine cmd={install.cmd} />}
          {!h.installed && install && (
            <a
              href={install.doc}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-white/40 uppercase transition-colors hover:text-white"
            >
              安装文档 <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          <p className="mt-1.5 text-[11px] text-white/35">配置完成后刷新页面即可</p>
        </div>
      )}
    </div>
  )
}

// 新手引导弹窗：本地 CLI 环境动态检测 + 玩法 + 发布到社区说明
export default function GuideCard({ agents, open, onOpenChange }) {
  const readyCount = agents.filter((a) => a.health?.ready !== false).length
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[760px] max-w-[calc(100vw-32px)] rounded-xl p-0">
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <DialogTitle className="font-pixel text-sm tracking-[0.15em] text-white">
            GETTING STARTED<span className="text-acid">_</span>
          </DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="cursor-pointer rounded p-1 text-white/35 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        </div>

        <div className="flex max-h-[72vh] flex-col gap-6 overflow-auto p-6 sm:flex-row sm:gap-8">
          {/* 左：本地 CLI 环境（动态检测） */}
          <div className="min-w-0 flex-1">
            <h2 className="font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase">本地环境</h2>
            <p className="mt-1.5 text-xs leading-5 text-white/45">
              Touchstone 调用你本机已安装的 coding CLI 跑任务，已检测到 {readyCount}/{agents.length || 3} 个可用
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {agents.length === 0 ? (
                <div className="flex items-center gap-2 py-4 font-mono text-[11px] tracking-wider text-white/30 uppercase">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 检测中
                </div>
              ) : (
                agents.map((a) => <AgentStatus key={a.id} agent={a} />)
              )}
            </div>
          </div>

          {/* 右：玩法 + 发布说明 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase">怎么玩</h2>
            <div className="mt-3 flex flex-col gap-2.5">
              {STEPS.map((s) => (
                <div key={s.n} className="flex gap-3">
                  <span className="font-pixel mt-0.5 text-sm text-acid">{s.n}</span>
                  <div>
                    <div className="text-[13px] font-medium text-white/85">{s.title}</div>
                    <div className="mt-0.5 text-xs leading-5 text-white/45">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-md border border-acid/20 bg-acid/[0.04] px-3.5 py-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-acid uppercase">
                <Globe className="h-3 w-3" /> 发布到社区
              </div>
              <p className="mt-1.5 text-xs leading-5 text-white/55">
                任务默认只保存在你本地。勾选「发布到社区」后，作品完成会自动 commit 并上传到公开的 GitHub
                社区仓库，出现在首页供大家浏览、点赞——相当于把这次对比结果分享出去。
              </p>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-8 font-mono text-[11px] font-bold tracking-[0.15em] uppercase"
              >
                开始使用
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
