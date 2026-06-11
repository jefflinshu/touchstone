import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const base =
  'w-full rounded-md border border-white/12 bg-white/[0.03] px-3 text-[13px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-acid/60 focus:bg-white/[0.05]'

const Input = forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(base, 'h-9', className)} {...props} />
))
Input.displayName = 'Input'

const Textarea = forwardRef(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, 'min-h-20 resize-y py-2.5 leading-6', className)} {...props} />
))
Textarea.displayName = 'Textarea'

export { Input, Textarea }
