import { forwardRef } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-acid/50 disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none',
  {
    variants: {
      variant: {
        default: 'bg-acid text-black hover:bg-acid/85',
        outline: 'border border-white/15 bg-transparent text-white/80 hover:border-white/40 hover:text-white',
        ghost: 'text-white/60 hover:bg-white/8 hover:text-white',
        danger: 'border border-white/15 text-white/80 hover:border-red-500/70 hover:text-red-400',
      },
      size: {
        default: 'h-9 rounded-md px-4 text-[13px]',
        sm: 'h-7 rounded px-2.5 text-xs',
        icon: 'h-7 w-7 rounded',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

const Button = forwardRef(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
))
Button.displayName = 'Button'

export { Button, buttonVariants }
