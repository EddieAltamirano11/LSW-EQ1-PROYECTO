import React, { useState, useEffect, useRef } from 'react';
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

  const sessionIdentity = useRef(Symbol());
  const currentIdentity = sessionIdentity.current;

  useEffect(() => {
    try {
      if (session) {
        localStorage.setItem('hedging_quant_session', JSON.stringify(session));
      } else {
        localStorage.removeItem('hedging_quant_session');
      }
    } catch (_) {}
  }, [session]);

  const handleLoginSuccess = (newSession) => {
    sessionIdentity.current = Symbol();
    setSession(newSession);
  };

  const handleLogout = () => {
    sessionIdentity.current = Symbol();
    setSession(null);
  };

  const handleSessionChange = (changes) => {
    if (currentIdentity !== sessionIdentity.current) return false;
    setSession((current) => current && { ...current, ...changes });
    return true;
  };

  return (
    <div className="app-shell">
      {session ? (
        <Dashboard session={session} onSessionChange={handleSessionChange} onLogout={handleLogout} />
      ) : (
        <LoginView onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}
