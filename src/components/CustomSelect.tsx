import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

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
  label?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '-- Pilih --',
  className = '',
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Normalize options
  const normalizedOptions: SelectOption[] = options.map((opt) => 
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && <label className="text-[#5c3c26] font-semibold mb-1 block text-xs">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-white text-[#3d2617] rounded-xl border border-[#ddc3aa] text-xs font-semibold flex items-center justify-between hover:border-[#96633b] focus:border-[#96633b] focus:ring-2 focus:ring-[#96633b]/20 transition-all shadow-2xs text-left"
      >
        <span className={selectedOption ? 'text-[#3d2617] font-bold truncate' : 'text-[#a08573] truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#8a6b53] shrink-0 ml-1.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#7c4e2f]' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#eed7c4] rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto p-1.5 space-y-0.5 animate-fadeIn">
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs cursor-pointer flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-[#faebd7] text-[#7c4e2f] font-black'
                    : 'text-[#3d2617] font-semibold hover:bg-[#fcf5ed] hover:text-[#7c4e2f]'
                }`}
              >
                <div>
                  <div>{opt.label}</div>
                  {opt.sublabel && <div className="text-[10px] text-[#8a6b53]">{opt.sublabel}</div>}
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#7c4e2f] shrink-0 ml-1" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
