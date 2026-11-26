import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
  sublabel?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  label?: string;
  title?: string;
  variant?: 'default' | 'emerald' | 'slate' | 'indigo';
  size?: 'sm' | 'md';
  searchable?: boolean;
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '-- Pilih --',
  className = '',
  buttonClassName = '',
  label,
  title,
  variant = 'default',
  size = 'md',
  searchable,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const normalizedOptions: SelectOption[] = useMemo(
    () =>
      options.map((opt) =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      ),
    [options]
  );

  const selectedOption = useMemo(
    () => normalizedOptions.find((o) => o.value === value),
    [normalizedOptions, value]
  );

  const isSearchEnabled = searchable ?? normalizedOptions.length > 8;

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchQuery]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const minWidth = Math.max(rect.width, 220);
    const maxWidth = Math.min(380, viewportW - 24);
    const computedWidth = Math.min(Math.max(rect.width, minWidth), maxWidth);

    let left = rect.left;
    if (left + computedWidth > viewportW - 12) {
      left = Math.max(12, viewportW - computedWidth - 12);
    }

    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < 260 && spaceAbove > spaceBelow;

    if (openUpward) {
      setMenuStyle({
        position: 'fixed',
        left,
        width: computedWidth,
        bottom: viewportH - rect.top + 6,
        maxHeight: Math.min(320, spaceAbove - 16),
        zIndex: 9999,
      });
    } else {
      setMenuStyle({
        position: 'fixed',
        left,
        width: computedWidth,
        top: rect.bottom + 6,
        maxHeight: Math.min(320, Math.max(180, spaceBelow - 16)),
        zIndex: 9999,
      });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }
    updatePosition();
    if (isSearchEnabled) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }

    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, isSearchEnabled, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const variantButtonClasses =
    variant === 'emerald'
      ? 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/20'
      : variant === 'slate'
        ? 'bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'
        : variant === 'indigo'
          ? 'bg-indigo-50/70 text-indigo-950 border-indigo-200 hover:border-indigo-400 focus:border-indigo-600 focus:ring-indigo-500/20'
          : 'bg-white text-[#3d2617] border-[#ddc3aa] hover:border-[#96633b] focus:border-[#96633b] focus:ring-[#96633b]/20';

  const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-xs';

  const activeOptionClasses =
    variant === 'emerald'
      ? 'bg-emerald-100/80 text-emerald-900 font-extrabold'
      : variant === 'slate' || variant === 'indigo'
        ? 'bg-indigo-50 text-indigo-800 font-extrabold'
        : 'bg-[#faebd7] text-[#7c4e2f] font-extrabold';

  const hoverOptionClasses =
    variant === 'emerald'
      ? 'text-stone-700 font-semibold hover:bg-emerald-50/80 hover:text-emerald-900'
      : variant === 'slate' || variant === 'indigo'
        ? 'text-slate-700 font-semibold hover:bg-slate-100 hover:text-slate-900'
        : 'text-[#3d2617] font-semibold hover:bg-[#fcf5ed] hover:text-[#7c4e2f]';

  return (
    <div className={`relative ${className}`}>
      {label && <label className="text-[#5c3c26] font-bold mb-1 block text-xs">{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        title={title || (selectedOption ? selectedOption.label : placeholder)}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full rounded-xl border font-bold flex items-center justify-between gap-2 focus:outline-none focus:ring-2 transition-all shadow-2xs text-left disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${variantButtonClasses} ${buttonClassName}`}
      >
        <span className={`truncate ${selectedOption ? '' : 'opacity-65 font-medium'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 opacity-75 transition-transform duration-200 ${
            isOpen ? 'rotate-180 opacity-100' : ''
          }`}
        />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="bg-white border border-[#e4d5c7] rounded-2xl shadow-[0_16px_42px_-6px_rgba(25,18,12,0.18)] flex flex-col overflow-hidden animate-fadeIn"
          >
            {isSearchEnabled && (
              <div className="p-2 border-b border-[#f0e4d7] bg-[#fcf9f5] shrink-0">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-[#8a6b53] absolute left-2.5 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari pilihan..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-[#dfcebe] rounded-xl text-xs font-semibold text-[#332219] placeholder:text-[#a08573] focus:outline-none focus:border-[#7c4e2f]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 p-0.5 rounded text-[#8a6b53] hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="overflow-y-auto p-1.5 space-y-0.5 flex-1 custom-scroll">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-[#8a6b53] font-medium">
                  Tidak ada pilihan yang cocok
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs cursor-pointer flex items-center justify-between gap-2 text-left transition-colors ${
                        isSelected ? activeOptionClasses : hoverOptionClasses
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{opt.label}</div>
                        {opt.sublabel && (
                          <div className="text-[10px] opacity-75 truncate mt-0.5">{opt.sublabel}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {opt.badge && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.75]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
