import { useState } from "react";

const wrapClass = {
  sm: "h-12 w-12 min-h-12 min-w-12 rounded-xl p-1.5",
  md: "h-16 w-16 min-h-16 min-w-16 rounded-2xl p-2",
};

const iconSz = {
  sm: "text-2xl",
  md: "text-3xl",
};

/**
 * Product thumbnail when `src` loads; otherwise a packaged-inventory icon (no bitmap placeholder).
 */
export function ItemThumbOrIcon({ src, name = "Item", size = "sm", className = "" }) {
  const [broken, setBroken] = useState(false);
  const dim = wrapClass[size] ?? wrapClass.sm;
  const iz = iconSz[size] ?? iconSz.sm;
  const normalizedSrc = String(src || "").trim();
  const looksLikeUrl =
    normalizedSrc.length > 0 &&
    !/^(null|undefined)$/i.test(normalizedSrc) &&
    /^(https?:\/\/|\/|data:image\/|blob:)/i.test(normalizedSrc);
  const showImg = looksLikeUrl && !broken;

  if (showImg) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden bg-surface-container-high ${dim} ${className}`}
      >
        <img
          src={src}
          alt={name}
          className="max-h-full max-w-full object-contain"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-surface-container-high to-primary/8 text-primary/60 ${dim} ${className}`}
      aria-hidden
    >
      <span
        className={`material-symbols-outlined leading-none ${iz}`}
        style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
      >
        inventory_2
      </span>
    </div>
  );
}
