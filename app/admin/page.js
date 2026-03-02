'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [features, setFeatures] = useState({});
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated' || (session && session.user.role !== 'admin')) {
            router.push('/');
        } else if (status === 'authenticated') {
            fetchData();
        }
    }, [status, session]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [uRes, fRes] = await Promise.all([
                fetch('/api/admin/users'),
                fetch('/api/admin/features')
            ]);
            if (uRes.ok) setUsers(await uRes.json());
            if (fRes.ok) setFeatures(await fRes.json());
        } catch (e) {
            setMessage('Error fetching data');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUser = async (email, updates) => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, ...updates })
            });
            if (res.ok) {
                setMessage('User updated');
                fetchData();
            }
        } catch (e) { setMessage('Failed to update'); }
    };

    const handleDeleteUser = async (email) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            const res = await fetch('/api/admin/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            if (res.ok) {
                setMessage('User deleted');
                fetchData();
            }
        } catch (e) { setMessage('Failed to delete'); }
    };

    const handleToggleFeature = async (feature, role) => {
        const newFeatures = { ...features };
        const roles = newFeatures[feature] || [];
        if (roles.includes(role)) {
            newFeatures[feature] = roles.filter(r => r !== role);
        } else {
            newFeatures[feature] = [...roles, role];
        }

        setFeatures(newFeatures);
        try {
            const res = await fetch('/api/admin/features', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newFeatures)
            });
            if (res.ok) setMessage('Settings saved');
        } catch (e) { setMessage('Failed to save'); fetchData(); }
    };

    if (status === 'loading' || loading) return <div className="admin-loading">Loading Admin Dashboard...</div>;

    return (
        <div className="admin-container">
            <header className="admin-header">
                <h1>Admin Command Center</h1>
                <div className="tabs">
                    <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>Users</button>
                    <button className={activeTab === 'features' ? 'active' : ''} onClick={() => setActiveTab('features')}>Feature Permissions</button>
                </div>
            </header>

            {message && <div className="toast" onClick={() => setMessage('')}>{message}</div>}

            <main className="admin-content">
                {activeTab === 'users' ? (
                    <div className="users-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Status</th>
                                    <th>Role</th>
                                    <th>Joined</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1)).map(u => (
                                    <tr key={u.email} className={!u.approved ? 'pending' : ''}>
                                        <td>
                                            <div className="user-info">
                                                <span className="email">{u.email}</span>
                                                <span className="provider">{u.provider}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${u.approved ? 'approved' : 'pending'}`}>
                                                {u.approved ? 'Approved' : 'Pending'}
                                            </span>
                                        </td>
                                        <td>
                                            <select
                                                value={u.role}
                                                onChange={(e) => handleUpdateUser(u.email, { role: e.target.value })}
                                                className="role-select"
                                            >
                                                <option value="member">Member</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                        <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                                        <td className="actions">
                                            {!u.approved && (
                                                <button className="approve-btn" onClick={() => handleUpdateUser(u.email, { approved: true })}>Approve</button>
                                            )}
                                            {u.approved && u.role !== 'admin' && (
                                                <button className="reject-btn" onClick={() => handleUpdateUser(u.email, { approved: false })}>Revoke</button>
                                            )}
                                            <button className="delete-btn" onClick={() => handleDeleteUser(u.email)}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="features-container">
                        <p className="hint">Toggle which roles can access specific sections of the website.</p>
                        <div className="feature-grid">
                            {Object.keys(features).map(f => (
                                <div key={f} className="feature-card">
                                    <h3>{f}</h3>
                                    <div className="role-toggles">
                                        {['admin', 'member', 'guest'].map(role => (
                                            <label key={role} className="toggle-label">
                                                <input
                                                    type="checkbox"
                                                    checked={features[f]?.includes(role) || role === 'admin'}
                                                    disabled={role === 'admin'}
                                                    onChange={() => handleToggleFeature(f, role)}
                                                />
                                                <span className="capitalize">{role}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <style jsx>{`
                .admin-container {
                    padding: 2rem;
                    min-height: 100vh;
                    background: #050505;
                    color: #eee;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                .admin-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    border-bottom: 1px solid #222;
                    padding-bottom: 1rem;
                }
                .admin-header h1 {
                    font-size: 1.5rem;
                    background: linear-gradient(to right, #00ff7f, #00d2ff);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .tabs {
                    display: flex;
                    gap: 0.5rem;
                    background: rgba(255,255,255,0.05);
                    padding: 0.3rem;
                    border-radius: 8px;
                }
                .tabs button {
                    background: transparent;
                    border: none;
                    color: #888;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                }
                .tabs button.active {
                    background: #222;
                    color: #00ff7f;
                }
                .toast {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
                    background: #00ff7f;
                    color: #000;
                    padding: 0.8rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 600;
                    box-shadow: 0 4px 20px rgba(0,255,127,0.3);
                    cursor: pointer;
                }
                .admin-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: rgba(255,255,255,0.02);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .admin-table th {
                    text-align: left;
                    padding: 1rem;
                    background: rgba(255,255,255,0.05);
                    color: #666;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                }
                .admin-table td {
                    padding: 1rem;
                    border-bottom: 1px solid #111;
                }
                .pending {
                    background: rgba(255, 165, 0, 0.05);
                }
                .user-info {
                    display: flex;
                    flex-direction: column;
                }
                .email { font-weight: 500; }
                .provider { font-size: 0.7rem; color: #555; text-transform: uppercase; }
                .badge {
                    padding: 0.2rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    font-weight: 700;
                }
                .badge.approved { background: rgba(0,255,127,0.1); color: #00ff7f; }
                .badge.pending { background: rgba(255,165,0,0.1); color: #ffa500; }
                .role-select {
                    background: #111;
                    border: 1px solid #333;
                    color: #eee;
                    padding: 0.3rem;
                    border-radius: 4px;
                }
                .actions {
                    display: flex;
                    gap: 0.5rem;
                }
                .approve-btn { background: #00ff7f; color: #000; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-weight: 600; }
                .reject-btn { background: transparent; border: 1px solid #ff4444; color: #ff4444; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; }
                .delete-btn { background: transparent; border: none; color: #555; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.8rem; }
                .delete-btn:hover { color: #ff4444; }

                .features-container .hint { margin-bottom: 2rem; color: #888; }
                .feature-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1.5rem;
                }
                .feature-card {
                    background: rgba(255,255,255,0.02);
                    border: 1px solid #1a1a1a;
                    padding: 1.5rem;
                    border-radius: 12px;
                }
                .feature-card h3 { margin-bottom: 1rem; font-size: 1.1rem; color: #00ff7f; }
                .role-toggles { display: flex; flex-direction: column; gap: 0.8rem; }
                .toggle-label {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    cursor: pointer;
                }
                .toggle-label input { width: 1.2rem; height: 1.2rem; }
                .capitalize { text-transform: capitalize; }
                .admin-loading { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #050505; color: #00ff7f; font-weight: 600; }
            `}</style>
        </div>
    );
}
