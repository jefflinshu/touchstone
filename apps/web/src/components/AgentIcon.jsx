import { cn } from '@/lib/utils'
import claudeIcon from '@lobehub/icons-static-svg/icons/claude-color.svg'
import codexIcon from '@lobehub/icons-static-svg/icons/codex-color.svg'
import geminiIcon from '@lobehub/icons-static-svg/icons/gemini-color.svg'
import opencodeIcon from '@lobehub/icons-static-svg/icons/opencode.svg'

// CLI → 品牌图标（lobe-icons）。未知 agent 回退为配置色圆点
const ICONS = {
  claude: { src: claudeIcon },
  codex: { src: codexIcon },
  gemini: { src: geminiIcon },
  opencode: { src: opencodeIcon, monochrome: true },
}

export default function AgentIcon({ agentId, color, className = 'h-3.5 w-3.5' }) {
  const icon = ICONS[agentId]
  if (!icon) {
    return <span className={cn('inline-block shrink-0 rounded-full', className)} style={{ background: color }} />
  }
  if (icon.monochrome) {
    return (
      <span
        aria-hidden="true"
        className={cn('inline-block shrink-0 bg-current text-foreground', className)}
        style={{
          WebkitMask: `url(${icon.src}) center / contain no-repeat`,
          mask: `url(${icon.src}) center / contain no-repeat`,
        }}
      />
    )
  }
  return <img src={icon.src} alt="" className={cn('shrink-0', className)} />
}
