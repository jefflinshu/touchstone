import { cn } from '@/lib/utils'

export default function PreviewImage({
  src,
  alt,
  loaded = true,
  priority = false,
  onLoad,
  onError,
  className,
  imageClassName,
}) {
  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-55 blur-2xl saturate-125"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.04),rgba(0,0,0,0.62))]" />
      <div className="absolute inset-0 shadow-[inset_0_0_64px_rgba(0,0,0,0.68)]" />
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        className={cn(
          'relative z-10 h-full w-full object-contain p-2 drop-shadow-[0_10px_24px_rgba(0,0,0,0.36)] transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
          imageClassName
        )}
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  )
}
