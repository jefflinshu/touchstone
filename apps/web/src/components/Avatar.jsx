import { useState } from 'react'
import { cn } from '@/lib/utils'

export default function Avatar({ email, picture, className }) {
  const [broken, setBroken] = useState(false)
  if (picture && !broken) {
    return (
      <img
        src={picture}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    )
  }
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-white/10 font-mono uppercase text-white/70',
        className
      )}
    >
      {(email || '?')[0]}
    </span>
  )
}

export const displayName = (email, users) => users?.[email]?.name || (email ? email.split('@')[0] : '')
