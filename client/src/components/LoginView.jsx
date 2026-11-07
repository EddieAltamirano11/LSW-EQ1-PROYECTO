import React, { useState } from 'react';
import { Database, ShieldCheck, TrendingUp, Lock, User, ArrowRight, Server, Globe } from 'lucide-react';

export default function LoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState('demo.trader');
  const [password, setPassword] = useState('demo1234');
  const [databaseTarget, setDatabaseTarget] = useState('mongodb');
  const [brokerTarget, setBrokerTarget] = useState('WEBULL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v2/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-database-target': databaseTarget,
          'x-broker': brokerTarget,
        },
        body: JSON.stringify({
          username,
          password,
          databaseTarget,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Error al autenticar en el microservicio.');
      }

      onLoginSuccess({
        token: data.token,
        user: data.user || { username, role: 'QUANT_TRADER' },
        databaseTarget,
        brokerTarget,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#070a12] via-[#0b0f19] to-[#111827]">
      <div className="max-w-md w-full bg-[#111827] border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-xl">
        {/* Header Institucional */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-xl mb-3 text-indigo-400">
            <TrendingUp className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Plataforma Cuantitativa de Coberturas
          </h1>
          <p className="text-xs text-indigo-400 font-medium tracking-wide uppercase mt-1">
            API v2 Microservicio • Equipo 1 Los Eddies
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Laboratorio de Servicios Web • Dr. Francisco Ibarra Carlos
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Campo Usuario */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Usuario de Demostración
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                placeholder="Nombre de usuario"
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Selector de Persistencia Políglota */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Persistencia Políglota</span>
              <Database className="w-3.5 h-3.5 text-slate-400" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDatabaseTarget('mongodb')}
                className={`py-2 px-3 text-xs font-medium rounded-lg border flex items-center justify-center gap-1.5 transition ${
                  databaseTarget === 'mongodb'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                    : 'bg-[#0b0f19] border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <span>MongoDB (NoSQL)</span>
              </button>
              <button
                type="button"
                onClick={() => setDatabaseTarget('supabase')}
                className={`py-2 px-3 text-xs font-medium rounded-lg border flex items-center justify-center gap-1.5 transition ${
                  databaseTarget === 'supabase'
                    ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                    : 'bg-[#0b0f19] border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <span>Supabase (SQL)</span>
              </button>
            </div>
          </div>

          {/* Selector de Broker */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Broker Bursátil Objetivo</span>
              <Server className="w-3.5 h-3.5 text-slate-400" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBrokerTarget('IBKR')}
                className={`py-2 px-2 text-[11px] font-medium rounded-lg border text-center transition ${
                  brokerTarget === 'IBKR'
                    ? 'bg-red-500/10 border-red-500 text-red-400'
                    : 'bg-[#0b0f19] border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                IBKR (TWS)
              </button>
              <button
                type="button"
                onClick={() => setBrokerTarget('ALPACA')}
                className={`py-2 px-2 text-[11px] font-medium rounded-lg border text-center transition ${
                  brokerTarget === 'ALPACA'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                    : 'bg-[#0b0f19] border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                Alpaca Markets
              </button>
              <button
                type="button"
                onClick={() => setBrokerTarget('WEBULL')}
                className={`py-2 px-2 text-[11px] font-medium rounded-lg border text-center transition ${
                  brokerTarget === 'WEBULL'
                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400'
                    : 'bg-[#0b0f19] border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                Webull
              </button>
            </div>
          </div>

          {/* Botón de Envío */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
          >
            {loading ? (
              <span className="text-xs">Conectando al Microservicio...</span>
            ) : (
              <>
                <span className="text-sm">Acceder al Dashboard Cuantitativo</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer de Estado */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <div className="inline-flex items-center gap-2 text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Microservicio v2.0.0 Activo</span>
            <span className="text-slate-600">•</span>
            <span>Render Cloud / Local</span>
          </div>
        </div>
      </div>
    </div>
  );
}
