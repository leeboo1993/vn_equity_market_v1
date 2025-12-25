'use client';

import React from 'react';

// Helper function to format metric names
const formatMetricName = (key) => {
    // Remove _ratio, _vnd suffixes
    let name = key.replace(/_ratio$/, '').replace(/_vnd$/, '');

    // Special cases
    const specialCases = {
        'eps': 'EPS',
        'bvps': 'BVPS',
        'dps': 'DPS',
        'pe': 'P/E',
        'pb': 'P/B',
        'roe': 'ROE',
        'roa': 'ROA',
        'roaa': 'ROAA',
        'roae': 'ROAE',
        'ebit': 'EBIT',
        'ebitda': 'EBITDA',
        'npat': 'NPAT',
        'pbt': 'PBT',
        'cogs': 'COGS',
        'cfo': 'CFO',
        'cfi': 'CFI',
        'cff': 'CFF',
        'ev_ebitda': 'EV/EBITDA',
        'car': 'CAR',
        'npl': 'NPL',
        'nim': 'NIM',
        'casa': 'CASA',
        'cir': 'CIR',
        'ppop': 'PPOP',
        'fvtpl': 'FVTPL'
    };

    if (specialCases[name]) return specialCases[name];

    // Convert snake_case to Title Case
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// Helper function to format numbers
const formatNumber = (value, isRatio = false) => {
    if (value === null || value === undefined || value === '') return '-';

    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return value;

    // Ratios are typically percentages or decimals
    if (isRatio) {
        // If the number is already a percentage (> 1), show as is
        if (Math.abs(num) > 1) {
            return num.toFixed(1) + '%';
        }
        // If it's a decimal (< 1), convert to percentage
        return (num * 100).toFixed(1) + '%';
    }

    // Format large numbers with commas
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1
    });
};

