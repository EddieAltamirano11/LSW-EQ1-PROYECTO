import React, { useState } from 'react';
import {
  Lock,
  User,
  ArrowRight,
  Settings,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { brokerOptions, databaseOptions, DEFAULT_BROKER, DEFAULT_DATABASE } from '../sessionTargets';

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
  const [databaseTarget, setDatabaseTarget] = useState(DEFAULT_DATABASE);
  const [brokerTarget, setBrokerTarget] = useState(DEFAULT_BROKER);
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
    <main className="grid min-h-screen place-items-center px-4 py-6 sm:px-8 sm:py-10">
      <div className="ui-panel grid w-full max-w-5xl overflow-hidden md:grid-cols-[0.9fr_1.1fr]">
        <aside className="login-art flex flex-col justify-between gap-5 p-5 text-white sm:p-8 lg:p-10">
          <div className="flex items-center gap-3">
            <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ui-accent)]">LSW · Equipo 1</p>
              <p className="text-xl font-semibold tracking-tight">Los Eddies</p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--ui-accent)]">API v2 Microservicio</p>
            <p className="max-w-xs text-2xl font-semibold leading-tight tracking-tight lg:text-4xl">
              Plataforma Cuantitativa de Coberturas
            </p>
          </div>
          <p className="hidden max-w-xs text-xs leading-relaxed text-white/90 md:block">
            Laboratorio de Servicios Web • Dr. Francisco Ibarra Carlos
          </p>
        </aside>

        <section className="min-w-0 p-5 sm:p-8 lg:p-10" aria-labelledby="login-title">
          <div className="mb-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--ui-green)]">Acceso al sistema</p>
            <h1 id="login-title" className="text-3xl font-semibold tracking-tight">Iniciar sesión</h1>
          </div>

          {error && (
            <div className="mb-5 space-y-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <div className="flex items-start gap-2 break-words" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">{error}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSetUrlPreset('https://lsw-eq1-proyecto.onrender.com')}
                  className="ui-button"
                >
                  Apuntar a Render Cloud
                </button>
                <button type="button" onClick={handleOfflineDemoLogin} className="ui-button">
                  Acceso Rápido Demo
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="ui-label">Usuario de Demostración</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-[var(--ui-muted)]" aria-hidden="true" />
                <input
                  id="login-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="ui-field py-2 pl-10 pr-3"
                  placeholder="Nombre de usuario"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="ui-label">Contraseña</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-[var(--ui-muted)]" aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ui-field py-2 pl-10 pr-3"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <fieldset className="min-w-0">
              <legend className="ui-label">Persistencia Políglota</legend>
              <div className="ui-segments grid-cols-2">
                {databaseOptions.map(({ value, label, detail }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDatabaseTarget(value)}
                    aria-pressed={databaseTarget === value}
                    className="ui-option"
                  >
                    {label} <small className="whitespace-nowrap">{detail}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="ui-label">Broker Bursátil Objetivo</legend>
              <div className="ui-segments grid-cols-3">
                {brokerOptions.map(({ value, label, detail }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBrokerTarget(value)}
                    aria-pressed={brokerTarget === value}
                    className="ui-option"
                  >
                    {[label, detail].filter(Boolean).join(' ')}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <button
                type="button"
                onClick={() => setShowServerSettings(!showServerSettings)}
                aria-expanded={showServerSettings}
                className="ui-button w-full justify-start"
              >
                <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{showServerSettings ? 'Ocultar ajustes de servidor' : 'Ajustes de Servidor Backend'}</span>
              </button>

              {showServerSettings && (
                <div className="mt-2 space-y-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-soft)] p-3">
                  <div>
                    <label htmlFor="login-backend-url" className="ui-label">URL del Microservicio Backend</label>
                    <input
                      id="login-backend-url"
                      type="text"
                      value={backendUrl}
                      onChange={(e) => setBackendUrl(e.target.value)}
                      placeholder="https://lsw-eq1-proyecto.onrender.com"
                      className="ui-field px-3 py-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetUrlPreset('https://lsw-eq1-proyecto.onrender.com')}
                      className="ui-button"
                    >
                      Render Cloud
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetUrlPreset('http://localhost:3050')}
                      className="ui-button"
                    >
                      Local (3050)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="ui-button ui-button--primary w-full">
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />
                  <span>Conectando al Microservicio...</span>
                </>
              ) : (
                <>
                  <span>Acceder al Dashboard Cuantitativo</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <footer className="mt-5 border-t border-[var(--ui-border)] pt-4 text-xs text-[var(--ui-muted)]">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--ui-green)]" aria-hidden="true" />
              <span>Microservicio v2.0.0 Activo</span>
              <span aria-hidden="true">•</span>
              <span>Render Cloud / Local</span>
            </p>
            <p className="mt-2 md:hidden">Laboratorio de Servicios Web • Dr. Francisco Ibarra Carlos</p>
          </footer>
        </section>
      </div>
    </main>
  );
}
