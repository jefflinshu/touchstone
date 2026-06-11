import { cn } from '@/lib/utils'
import claudeIcon from '@lobehub/icons-static-svg/icons/claude-color.svg'
import openaiIcon from '@lobehub/icons-static-svg/icons/openai.svg'
import geminiIcon from '@lobehub/icons-static-svg/icons/gemini-color.svg'

// CLI → 品牌图标（lobe-icons）。未知 agent 回退为配置色圆点
const ICONS = {
  claude: { src: claudeIcon },
  codex: { src: openaiIcon, invert: true }, // openai.svg 是单色黑，深色底上反转为白
  gemini: { src: geminiIcon },
}

export default function AgentIcon({ agentId, color, className = 'h-3.5 w-3.5' }) {
  const icon = ICONS[agentId]
  if (!icon) {
    return <span className={cn('inline-block shrink-0 rounded-full', className)} style={{ background: color }} />
  }
  return <img src={icon.src} alt="" className={cn('shrink-0', icon.invert && 'invert', className)} />
}
