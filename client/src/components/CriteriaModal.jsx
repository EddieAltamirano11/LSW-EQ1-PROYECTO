import React from 'react';
import { X, CheckCircle2, Activity, BarChart2, ShieldCheck, Calendar } from 'lucide-react';

export default function CriteriaModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const pillars = [
    {
      icon: Activity,
      title: 'Pilar 1: Tendencia Alcista o Neutral con Sesgo Alcista (SMA 200 + RSI)',
      threshold: 'Precio Spot > Media Móvil Simple (SMA 200) y RSI (14) entre 45 y 65 puntos.',
      description:
        'El Collar Spread congela la ganancia a cambio del seguro a costo cero. Si la acción está en caída libre o tendencia bajista severa, nadie pagará por la Call y no habrá financiamiento. Se exigen acciones con soporte técnico alcista claro.',
    },
    {
      icon: BarChart2,
      title: 'Pilar 2: Alta Liquidez en Derivados (Penny Pilot Program)',
      threshold: 'Open Interest > 1,000 contratos por strike y spread Bid-Ask menor a $0.10 USD.',
      description:
        'Las opciones sin volumen sufren de deslizamiento severo (slippage). Se requiere que los creadores de mercado coticen con horquilla estrecha para que la prima de la Call financie efectivamente el 100% de la Put protectora.',
    },
    {
      icon: ShieldCheck,
      title: 'Pilar 3: Volatilidad Implícita (IV) y Beta Moderadas',
      threshold: 'Volatilidad entre 18% y 45% anualizada; Beta entre 0.90 y 1.70.',
      description:
        'Si la volatilidad es ínfima (< 15%), la prima de la Call no alcanza a cubrir la Put. Si la volatilidad es desmedida (> 70%, como en biotecnológicas o criptoactivos), el riesgo de brecha violenta es demasiado alto.',
    },
    {
      icon: Calendar,
      title: 'Pilar 4: Ausencia de Reportes de Ganancias (Earnings) Inmediatos',
      threshold: 'Sin reporte trimestral de resultados dentro de los próximos 15 a 30 días.',
      description:
        'Los reportes de ganancias conllevan un colapso súbito de volatilidad (IV crush) y saltos nocturnos de precio que rompen la simetría de la cobertura.',
    },
  ];

  return (
    <div className="ui-overlay">
      <div className="ui-dialog max-w-2xl" role="dialog" aria-labelledby="criteria-title">
        <header className="ui-dialog-header">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="ui-section-icon"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <h2 id="criteria-title" className="text-base font-semibold leading-tight tracking-tight sm:text-lg">
                Protocolo y Criterios Cuantitativos de Selección de Empresas
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ui-muted)]">
                Reglas algorítmicas de admisión para estructurar un Collar Spread a Costo Cero
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-button ui-icon-button"
            aria-label="Cerrar criterios"
            autoFocus
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="ui-dialog-body divide-y divide-[var(--ui-border)]" tabIndex={0} role="region" aria-label="Pilares y umbrales de selección">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div key={idx} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <span className="ui-section-icon"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold tracking-tight">
                      {pillar.title}
                    </h3>
                    <div className="mt-1.5 rounded-md bg-[var(--ui-soft)] px-2 py-1 text-xs font-semibold text-[var(--ui-green)]">
                      Umbral: {pillar.threshold}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--ui-muted)]">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="ui-dialog-footer justify-end">
          <button type="button" onClick={onClose} className="ui-button ui-button--primary">
            Entendido y Validado
          </button>
        </footer>
      </div>
    </div>
  );
}
