import React, { useState, useEffect } from 'react';
import LoginView from './components/LoginView';
import Dashboard from './components/Dashboard';

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem('hedging_quant_session');
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  const handleLoginSuccess = (newSession) => {
    setSession(newSession);
    try {
      localStorage.setItem('hedging_quant_session', JSON.stringify(newSession));
    } catch (_) {}
  };

  const handleLogout = () => {
    setSession(null);
    try {
      localStorage.removeItem('hedging_quant_session');
    } catch (_) {}
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100">
      {session ? (
        <Dashboard session={session} onLogout={handleLogout} />
      ) : (
        <LoginView onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}
