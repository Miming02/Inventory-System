import { useState } from "react";

const sizeClass = {
  sm: "h-6 w-6 min-h-6 min-w-6",
  md: "h-8 w-8 min-h-8 min-w-8",
  lg: "h-10 w-10 min-h-10 min-w-10",
};

const iconClass = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
};

/**
 * Profile image when `src` is set and loads; otherwise a neutral person icon (no external URLs).
 */
export function UserAvatarOrIcon({ src, alt = "", size = "md", className = "" }) {
  const [broken, setBroken] = useState(false);
  const dim = sizeClass[size] ?? sizeClass.md;
  const ic = iconClass[size] ?? iconClass.md;
  const showImg = Boolean(src) && !broken;

  if (showImg) {
    return (
      <div
        className={`rounded-full overflow-hidden bg-surface-container-high ring-1 ring-outline-variant/25 shadow-sm ${dim} ${className}`}
      >
        <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setBroken(true)} />
      </div>
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br from-primary/12 via-secondary-container/30 to-primary/8 text-primary flex items-center justify-center ring-1 ring-outline-variant/20 shadow-sm ${dim} ${className}`}
      title={alt || undefined}
      aria-hidden={!alt}
    >
      <span
        className={`material-symbols-outlined leading-none select-none ${ic}`}
        style={{ fontVariationSettings: "'FILL' 0, 'wght' 500" }}
      >
        person
      </span>
    </div>
  );
}
