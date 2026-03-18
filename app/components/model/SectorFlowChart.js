'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

export default function SectorFlowChart({ features = {} }) {
    if (!features || Object.keys(features).length === 0) {
        return (
            <div className="card daily-card p-6 flex flex-col items-center justify-center text-gray-500 text-sm italic min-h-[320px]">
                <div className="w-8 h-8 rounded-full border-2 border-gray-800 border-t-gray-600 animate-spin mb-3"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-700">Calibrating Sector Flows...</p>
            </div>
        );
    }

    // Extract sector flow Z-scores
    const sectorData = [
        { name: 'Banks', flow: features.Sector_Banks_Flow_Z },
        { name: 'Real Estate', flow: features.Sector_RealEstate_Flow_Z },
        { name: 'Financials', flow: features.Sector_Financials_Flow_Z },
        { name: 'Resources', flow: features.Sector_Resources_Flow_Z },
        { name: 'VinGroup', flow: features.Sector_VinGroup_Flow_Z },
        { name: 'Others', flow: features.Sector_Other_Flow_Z }
    ].filter(s => s.flow !== undefined && s.flow !== null);

    if (sectorData.length === 0) {
        return (
            <div className="card daily-card p-6 flex items-center justify-center text-gray-500 text-sm italic">
                No sector flow data available for this report.
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded-lg shadow-xl">
                    <p className="text-white font-bold mb-1">{data.name}</p>
                    <p className="text-xs text-gray-400">
                        Money Flow Z-Score: <span className={data.flow >= 0 ? 'text-[#00ff7f]' : 'text-[#ff4444]'}>
                            {data.flow.toFixed(2)}
                        </span>
                    </p>
                    <div className="mt-2 text-[10px] text-gray-500 leading-tight border-t border-[#222] pt-2">
                        {data.flow > 1.5 ? 'Significant Inflow' :
                            data.flow < -1.5 ? 'Significant Outflow' :
                                'Normal Activity'}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="card daily-card" style={{ height: '320px', display: 'flex', flexDirection: 'column' }}>
            <div className="daily-card-header flex justify-between items-center">
                <h3 className="daily-card-title flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                    Capital Flow by Sector (Z-Score)
                </h3>
            </div>

            <div style={{ flex: 1, width: '100%', padding: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={sectorData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                        <XAxis
                            type="number"
                            domain={[-3, 3]}
                            stroke="#555"
                            fontSize={10}
                            tickCount={7}
                        />
                        <YAxis
                            dataKey="name"
                            type="category"
                            stroke="#888"
                            fontSize={10}
                            width={80}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <ReferenceLine x={0} stroke="#444" strokeWidth={2} />
                        <Bar
                            dataKey="flow"
                            radius={[0, 4, 4, 0]}
                            barSize={20}
                        >
                            {sectorData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.flow >= 0 ? '#00ff7f' : '#ff4444'}
                                    fillOpacity={0.8}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="px-4 pb-3 flex justify-between text-[10px] text-gray-500 font-medium">
                <span>◀ Intense Outflow</span>
                <span>Intense Inflow ▶</span>
            </div>
        </div>
    );
}
