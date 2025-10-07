'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  /** All known provider names (deduped & sorted on the server) */
  options: string[];
  /** Initial value from searchParams.q (if any) */
  defaultValue?: string;
  /** Name for the form field */
  name?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Label id for aria-labelledby */
  labelId?: string;
};

export default function ProviderAutocomplete({
  options,
  defaultValue = '',
  name = 'q',
  placeholder = 'Start typing (e.g., S…)',
  labelId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(defaultValue);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = 'provider-combobox-list';

  

  // helper
function matchesQueryWordStart(label: string, q: string) {
  const hay = label.toLowerCase();
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  // word-start match: any word begins with the query
  if (hay.split(/\s+/).some(w => w.startsWith(needle))) return true;
  // fallback: substring anywhere
  return hay.includes(needle);
}

const filtered = useMemo(() => {
  const q = query.trim().toLowerCase();
  const list = q
    ? options.filter(o => matchesQueryWordStart(o, q))
    : options;
  return list.slice(0, 8);
}, [options, query]);


  // Close on outside click / ESC
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Keyboard interaction within the list
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (filtered[active]) {
        e.preventDefault();
        setQuery(filtered[active]);
        setOpen(false);
        // keep focus so the form can submit with Enter again
        inputRef.current?.focus();
      }
    }
  }

  

  return (
    <div
      ref={rootRef}
      className="relative"
      role="combobox"
      aria-haspopup="listbox"
      aria-owns={listId}
      aria-expanded={open}
      aria-labelledby={labelId}
    >
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={query} />

      {/* Visible control */}
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="
            input h-11 w-full pr-10
            bg-white rounded-xl border border-gray-300
            focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
          "
        />
        {/* search icon */}
        <svg
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M21 21l-4.3-4.3" />
          <circle cx="11" cy="11" r="7" />
        </svg>
      </div>

      {/* Dropdown */}
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="
            absolute z-50 mt-2 w-full max-h-64 overflow-auto
            rounded-xl border border-gray-200 bg-white shadow-xl
          "
        >
          {filtered.length === 0 ? (
            <li
              className="px-3 py-2 text-sm text-gray-500"
              aria-disabled="true"
            >
              No matches
            </li>
          ) : (
            filtered.map((opt, i) => {
              const isActive = i === active;
              return (
                <li
                  key={opt}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    // prevent input blur before we set value
                    e.preventDefault();
                    setQuery(opt);
                    setOpen(false);
                    inputRef.current?.focus();
                  }}
                  className={`
                    cursor-pointer px-3 py-2 text-sm
                    ${isActive ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50'}
                  `}
                >
                  {opt}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
