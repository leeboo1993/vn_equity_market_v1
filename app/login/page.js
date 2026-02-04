'use client';

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleLogin = () => {
        setIsLoading(true);
        signIn("google", { callbackUrl: "/" });
    };

    const handleFacebookLogin = () => {
        setIsLoading(true);
        signIn("facebook", { callbackUrl: "/" });
    };

    const handleEmailLogin = (e) => {
        e.preventDefault();
        setIsLoading(true);
        signIn("credentials", { email, password, callbackUrl: "/" });
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-logo-section">
                    <h1 className="login-title">Vietnamese Equity Investment</h1>
                    <p className="login-subtitle">Trading Platform</p>
                </div>

                <div className="social-login-group">
                    <button
                        onClick={handleGoogleLogin}
                        className="social-btn google-btn"
                        disabled={isLoading}
                    >
                        <svg className="social-icon" viewBox="0 0 24 24" width="20" height="20">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span>Google</span>
                    </button>

                    <button
                        onClick={handleFacebookLogin}
                        className="social-btn facebook-btn"
                        disabled={isLoading}
                    >
                        <svg className="social-icon" viewBox="0 0 24 24" width="20" height="20" fill="#1877F2">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        <span>Facebook</span>
                    </button>
                </div>

                <div className="divider">
                    <span>or use password</span>
                </div>

                <form onSubmit={handleEmailLogin} className="login-form">
                    <div className="input-group">
                        <label className="input-label">Email</label>
                        <input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="login-input"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Password</label>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="login-input"
                            disabled={isLoading}
                        />
                    </div>
                    <button
                        type="submit"
                        className="email-login-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? (isSignUp ? "Creating Account..." : "Signing In...") : (isSignUp ? "Sign Up" : "Sign In")}
                    </button>

                    <div className="form-footer">
                        <button
                            type="button"
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="toggle-auth-btn"
                        >
                            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                        </button>
                    </div>
                </form>

                <p className="login-footer">
                    New accounts require administrator approval.
                </p>
            </div>

            <style jsx>{`
                .login-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    background: #050505; /* Original dark background */
                    color: #fff;
                    font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
                    padding: 20px;
                }
                .login-card {
                    background: rgba(255, 255, 255, 0.03); /* Original card bg */
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    padding: 40px;
                    width: 100%;
                    max-width: 440px;
                    text-align: center;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                }
                .login-logo-section {
                    margin-bottom: 30px;
                }
                .login-icon {
                    font-size: 40px;
                    margin-bottom: 15px;
                }
                .login-title {
                    font-size: 28px;
                    font-weight: 700;
                    color: #00ff7f; /* Original Neon Green */
                    margin: 0;
                }
                .login-subtitle {
                    color: #888;
                    font-size: 16px;
                    margin-top: 5px;
                }
                .social-login-group {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 25px;
                }
                .social-btn {
                    padding: 12px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.05);
                    color: #fff;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                }
                .social-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: #00ff7f;
                }
                .face-id-btn:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: #00ff7f;
                }
                .face-id-icon {
                    font-size: 20px;
                }
                .divider {
                    margin: 25px 0;
                    display: flex;
                    align-items: center;
                    color: #444;
                    font-size: 14px;
                }
                .divider::before, .divider::after {
                    content: "";
                    flex: 1;
                    height: 1px;
                    background: #222;
                }
                .divider span {
                    margin: 0 15px;
                }
                .login-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    text-align: left;
                }
                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .input-label {
                    font-size: 14px;
                    font-weight: 600;
                    color: #e0e0e0;
                }
                .login-input {
                    padding: 14px;
                    border-radius: 12px;
                    border: 1px solid #333;
                    background: #111;
                    color: #fff;
                    outline: none;
                    font-size: 16px;
                    transition: border-color 0.2s;
                }
                .login-input:focus {
                    border-color: #00ff7f !important;
                    border-width: 1.5px;
                }
                .email-login-btn {
                    padding: 14px;
                    border-radius: 12px;
                    border: none;
                    background: #00ff7f; /* Original Neon Green */
                    color: #000;
                    font-weight: 700;
                    font-size: 16px;
                    cursor: pointer;
                    transition: opacity 0.2s;
                    margin-top: 10px;
                }
                .email-login-btn:hover {
                    opacity: 0.9;
                }
                .form-footer {
                    margin-top: 15px;
                    text-align: center;
                }
                .toggle-auth-btn {
                    background: transparent;
                    border: none;
                    color: #999;
                    font-size: 15px;
                    font-weight: 500;
                    cursor: pointer;
                    text-decoration: underline;
                    transition: color 0.2s;
                }
                .toggle-auth-btn:hover {
                    color: #00ff7f;
                }
                .login-footer {
                    margin-top: 30px;
                    font-size: 14px;
                    color: #666;
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}
