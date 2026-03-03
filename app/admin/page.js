'use client';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
    const { data: session, status } = useSession();
    const [users, setUsers] = useState([]);
    const [featureSettings, setFeatureSettings] = useState({});
    const [activeTab, setActiveTab] = useState('users'); // 'users' or 'features'
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (status === "unauthenticated" || (session && session.user.role !== 'admin')) {
            router.push('/');
        } else if (status === "authenticated") {
            fetchData();
        }
    }, [status, session, router]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [uRes, fRes] = await Promise.all([
                fetch('/api/admin/users'),
                fetch('/api/admin/features')
            ]);
            const [uData, fData] = await Promise.all([uRes.json(), fRes.json()]);
            setUsers(uData);
            setFeatureSettings(fData);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (email, approved) => {
        try {
            await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, approved }),
            });
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleRoleChange = async (email, role) => {
        try {
            await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, role }),
            });
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (email) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
        try {
            await fetch('/api/admin/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleFeatureToggle = async (feature, role) => {
        const currentRoles = featureSettings[feature] || [];
        const newRoles = currentRoles.includes(role)
            ? currentRoles.filter(r => r !== role)
            : [...currentRoles, role];

        const newSettings = { ...featureSettings, [feature]: newRoles };
        setFeatureSettings(newSettings);

        try {
            await fetch('/api/admin/features', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings),
            });
        } catch (e) {
            console.error(e);
        }
    };

    if (status === "loading" || isLoading) return <div className="admin-loading">Loading Management...</div>;

    return (
        <div className="admin-container">
            <h1 className="admin-title">Administration</h1>
            <p className="admin-subtitle">Manage users and feature visibility.</p>

            <div className="admin-tabs">
                <button
                    className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    Users
                </button>
                <button
                    className={`tab-btn ${activeTab === 'features' ? 'active' : ''}`}
                    onClick={() => setActiveTab('features')}
                >
                    Feature Visibility
                </button>
            </div>

            {activeTab === 'users' ? (
                <div className="users-table-container">
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Provider</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.email}>
                                    <td>
                                        <div className="user-info">
                                            <div className="user-name">{user.name}</div>
                                            <div className="user-email">{user.email}</div>
                                        </div>
                                    </td>
                                    <td><span className={`provider-badge ${user.provider}`}>{user.provider}</span></td>
                                    <td>
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleRoleChange(user.email, e.target.value)}
                                            className="role-select"
                                        >
                                            <option value="guest">Guest</option>
                                            <option value="member">Member</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${user.approved ? 'approved' : 'pending'}`}>
                                            {user.approved ? 'Approved' : 'Pending'}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => handleApprove(user.email, !user.approved)}
                                            className={`approve-btn ${user.approved ? 'revoke' : 'approve'}`}
                                            disabled={user.email === session?.user?.email}
                                        >
                                            {user.approved ? 'Revoke' : 'Approve'}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user.email)}
                                            className="approve-btn delete ml-2"
                                            disabled={user.email === session?.user?.email}
                                            style={{ marginLeft: '10px' }}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="features-container">
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Feature</th>
                                <th>Guest</th>
                                <th>Member</th>
                                <th>Admin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(featureSettings).map(([feature, allowedRoles]) => (
                                <tr key={feature}>
                                    <td className="feature-name">{feature}</td>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={allowedRoles.includes('guest')}
                                            onChange={() => handleFeatureToggle(feature, 'guest')}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={allowedRoles.includes('member')}
                                            onChange={() => handleFeatureToggle(feature, 'member')}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={true}
                                            disabled={true}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <style jsx>{`
                .admin-container {
                    padding: 40px;
                    background: #050505;
                    min-height: 100vh;
                    color: #fff;
                }
                .admin-title {
                    font-size: 32px;
                    color: #00ff7f;
                    margin-bottom: 10px;
                }
                .admin-subtitle {
                    color: #888;
                    margin-bottom: 30px;
                }
                .admin-tabs {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 25px;
                }
                .tab-btn {
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.03);
                    color: #888;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .tab-btn.active {
                    background: rgba(0, 255, 127, 0.1);
                    color: #00ff7f;
                    border-color: #00ff7f;
                }
                .users-table-container, .features-container {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    overflow: hidden;
                }
                .users-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }
                .users-table th {
                    padding: 15px 20px;
                    background: rgba(255, 255, 255, 0.05);
                    color: #00ff7f;
                    font-weight: 600;
                    font-size: 14px;
                    text-transform: uppercase;
                }
                .users-table td {
                    padding: 15px 20px;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                }
                .user-info {
                    display: flex;
                    flex-direction: column;
                }
                .user-name {
                    font-weight: 600;
                }
                .user-email {
                    font-size: 12px;
                    color: #888;
                }
                .provider-badge {
                    font-size: 12px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    background: #222;
                    text-transform: capitalize;
                }
                .status-badge {
                    font-size: 12px;
                    padding: 4px 8px;
                    border-radius: 4px;
                }
                .status-badge.approved { background: rgba(0, 255, 127, 0.1); color: #00ff7f; }
                .status-badge.pending { background: rgba(255, 165, 0, 0.1); color: #ffa500; }
                
                .role-select {
                    background: #111;
                    color: #fff;
                    border: 1px solid #333;
                    padding: 6px;
                    border-radius: 4px;
                    outline: none;
                }
                .feature-name {
                    font-weight: 600;
                }
                input[type="checkbox"] {
                    accent-color: #00ff7f;
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                }
                .approve-btn {
                    padding: 6px 12px;
                    border-radius: 6px;
                    border: none;
                    font-weight: 600;
                    cursor: pointer;
                    transition: opacity 0.2s;
                }
                .approve-btn.approve { background: #00ff7f; color: #000; }
                .approve-btn.revoke { background: #ff4444; color: #fff; }
                .approve-btn.delete { background: #ff3333; color: #fff; }
                .approve-btn.delete:hover { background: #cc0000; }
                .approve-btn:hover { opacity: 0.8; }
                
                .admin-loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    background: #050505;
                    color: #00ff7f;
                    font-size: 18px;
                }
            `}</style>
        </div>
    );
}
