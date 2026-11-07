import React, { useState } from 'react';
import {
  Database,
  ShieldCheck,
  TrendingUp,
  Lock,
  User,
  ArrowRight,
  Server,
  Globe,
  Settings,
  AlertTriangle,
  RefreshCw,
  Zap,
} from 'lucide-react';

const getDefaultBackendUrl = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('hedging_backend_url');
    if (saved && saved.trim()) return saved.trim();

    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL.replace(/\/$/, '');
    }

    const { hostname, port } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (port === '3050') return ''; // Servido directamente por Express en /dashboard
      return 'http://localhost:3050'; // Servidor Vite en desarrollo
    }
  }
  // Valor por defecto en Cloudflare Pages u hosting externo
  return 'https://lsw-eq1-proyecto.onrender.com';
};

export default function LoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState('demo.trader');
  const [password, setPassword] = useState('demo1234');
  const [databaseTarget, setDatabaseTarget] = useState('mongodb');
  const [brokerTarget, setBrokerTarget] = useState('WEBULL');
  const [backendUrl, setBackendUrl] = useState(getDefaultBackendUrl);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cleanBackendUrl = (url) => (url ? url.trim().replace(/\/$/, '') : '');

  const handleSetUrlPreset = (preset) => {
    setBackendUrl(preset);
    try {
      localStorage.setItem('hedging_backend_url', preset);
    } catch (_) {}
  };

  const tryLoginEndpoint = async (url) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-database-target': databaseTarget,
        'x-broker': brokerTarget,
      },
      body: JSON.stringify({
        username: username.trim(),
        password,
        databaseTarget,
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const rawText = await res.text();
      if (rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
        const htmlErr = new Error(
          'El host respondió con una página HTML en lugar de una API JSON. ' +
          'Si estás en Cloudflare Pages, asegúrate de apuntar el Servidor Backend a https://lsw-eq1-proyecto.onrender.com'
        );
        htmlErr.isHtml = true;
        throw htmlErr;
      }
      throw new Error(`Respuesta no JSON del servidor (código ${res.status}).`);
    }

    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const base = cleanBackendUrl(backendUrl);
    try {
      localStorage.setItem('hedging_backend_url', base);
    } catch (_) {}

    try {
      let result = null;

      // 1. Intentar endpoint oficial v2
      try {
        result = await tryLoginEndpoint(`${base}/api/v2/auth/login`);
      } catch (err) {
        if (err.isHtml) throw err;
        // Si falló por red o 404, continuaremos con v1
      }

      // 2. Fallback a v1 si v2 responde 404 o no respondió
      if (!result || result.status === 404) {
        result = await tryLoginEndpoint(`${base}/api/v1/auth/login`);
      }

      if (!result.ok) {
        throw new Error(result.data?.message || 'Error al autenticar en el microservicio.');
      }

      const data = result.data;
      onLoginSuccess({
        token: data.token,
        user: data.user || { username, role: 'QUANT_TRADER' },
        databaseTarget,
        brokerTarget,
        backendUrl: base,
      });
    } catch (err) {
      setError(err.message || 'Error de conexión con el backend.');
    } finally {
      setLoading(false);
    }
  };

  // Modo offline / presentación rápida sin bloqueo
  const handleOfflineDemoLogin = () => {
    const demoToken = 'demo-jwt-simulated-token-equipo1';
    const base = cleanBackendUrl(backendUrl);
    onLoginSuccess({
      token: demoToken,
      user: { userId: `usr-${username.toLowerCase()}`, username, role: 'QUANT_INVESTOR' },
      databaseTarget,
      brokerTarget,
      backendUrl: base,
      isOfflineDemo: true,
    });
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
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 space-y-2">
            <div className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
            <div className="pt-2 border-t border-red-500/20 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleSetUrlPreset('https://lsw-eq1-proyecto.onrender.com')}
                className="text-[11px] text-indigo-300 hover:underline"
              >
                Apuntar a Render Cloud
              </button>
              <button
                type="button"
                onClick={handleOfflineDemoLogin}
                className="text-[11px] font-medium bg-red-500/20 hover:bg-red-500/30 text-white px-2 py-1 rounded"
              >
                Acceso Rápido Demo
              </button>
            </div>
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

          {/* Panel Desplegable de Ajustes de Servidor */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowServerSettings(!showServerSettings)}
              className="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1.5 transition"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{showServerSettings ? 'Ocultar ajustes de servidor' : 'Ajustes de Servidor Backend'}</span>
            </button>

            {showServerSettings && (
              <div className="mt-3 p-3.5 bg-[#0b0f19] border border-slate-800 rounded-xl space-y-2.5 animate-in fade-in">
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  URL del Microservicio Backend
                </label>
                <input
                  type="text"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  placeholder="https://lsw-eq1-proyecto.onrender.com"
                  className="w-full bg-[#111827] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetUrlPreset('https://lsw-eq1-proyecto.onrender.com')}
                    className="flex-1 py-1 px-2 text-[10px] rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20"
                  >
                    Render Cloud
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetUrlPreset('http://localhost:3050')}
                    className="flex-1 py-1 px-2 text-[10px] rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                  >
                    Local (3050)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botón de Envío */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-xs">Conectando al Microservicio...</span>
              </div>
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
