'use client';

import React from 'react';

class ReportDetailErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Report Detail Error:', error, errorInfo);
        console.error('Report Data:', this.props.reportData);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <h3 style={{ color: '#ff6666', marginBottom: '12px' }}>
                        Unable to display this report
                    </h3>
                    <p style={{ color: '#888', fontSize: '14px', marginBottom: '8px' }}>
                        There appears to be an issue with this report&apos;s data structure.
                    </p>
                    <p style={{ color: '#666', fontSize: '12px' }}>
                        Error: {this.state.error?.message || 'Unknown error'}
                    </p>
                    <p style={{ color: '#666', fontSize: '12px', marginTop: '16px' }}>
                        Check the browser console for more details.
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ReportDetailErrorBoundary;
