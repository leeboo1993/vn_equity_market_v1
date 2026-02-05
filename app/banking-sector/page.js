'use client';

import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import BankingDashboard from '../components/BankingDashboard';

export default function BankingPage() {
    return (
        <>
            <Header title="Banking Sector Analysis" />
            <main className="main-container px-6 py-8">
                <BankingDashboard />
            </main>
        </>
    );
}
