'use client';

import React from 'react';

export default function ModelDateFilter({ availableDates = [], selectedDate, onDateChange }) {
    if (!availableDates || availableDates.length === 0) return null;

    return (
        <div className="flex items-center gap-3 bg-[#111] p-1 rounded-lg border border-[#222]">
            <span className="text-xs font-bold text-gray-500 uppercase pl-3">History</span>
            <select
                value={selectedDate || ''}
                onChange={(e) => onDateChange(e.target.value)}
                className="bg-[#1a1a1a] text-white border-0 text-sm font-bold py-2 px-4 rounded focus:ring-1 focus:ring-blue-500 cursor-pointer outline-none hover:bg-[#222] transition-colors"
                style={{ appearance: 'none', paddingRight: '2rem', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23AAA%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto' }}
            >
                <option value="">Latest Report</option>
                {availableDates.map((date) => (
                    <option key={date} value={date}>
                        {new Date(date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </option>
                ))}
            </select>
        </div>
    );
}
