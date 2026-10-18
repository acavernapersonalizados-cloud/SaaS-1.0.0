import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Classes do contêiner (largura). */
  className?: string;
}

/** Campo de busca com lupa das telas de cadastro. */
export function SearchBar({ value, onChange, placeholder, className = 'relative max-w-md' }: SearchBarProps) {
  return (
    <div className={className}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all outline-none"
      />
    </div>
  );
}
