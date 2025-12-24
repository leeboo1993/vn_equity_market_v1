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
                    <span className="header-title">{title}</span>
                </div>
                <div className="header-filters">
                    {children}
                </div>
            </header>
        </>
    );
}
