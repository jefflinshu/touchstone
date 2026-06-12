import { useState } from 'react'
import { Heart, Mail, Copy, Check, X } from 'lucide-react'
import { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'

const EMAIL = 'service@curisaas.com'

// 4x5 像素字模，用 █ 拼 ASCII 像素字
const GLYPHS = {
  S: [' ███', '█   ', ' ██ ', '   █', '███ '],
  P: ['███ ', '█  █', '███ ', '█   ', '█   '],
  O: [' ██ ', '█  █', '█  █', '█  █', ' ██ '],
  N: ['█  █', '██ █', '█ ██', '█  █', '█  █'],
  R: ['███ ', '█  █', '███ ', '█ █ ', '█  █'],
}
const wordRows = (word) =>
  Array.from({ length: 5 }, (_, row) => [...word].map((ch) => GLYPHS[ch][row]).join(' '))

const SPONSOR_ROWS = wordRows('SPONSOR')

// 用 CSS Grid 画正方形像素格，不受字体行高/字宽比影响，颜色随 currentColor
function PixelWord({ rows, px, className }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ display: 'grid', gridTemplateColumns: `repeat(${rows[0].length}, ${px}px)`, gap: 1 }}
    >
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => (
          <span key={`${x}-${y}`} style={{ height: px }} className={c === '█' ? 'bg-current' : undefined} />
        ))
      )}
    </div>
  )
}

export default function SponsorCard() {
  const [copied, setCopied] = useState(false)
  const copyEmail = () => {
    navigator.clipboard.writeText(EMAIL)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          title="赞助支持 Touchstone"
          className="group cursor-pointer rounded-lg border border-white/12 bg-white/[0.02] px-5 py-4 text-left transition-colors hover:border-acid/60 hover:bg-acid/[0.04]"
        >
          <PixelWord rows={SPONSOR_ROWS} px={5} className="text-acid/80 transition-colors group-hover:text-acid" />
          <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-white/35 uppercase transition-colors group-hover:text-white/70">
            <Heart className="h-3 w-3 text-acid/70" />
            求赞助
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="w-[440px] max-w-[calc(100vw-32px)] rounded-xl p-0">
        {/* 顶部：ASCII 像素字横幅 */}
        <div className="relative overflow-hidden rounded-t-xl border-b border-white/8 bg-[radial-gradient(80%_120%_at_50%_0%,rgba(212,255,79,0.1)_0%,transparent_70%)] px-6 pt-8 pb-6 text-center">
          <PixelWord
            rows={SPONSOR_ROWS}
            px={8}
            className="inline-grid text-acid [filter:drop-shadow(0_0_6px_rgba(212,255,79,0.35))]"
          />
          <DialogTitle className="mt-4 font-pixel text-base tracking-[0.15em] text-white">
            SUPPORT TOUCHSTONE<span className="text-acid">_</span>
          </DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              className="absolute top-3 right-3 cursor-pointer rounded p-1 text-white/35 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        </div>

        <div className="px-6 py-5">
          <p className="text-center text-[13px] leading-6 text-white/65">
            如果 Touchstone 对你有帮助，欢迎赞助支持持续开发，
            <br />
            或来信交流合作想法。
          </p>

          {/* 邮箱：复制 + mailto */}
          <div className="mt-4 flex items-center overflow-hidden rounded-md border border-white/12 bg-white/[0.03]">
            <Mail className="ml-3 h-3.5 w-3.5 shrink-0 text-white/35" />
            <span className="flex-1 truncate px-2.5 py-2.5 font-mono text-xs text-white/85">{EMAIL}</span>
            <button
              type="button"
              onClick={copyEmail}
              className="flex h-full cursor-pointer items-center gap-1.5 border-l border-white/10 px-3 py-2.5 font-mono text-[10px] tracking-[0.15em] text-white/50 uppercase transition-colors hover:bg-white/5 hover:text-white"
            >
              {copied ? <Check className="h-3 w-3 text-acid" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <a
            href={`mailto:${EMAIL}?subject=${encodeURIComponent('赞助 / 合作 Touchstone')}`}
            className="mt-3 flex h-9 items-center justify-center gap-2 rounded-md bg-acid font-mono text-[11px] font-bold tracking-[0.15em] text-black uppercase transition-opacity hover:opacity-85"
          >
            <Heart className="h-3.5 w-3.5" />
            联系我
          </a>

          <p className="mt-4 text-center font-mono text-[10px] tracking-[0.2em] text-white/25 uppercase">
            Every pixel counts
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
