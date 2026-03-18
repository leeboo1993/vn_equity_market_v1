'use client';

import React from 'react';

export default function ModelCalendarFilter({ selectedDate, onDateChange, availableDates = [] }) {
    // Current date for max limit
    const today = new Date().toISOString().split('T')[0];

    // Format the display date
    const displayDate = selectedDate ? new Date(selectedDate).toLocaleDateString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric'
    }) : 'Latest Report';

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: '#111',
                padding: '0.4rem 0.5rem 0.4rem 1rem',
                borderRadius: '0.75rem',
                border: '1px solid #222',
                whiteSpace: 'nowrap',
                flexWrap: 'nowrap',
                minWidth: 'fit-content'
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span style={{ fontSize: '10px', fontWeight: '900', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    History
                </span>
            </div>

            <div style={{ width: '1px', height: '1.25rem', backgroundColor: '#222', margin: '0 0.25rem' }}></div>

            <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1a1a1a', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', border: '1px solid transparent' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
                        {displayDate}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="3">
                        <path d="M6 9l6 6 6-6"></path>
                    </svg>
                </div>

                <input
                    type="date"
                    value={selectedDate || ''}
                    max={today}
                    onChange={(e) => {
                        console.log("Input Date Changed:", e.target.value);
                        onDateChange(e.target.value);
                    }}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: 'pointer',
                        width: '100%',
                        height: '100%'
                    }}
                    title="Select report date"
                />
            </div>

            {selectedDate && (
                <button
                    onClick={() => {
                        console.log("Resetting Date");
                        onDateChange('');
                    }}
                    style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#ff4444',
                        cursor: 'pointer',
                        padding: '0 0.5rem',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                    title="Reset to Latest"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            )}
        </div>
    );
}
