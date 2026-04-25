import { useEffect, useMemo, useRef, useState } from "react";

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightMatch({ text, query }) {
  if (!query) return text;
  const pattern = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const parts = String(text).split(pattern);
  return parts.map((part, idx) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${part}-${idx}`} className="bg-primary-fixed text-on-primary-fixed rounded px-0.5">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${idx}`}>{part}</span>
    )
  );
}

/**
 * @param {{
 *  options: Array<{sku: string, name: string}>,
 *  value: string,
 *  onChange: (value: string) => void,
 *  onSelect: (option: {sku: string, name: string} | null) => void,
 *  placeholder?: string,
 *  inputClassName?: string,
 *  showExactMatchHint?: boolean
 * }} props
 */
export function SkuAutocompleteInput({
  options,
  value,
  onChange,
  onSelect,
  placeholder = "Search SKU...",
  inputClassName = "",
  showExactMatchHint = true,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return options.slice(0, 8);
    return options
      .filter((opt) => opt.sku.toLowerCase().includes(q) || (opt.name || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [options, q]);

  const exact = useMemo(
    () => options.find((opt) => opt.sku.toLowerCase() === q || (opt.name || "").toLowerCase() === q) || null,
    [options, q]
  );

  const showNotFound = open && q.length > 0 && filtered.length === 0;

  return (
    <div className="relative" ref={rootRef}>
      <input
        className={inputClassName}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next);
          const nextQ = next.trim().toLowerCase();
          const matched = options.find((opt) => opt.sku.toLowerCase() === nextQ) || null;
          onSelect(matched);
          setOpen(true);
        }}
        placeholder={placeholder}
        type="text"
        autoComplete="off"
      />

      <div
        className={`absolute z-20 mt-2 w-full origin-top rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-xl transition-all duration-150 ${
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        {filtered.length > 0 ? (
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.map((opt) => (
              <li key={opt.sku}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-surface-container-high transition-colors"
                  onClick={() => {
                    onChange(opt.sku);
                    onSelect(opt);
                    setOpen(false);
                  }}
                >
                  <p className="text-sm font-semibold text-on-surface">
                    <HighlightMatch text={opt.sku} query={value.trim()} />
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    <HighlightMatch text={opt.name || "Unnamed item"} query={value.trim()} />
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {showNotFound ? (
          <div className="px-3 py-2 text-xs text-on-surface-variant border-t border-outline-variant/10">
            SKU not found. Add as new item?
          </div>
        ) : null}
      </div>
      {showExactMatchHint && exact ? (
        <p className="mt-1 text-[11px] text-primary font-medium">Matched existing SKU.</p>
      ) : null}
    </div>
  );
}

