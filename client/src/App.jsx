import React, { useState, useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';
import LoginView from './components/LoginView';
import Dashboard from './components/Dashboard';
import VistaPortafolio from './components/VistaPortafolio';

const pestanas = [
  { id: 'dashboard', etiqueta: 'Dashboard' },
  { id: 'portafolio', etiqueta: 'Portafolio' },
];

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
  const [pestanaActiva, seleccionarPestana] = useState('dashboard');
  const urlBaseApi = (session?.backendUrl ?? import.meta.env.VITE_API_URL ?? 'https://lsw-eq1-proyecto.onrender.com').replace(/\/$/, '');

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
    seleccionarPestana('dashboard');
    setSession(null);
  };

  const handleSessionChange = (changes) => {
    if (currentIdentity !== sessionIdentity.current) return false;
    setSession((current) => current && { ...current, ...changes });
    return true;
  };

  function navegarPestanas(evento) {
    const indiceActual = pestanas.findIndex(({ id }) => id === pestanaActiva);
    const ultimoIndice = pestanas.length - 1;
    let indiceDestino;
    switch (evento.key) {
      case 'ArrowRight': indiceDestino = (indiceActual + 1) % pestanas.length; break;
      case 'ArrowLeft': indiceDestino = (indiceActual + ultimoIndice) % pestanas.length; break;
      case 'Home': indiceDestino = 0; break;
      case 'End': indiceDestino = ultimoIndice; break;
      default: return;
    }
    evento.preventDefault();
    seleccionarPestana(pestanas[indiceDestino].id);
    evento.currentTarget.querySelectorAll('[role="tab"]')[indiceDestino].focus();
  }

  return (
    <div className="app-shell">
      {session ? (
        <>
          <header className="workspace-header">
            <div className="mx-auto flex max-w-7xl items-center gap-1.5 px-2 py-2 sm:gap-6 sm:px-6 sm:py-3 lg:px-8">
              <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap sm:gap-3">
                <span className="brand-mark max-[359px]:!hidden" aria-hidden="true"><span /><span /><span /></span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ui-accent)] sm:text-xs sm:tracking-widest">LSW · Equipo 1</p>
                  <p className="text-sm font-semibold tracking-tight sm:text-xl">Los Eddies</p>
                </div>
              </div>
              <div
                role="tablist"
                aria-label="Módulos de trabajo"
                onKeyDown={navegarPestanas}
                className="flex shrink-0 gap-1.5 sm:gap-2"
              >
                {pestanas.map(({ id, etiqueta }) => (
                  <button
                    key={id}
                    id={`pestana-${id}`}
                    type="button"
                    role="tab"
                    aria-selected={pestanaActiva === id}
                    aria-controls={`vista-${id}`}
                    tabIndex={pestanaActiva === id ? 0 : -1}
                    onClick={() => seleccionarPestana(id)}
                    className={`ui-button px-2 sm:px-3${pestanaActiva === id ? '' : ' ui-button--inverse'}`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="ui-button ui-button--inverse ml-auto w-11 shrink-0 gap-1 px-2 min-[360px]:w-auto sm:gap-2 sm:px-3"
                title="Cerrar Sesión"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="sr-only min-[360px]:not-sr-only">Salir</span>
              </button>
            </div>
          </header>
          <div
            role="tabpanel"
            id="vista-dashboard"
            aria-labelledby="pestana-dashboard"
            hidden={pestanaActiva !== 'dashboard'}
            tabIndex={0}
          >
            <Dashboard session={session} apiBase={urlBaseApi} onSessionChange={handleSessionChange} />
          </div>
          <div
            role="tabpanel"
            id="vista-portafolio"
            aria-labelledby="pestana-portafolio"
            hidden={pestanaActiva !== 'portafolio'}
            tabIndex={0}
          >
            {pestanaActiva === 'portafolio' && <VistaPortafolio sesion={session} urlBaseApi={urlBaseApi} />}
          </div>
        </>
      ) : (
        <LoginView onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}
