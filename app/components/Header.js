'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';

export default function Header({ title, children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <>
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <header className="header-bar">
                <div className="header-left">
                    <button
                        className="hamburger"
                        onClick={() => setIsSidebarOpen(true)}
                        aria-label="Open navigation menu"
                    >
                        ☰
                    </button>
                    <span className="header-title" style={{ fontSize: 'inherit' }}>{title}</span>
                </div>
                {children && (
                    <div className="header-filters" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {children}
                    </div>
                )}
            </header>
        </>
    );
}