// Helper function to format section names
const formatSectionName = (key) => {
    return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export default function ForecastTable({ forecastData, reportDate }) {
    if (!forecastData || !forecastData.rows || forecastData.rows.length === 0) {
        return (
            <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#888',
                fontStyle: 'italic'
            }}>
                No forecast data available
            </div>
        );
    }

    const { currency, columns, sections, rows } = forecastData;

    // Extract report year from reportDate (format: DD/MM/YYYY)
    let reportYear = null;
    if (reportDate) {
        const parts = reportDate.split('/');
        if (parts.length === 3) {
            reportYear = parseInt(parts[2], 10);
        }
    }

    // Filter columns: keep only the last historical year + all forecast years
    let filteredColumns = columns;
    let columnMapping = {}; // Maps filtered column index to original column index

    if (columns && columns.length > 1) {
        const historicalColumns = [];
        const forecastColumns = [];

        // Skip the first column (usually "Year" or "Metric")
        columns.slice(1).forEach((col, idx) => {
            if (col.includes('F')) {
                forecastColumns.push({ label: col, originalIndex: idx + 1 });
            } else {
                historicalColumns.push({ label: col, originalIndex: idx + 1 });
            }
        });

        // Simple logic: show last historical column + all forecast columns
        // If less than 4 columns available, just show what exists
        const columnsToShow = [];

        // Add the most recent historical column (just 1)
        if (historicalColumns.length > 0) {
            columnsToShow.push(historicalColumns[historicalColumns.length - 1]);
        }

        // Add all forecast columns
        columnsToShow.push(...forecastColumns);

        // Rebuild filtered columns array and track which are forecasts
        // Safety check: if no columns to show, skip filtering
        if (columnsToShow.length === 0) {
            filteredColumns = columns;
        } else {
            const columnsInfo = columnsToShow.map(c => {
                if (!c || !c.label) return { label: '', isForecast: false, originalIndex: 0 };
                const cleanLabel = c.label.replace(/[A-Z]+$/g, ''); // Remove suffix for display
                const hasF = c.label.includes('F');

                // Determine if forecast: prioritize year comparison if we have reportYear
                let isForecast = false;
                if (reportYear) {
                    // If we have report year, use year comparison (this is the source of truth)
                    const yearNum = parseInt(cleanLabel, 10);
                    if (!isNaN(yearNum)) {
                        isForecast = yearNum >= reportYear;
                    } else {
                        // If can't parse year, fall back to F marker
                        isForecast = hasF;
                    }
                } else {
                    // No report year available, use F marker
                    isForecast = hasF;
                }

                return {
                    label: cleanLabel,
                    isForecast,
                    originalIndex: c.originalIndex
                };
            });

            filteredColumns = [columns[0], ...columnsInfo.map(c => c.label)];

            // Create mapping from filtered index to original index and forecast status
            const isForecastColumn = {}; // Maps filtered index to boolean
            columnsInfo.forEach((col, idx) => {
                columnMapping[idx] = col.originalIndex;
                isForecastColumn[idx] = col.isForecast;
            });

            // Store for use in rendering
            filteredColumns.isForecastColumn = isForecastColumn;
        }

        // Detect format first (needed for empty column check)
        const isYearBased = rows && rows.length > 0 && rows[0].Year !== undefined;
        const isMetricBased = rows && rows.length > 0 && rows[0].metric !== undefined;

        // Helper to check if a column is empty
        const isColumnEmpty = (colLabel, colIndex) => {
            if (!sections) return true;

            for (const sectionKey in sections) {
                const metrics = sections[sectionKey];
                for (const metricKey of metrics) {
                    let value = null;

                    if (isYearBased) {
                        const yearRow = rows.find(row => row.Year === colLabel);
                        value = yearRow ? yearRow[metricKey] : null;
                    } else if (isMetricBased) {
                        const metricRow = rows.find(row => row.metric === metricKey);
                        const originalIndex = columnMapping[colIndex];
                        value = (metricRow && originalIndex !== undefined) ? metricRow.values[originalIndex] : null;
                    }

                    if (value !== null && value !== undefined && value !== '') {
                        return false; // Found at least one non-empty value
                    }
                }
            }
            return true; // All values are empty
        };

        // Second pass: Remove completely empty columns
        if (filteredColumns && filteredColumns.length > 1) {
            const nonEmptyColumnsData = [];
            const oldIsForecastColumn = filteredColumns.isForecastColumn || {};

            for (let i = 1; i < filteredColumns.length; i++) {
                const colLabel = filteredColumns[i];
                const colIndex = i - 1; // Index in columnMapping and isForecastColumn

                if (!isColumnEmpty(colLabel, colIndex)) {
                    const originalIndex = columnMapping[colIndex];
                    const isForecast = oldIsForecastColumn[colIndex] || false;
                    nonEmptyColumnsData.push({ label: colLabel, originalIndex, isForecast });
                }
            }

            // Rebuild filteredColumns, columnMapping, and isForecastColumn
            filteredColumns = [columns[0], ...nonEmptyColumnsData.map(c => c.label)];
            const newColumnMapping = {};
            const newIsForecastColumn = {};
            nonEmptyColumnsData.forEach((col, idx) => {
                if (col.originalIndex !== undefined) {
                    newColumnMapping[idx] = col.originalIndex;
                }
                newIsForecastColumn[idx] = col.isForecast;
            });
            columnMapping = newColumnMapping;
            filteredColumns.isForecastColumn = newIsForecastColumn;
        }


        // Helper function to get value for a metric and year
        const getValue = (metricKey, filteredIndex) => {
            if (isYearBased) {
                // Year-based format: find row by Year, get metric value
                // Use the filtered column label to look up the year
                const yearLabel = filteredColumns[filteredIndex + 1]; // +1 because filteredColumns[0] is "Metric"
                const yearRow = rows.find(row => row.Year === yearLabel);
                return yearRow ? yearRow[metricKey] : null;
            } else if (isMetricBased) {
                // Metric-based format: find row by metric, get value by original index
                const metricRow = rows.find(row => row.metric === metricKey);
                const originalIndex = columnMapping[filteredIndex];
                return metricRow && originalIndex !== undefined ? metricRow.values[originalIndex] : null;
            }
            return null;
        };

        // Check if there's any displayable data after filtering
        // Also check if there are any year columns left (not just the "Metric" column)
        const hasYearColumns = filteredColumns && filteredColumns.length > 1;
        const hasAnyData = hasYearColumns && Object.values(sections).some(metrics => {
            return metrics
                .filter(metricKey => metricKey !== 'charter_capital' && metricKey !== 'retained_earnings')
                .filter(metricKey => {
                    // Count how many columns have actual data for this metric
                    let filledCount = 0;
                    const totalColumns = filteredColumns.length - 1;

                    for (let i = 0; i < totalColumns; i++) {
                        const value = getValue(metricKey, i);
                        if (value !== null && value !== undefined && value !== '') {
                            filledCount++;
                        }
                    }

                    return filledCount >= totalColumns * 0.5;
                }).length > 0;
        });

        // If no data to display, show message
        if (!hasAnyData) {
            return (
                <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#888',
                    fontStyle: 'italic'
                }}>
                    No forecast data available
                </div>
            );
        }

        return (
            <div style={{ marginTop: '20px' }}>
                {/* Table container with horizontal scroll */}
                <div style={{
                    overflowX: 'auto',
                    border: '1px solid #333',
                    borderRadius: '8px'
                }}>
                    <table style={{
                        width: 'auto',
                        borderCollapse: 'collapse',
                        fontSize: '10px'
                    }}>
                        {/* Header row */}
                        <thead>
                            <tr style={{
                                backgroundColor: '#1a1a1a',
                                position: 'sticky',
                                top: 0,
                                zIndex: 10
                            }}>
                                <th style={{
                                    padding: '8px 10px',
                                    textAlign: 'left',
                                    borderBottom: '2px solid #333',
                                    fontWeight: 'bold',
                                    color: '#fff',
                                    width: 'auto',
                                    whiteSpace: 'nowrap',
                                    position: 'sticky',
                                    left: 0,
                                    backgroundColor: '#1a1a1a',
                                    zIndex: 20
                                }}>
                                    Metric
                                </th>
                                {filteredColumns && filteredColumns.slice(1).map((year, idx) => {
                                    const isForecast = filteredColumns.isForecastColumn?.[idx] || false;
                                    return (
                                        <th key={idx} style={{
                                            padding: '8px 10px',
                                            textAlign: 'right',
                                            borderBottom: '2px solid #333',
                                            borderLeft: '1px solid #333',
                                            fontWeight: 'bold',
                                            color: isForecast ? '#00ff7f' : '#fff',
                                            minWidth: '90px'
                                        }}>
                                            {year}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        <tbody>
                            {Object.entries(sections).map(([sectionKey, metrics], sectionIdx) => (
                                <React.Fragment key={sectionKey}>
                                    {/* Section header */}
                                    <tr style={{ backgroundColor: '#0d0d0d' }}>
                                        <td style={{
                                            padding: '8px 10px',
                                            fontWeight: 'bold',
                                            color: '#4ade80',
                                            fontSize: '10px',
                                            borderTop: sectionIdx > 0 ? '2px solid #333' : 'none',
                                            position: 'sticky',
                                            left: 0,
                                            backgroundColor: '#0d0d0d',
                                            zIndex: 15
                                        }}>
                                            {formatSectionName(sectionKey)}
                                        </td>
                                        {/* Empty cells for other columns */}
                                        {filteredColumns && filteredColumns.slice(1).map((_, idx) => (
                                            <td key={idx} style={{
                                                borderTop: sectionIdx > 0 ? '2px solid #333' : 'none',
                                                backgroundColor: '#0d0d0d'
                                            }}></td>
                                        ))}
                                    </tr>

                                    {/* Metric rows */}
                                    {metrics
                                        .filter(metricKey => metricKey !== 'charter_capital' && metricKey !== 'retained_earnings')
                                        .filter(metricKey => {
                                            // Count how many columns have actual data for this metric
                                            let filledCount = 0;
                                            const totalColumns = filteredColumns.length - 1; // -1 for the "Metric" column

                                            for (let i = 0; i < totalColumns; i++) {
                                                const value = getValue(metricKey, i);
                                                if (value !== null && value !== undefined && value !== '') {
                                                    filledCount++;
                                                }
                                            }

                                            // Keep row only if at least 50% of columns have data
                                            return filledCount >= totalColumns * 0.5;
                                        })
                                        .map((metricKey, metricIdx) => {
                                            const isRatio = metricKey.includes('_ratio') || metricKey.includes('_growth');

                                            return (
                                                <tr key={metricKey} style={{
                                                    backgroundColor: metricIdx % 2 === 0 ? '#0a0a0a' : '#121212'
                                                }}>
                                                    <td style={{
                                                        padding: '6px 10px',
                                                        color: '#ddd',
                                                        borderBottom: '1px solid #1a1a1a',
                                                        whiteSpace: 'nowrap',
                                                        position: 'sticky',
                                                        left: 0,
                                                        backgroundColor: metricIdx % 2 === 0 ? '#0a0a0a' : '#121212',
                                                        zIndex: 10
                                                    }}>
                                                        {formatMetricName(metricKey)}
                                                    </td>
                                                    {filteredColumns && filteredColumns.slice(1).map((yearOrLabel, yearIdx) => {
                                                        // Call getValue with the filtered yearIdx
                                                        // getValue will handle the mapping to original indices
                                                        const value = getValue(metricKey, yearIdx);

                                                        return (
                                                            <td key={yearIdx} style={{
                                                                padding: '6px 10px',
                                                                textAlign: 'right',
                                                                color: '#ccc',
                                                                borderLeft: '1px solid #1a1a1a',
                                                                borderBottom: '1px solid #1a1a1a',
                                                                fontFamily: 'monospace'
                                                            }}>
                                                                {formatNumber(value, isRatio)}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div >
        );
    }
}
