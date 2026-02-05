'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function MultiSelect({ options, value, onChange, placeholder = "Select..." }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        if (value.includes(option)) {
            onChange(value.filter(v => v !== option));
        } else {
            onChange([...value, option]);
        }
    };

    const removeValue = (e, opt) => {
        e.stopPropagation();
        onChange(value.filter(v => v !== opt));
    };

    return (
        <div className="relative w-full font-sans" ref={containerRef}>
            <div
                className="bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.18)] rounded flex flex-wrap gap-2 items-center hover:border-[rgba(255,255,255,0.3)] transition-colors min-h-[38px] px-2 py-1 cursor-text"
                onClick={() => setIsOpen(!isOpen)}
            >
                {value.length === 0 && <span className="text-[#888] text-[11px] ml-1">{placeholder}</span>}

                {value.map(opt => (
                    <span key={opt} className="bg-[#ff4b4b] text-white text-[10px] font-semibold px-2 py-0.5 rounded-sm flex items-center gap-1 shadow-sm">
                        {opt}
                        <button
                            onClick={(e) => removeValue(e, opt)}
                            className="hover:text-black hover:bg-white/50 rounded-full w-3 h-3 flex items-center justify-center transition-colors text-[9px] leading-none"
                        >
                            ×
                        </button>
                    </span>
                ))}

                <div className="flex-1 min-w-[10px]"></div>

                <div className="text-[#888] pr-1 flex items-center">
                    {/* Explicit pixel width/height to prevent huge scaling if global CSS interferes */}
                    <svg style={{ width: '12px', height: '12px' }} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-[#1e1e1e] border border-[rgba(255,255,255,0.1)] rounded shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                    {options.map(opt => (
                        <div
                            key={opt}
                            onClick={() => handleSelect(opt)}
                            className={`px-3 py-2 text-[11px] cursor-pointer flex items-center justify-between border-b border-[rgba(255,255,255,0.03)] last:border-0 hover:bg-[rgba(255,255,255,0.05)] ${value.includes(opt) ? 'text-[#00ff7f]' : 'text-[#ccc]'}`}
                        >
                            {opt}
                            {value.includes(opt) && <span>✓</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
