'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

const navItems = [
    { href: '/', label: 'Daily Tracking' },
    { href: '/company-research', label: 'Company Research' },
    { href: '/macro-research', label: 'Macro Research' },
    { href: '/strategy-research', label: 'Strategy Research' },
];

export default function Sidebar({ isOpen, onClose }) {
    const pathname = usePathname();
    const { data: session } = useSession();

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
                    <span className="sidebar-title">Vietnamese Equity Market</span>
                    <button className="sidebar-close" onClick={onClose}>×</button>
                </div>

                {session?.user && (
                    <div className="sidebar-account-info">
                        <div className="sidebar-user-avatar">
                            {session.user.image ? (
                                <img src={session.user.image} alt={session.user.name} />
                            ) : (
                                <div className="avatar-placeholder">
                                    {(session.user.name || session.user.email)[0].toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="sidebar-user-details">
                            <span className="sidebar-user-name">{session.user.name || session.user.email?.split('@')[0]}</span>
                            <span className="sidebar-user-email">{session.user.email}</span>
                        </div>
                        <button
                            className="sidebar-logout-icon-btn"
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            title="Log Out"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                )}

                <ul className="sidebar-nav">
                    {navItems
                        .filter(item => {
                            // Hide Macro Research for non-admin users
                            if (item.href === '/macro-research' && session?.user?.role !== 'admin') {
                                return false;
                            }
                            return true;
                        })
                        .map((item) => (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                                    onClick={onClose}
                                >
                                    <span className="sidebar-label">{item.label}</span>
                                </Link>
                            </li>
                        ))}

                    {session?.user?.role === 'admin' && (
                        <>
                            <div className="sidebar-divider">Administration</div>
                            <li>
                                <Link
                                    href="/admin"
                                    className={`sidebar-link admin ${pathname === '/admin' ? 'active' : ''}`}
                                    onClick={onClose}
                                >
                                    <span className="sidebar-label">User Management</span>
                                </Link>
                            </li>
                        </>
                    )}
                </ul>

                <div className="sidebar-footer">
                    <span className="sidebar-version">v1.3</span>
                </div>
            </nav>
        </>
    );
}
