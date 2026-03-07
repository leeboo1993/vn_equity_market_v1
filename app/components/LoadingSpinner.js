'use client';

import React from 'react';

const LoadingSpinner = ({ size = '8', color = '#00ff7f' }) => {
    return (
        <div className="flex items-center justify-center p-4">
            <div
                className={`animate-spin rounded-full h-${size} w-${size} border-b-2`}
                style={{ borderColor: 'transparent', borderBottomColor: color }}
            ></div>
        </div>
    );
};

export default LoadingSpinner;
