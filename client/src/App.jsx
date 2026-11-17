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

  // Enrutamiento de vistas por Hash URL (#/dashboard y #/portafolio)
  const getRutaInicial = () => {
    if (typeof window === 'undefined') return 'dashboard';
    const hash = (window.location.hash || '').toLowerCase();
    if (hash.includes('portafolio')) return 'portafolio';
    return 'dashboard';
  };

  const [pestanaActiva, setPestanaActiva] = useState(getRutaInicial);
  const [loginContext, setLoginContext] = useState(null);
  const urlBaseApi = (session?.backendUrl ?? import.meta.env.VITE_API_URL ?? 'https://lsw-eq1-proyecto.onrender.com').replace(/\/$/, '');

  const seleccionarPestana = (id) => {
    setPestanaActiva(id);
    if (typeof window !== 'undefined') {
      window.location.hash = `#/${id}`;
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      const ruta = getRutaInicial();
      setPestanaActiva(ruta);
    };
    window.addEventListener('hashchange', onHashChange);
    if (!window.location.hash) {
      window.location.hash = `#/dashboard`;
    }
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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
    setLoginContext(null);
    setSession(newSession);
  };

  const handleLogout = () => {
    sessionIdentity.current = Symbol();
    seleccionarPestana('dashboard');
    setSession(null);
  };

  const handleSignIn = () => {
    const { user, databaseTarget, brokerTarget } = session;
    setLoginContext({ username: user?.username, databaseTarget, brokerTarget, backendUrl: urlBaseApi });
    handleLogout();
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
    <div className={`app-shell ${session ? 'min-h-screen lg:h-screen flex flex-col lg:overflow-hidden' : ''}`}>
      {session ? (
        <>
          <header className="workspace-header shrink-0">
            <div className="flex w-full items-center gap-1.5 px-3 py-2 sm:gap-6 sm:px-6 sm:py-3 lg:px-8">
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
          {pestanaActiva === 'dashboard' && (
            <div
              role="tabpanel"
              id="vista-dashboard"
              aria-labelledby="pestana-dashboard"
              tabIndex={0}
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              <Dashboard
                session={session}
                apiBase={urlBaseApi}
                onSessionChange={handleSessionChange}
                onSignIn={handleSignIn}
              />
            </div>
          )}
          {pestanaActiva === 'portafolio' && (
            <div
              role="tabpanel"
              id="vista-portafolio"
              aria-labelledby="pestana-portafolio"
              tabIndex={0}
              className="flex-1 min-h-0 overflow-y-auto bg-[var(--ui-bg)]"
            >
              <VistaPortafolio
                sesion={session}
                urlBaseApi={urlBaseApi}
                onSessionChange={handleSessionChange}
              />
            </div>
          )}
        </>
      ) : (
        <LoginView onLoginSuccess={handleLoginSuccess} loginContext={loginContext} />
      )}
    </div>
  );
}
