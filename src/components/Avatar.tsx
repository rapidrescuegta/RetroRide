'use client'

export default function Avatar({ src, size = 'md' }: { src: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-xl',
    lg: 'w-12 h-12 text-2xl',
    xl: 'w-20 h-20 text-4xl',
  }

  const cls = sizeClasses[size]

  // If it's a data URL (photo avatar), show as image
  if (src.startsWith('data:')) {
    return (
      <img
        src={src}
        alt="Avatar"
        className={`${cls} rounded-full object-cover flex-shrink-0`}
      />
    )
  }

  // Otherwise it's an emoji
  return (
    <span className={`${cls} flex items-center justify-center flex-shrink-0`}>
      {src}
    </span>
  )
}
