'use client';

import { useState, useEffect } from 'react';

export default function IndexManagement() {
    const [indices, setIndices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchIndices();
    }, []);

    const fetchIndices = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/config/indices');
            const data = await res.json();
            setIndices(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = () => {
        const newIndex = {
            id: 'NEW_' + Date.now(),
            name: 'New Index',
            region: 'Global',
            source: 'yahoo',
            yfId: '',
            proxyId: ''
        };
        setIndices([...indices, newIndex]);
    };

    const handleRemove = (id) => {
        setIndices(indices.filter(i => i.id !== id));
    };

    const handleChange = (id, field, value) => {
        setIndices(indices.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage('');
        try {
            const res = await fetch('/api/admin/config/indices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(indices)
            });
            if (res.ok) {
                setMessage('Configuration saved successfully!');
            } else {
                setMessage('Error saving configuration.');
            }
        } catch (e) {
            setMessage('Error: ' + e.message);
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    if (isLoading) return <div className="p-4">Loading Indices...</div>;

    return (
        <div className="index-management p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-accent">Market Indices Configuration</h2>
                <div className="flex gap-4">
                    <button onClick={handleAdd} className="btn-secondary">Add Index</button>
                    <button onClick={handleSave} disabled={isSaving} className="btn-primary">
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {message && <div className={`p-3 mb-4 rounded ${message.includes('Error') ? 'bg-red-900/20 text-red-500' : 'bg-green-900/20 text-green-500'}`}>{message}</div>}

            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-white/5 text-accent uppercase text-xs font-bold">
                            <th className="p-4">ID</th>
                            <th className="p-4">Name</th>
                            <th className="p-4">Region</th>
                            <th className="p-4">Source</th>
                            <th className="p-4">API IDs</th>
                            <th className="p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {indices.map(idx => (
                            <tr key={idx.id}>
                                <td className="p-4">
                                    <input
                                        type="text"
                                        value={idx.id}
                                        onChange={(e) => handleChange(idx.id, 'id', e.target.value)}
                                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-sm w-32"
                                    />
                                </td>
                                <td className="p-4">
                                    <input
                                        type="text"
                                        value={idx.name}
                                        onChange={(e) => handleChange(idx.id, 'name', e.target.value)}
                                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-sm w-full font-bold"
                                    />
                                </td>
                                <td className="p-4">
                                    <input
                                        type="text"
                                        value={idx.region}
                                        onChange={(e) => handleChange(idx.id, 'region', e.target.value)}
                                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-sm w-32"
                                    />
                                </td>
                                <td className="p-4">
                                    <select
                                        value={idx.source}
                                        onChange={(e) => handleChange(idx.id, 'source', e.target.value)}
                                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-sm"
                                    >
                                        <option value="ssi">SSI (Vietnam)</option>
                                        <option value="yahoo">Yahoo (Global)</option>
                                    </select>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col gap-1">
                                        {idx.source === 'ssi' ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-500 w-16">SSI ID:</span>
                                                    <input
                                                        type="text"
                                                        placeholder="VNINDEX"
                                                        value={idx.ssiId || ''}
                                                        onChange={(e) => handleChange(idx.id, 'ssiId', e.target.value)}
                                                        className="bg-black/40 border border-white/10 rounded px-2 py-0.5 text-xs flex-1"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-500 w-16">VND ID:</span>
                                                    <input
                                                        type="text"
                                                        placeholder="VNINDEX"
                                                        value={idx.vnDirectId || ''}
                                                        onChange={(e) => handleChange(idx.id, 'vnDirectId', e.target.value)}
                                                        className="bg-black/40 border border-white/10 rounded px-2 py-0.5 text-xs flex-1"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-500 w-16">Yahoo ID:</span>
                                                    <input
                                                        type="text"
                                                        placeholder="^GSPC"
                                                        value={idx.yfId || ''}
                                                        onChange={(e) => handleChange(idx.id, 'yfId', e.target.value)}
                                                        className="bg-black/40 border border-white/10 rounded px-2 py-0.5 text-xs flex-1"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-500 w-16">Proxy ID:</span>
                                                    <input
                                                        type="text"
                                                        placeholder="SPY (for PE/PB)"
                                                        value={idx.proxyId || ''}
                                                        onChange={(e) => handleChange(idx.id, 'proxyId', e.target.value)}
                                                        className="bg-black/40 border border-white/10 rounded px-2 py-0.5 text-xs flex-1"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <button onClick={() => handleRemove(idx.id)} className="text-red-500 hover:text-red-400 text-xs font-bold">Remove</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <style jsx>{`
                .text-accent { color: #00ff7f; }
                .btn-primary {
                    background: #00ff7f;
                    color: #000;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }
                .btn-primary:hover:not(:disabled) { background: #00cc66; transform: translateY(-1px); }
                .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
                
                .btn-secondary {
                    background: rgba(255, 255, 255, 0.05);
                    color: #fff;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); border-color: #00ff7f; }

                .divide-y > * + * { border-top-width: 1px; }
            `}</style>
        </div>
    );
}
