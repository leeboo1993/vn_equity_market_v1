'use client';

import { signOut } from "next-auth/react";

export default function WaitingApprovalPage() {
    return (
        <div className="waiting-container">
            <div className="waiting-card">
                <div className="icon">⏳</div>
                <h1 className="title">Pending Approval</h1>
                <p className="message">
                    Your account has been created successfully.
                    However, access to the investment data requires manual approval from the administrator.
                </p>
                <p className="note">
                    You will be able to access the dashboard once your account is approved.
                </p>
                <button onClick={() => signOut({ callbackUrl: "/login" })} className="logout-btn">
                    Logout
                </button>
            </div>

            <style jsx>{`
                .waiting-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    background: #050505;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                .waiting-card {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    padding: 3rem;
                    width: 100%;
                    max-width: 500px;
                    text-align: center;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                }
                .icon {
                    font-size: 4rem;
                    margin-bottom: 1.5rem;
                }
                .title {
                    font-size: 1.8rem;
                    color: #00ff7f;
                    margin-bottom: 1rem;
                }
                .message {
                    color: #e0e0e0;
                    line-height: 1.6;
                    margin-bottom: 1rem;
                }
                .note {
                    color: #888;
                    font-size: 0.9rem;
                    margin-bottom: 2rem;
                }
                .logout-btn {
                    padding: 0.8rem 2rem;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: transparent;
                    color: #fff;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .logout-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: #ff4444;
                    color: #ff4444;
                }
            `}</style>
        </div>
    );
}
