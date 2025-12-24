'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const navItems = [
    { href: '/', label: 'Daily Tracking', icon: '📊' },
    { href: '/company-research', label: 'Company Research', icon: '🏢' },
    { href: '/macro-research', label: 'Macro Research', icon: '🌍' },
    { href: '/strategy-research', label: 'Strategy Research', icon: '📈' },
];

export default function Sidebar({ isOpen, onClose }) {
    const pathname = usePathname();

    return (
        <>
            {/* Backdrop */}
            <div
                className={`sidebar-backdrop ${isOpen ? 'open' : ''}`}
                onClick={onClose}
            />

            {/* Sidebar */}
            <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <span className="sidebar-title">Investment Tracker</span>
                    <button className="sidebar-close" onClick={onClose}>×</button>
                </div>

                <ul className="sidebar-nav">
                    {navItems.map((item) => (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                                onClick={onClose}
                            >
                                <span className="sidebar-icon">{item.icon}</span>
                                <span className="sidebar-label">{item.label}</span>
                            </Link>
                        </li>
                    ))}
                </ul>

                <div className="sidebar-footer">
                    <span className="sidebar-version">v1.0</span>
                </div>
            </nav>
        </>
    );
}
