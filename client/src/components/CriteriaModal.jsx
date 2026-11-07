import React from 'react';
import { X, CheckCircle2, AlertTriangle, Activity, BarChart2, ShieldCheck, Calendar } from 'lucide-react';

export default function CriteriaModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const pillars = [
    {
      icon: Activity,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      title: 'Pilar 1: Tendencia Alcista o Neutral con Sesgo Alcista (SMA 200 + RSI)',
      threshold: 'Precio Spot > Media Móvil Simple (SMA 200) y RSI (14) entre 45 y 65 puntos.',
      description:
        'El Collar Spread congela la ganancia a cambio del seguro a costo cero. Si la acción está en caída libre o tendencia bajista severa, nadie pagará por la Call y no habrá financiamiento. Se exigen acciones con soporte técnico alcista claro.',
    },
    {
      icon: BarChart2,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      title: 'Pilar 2: Alta Liquidez en Derivados (Penny Pilot Program)',
      threshold: 'Open Interest > 1,000 contratos por strike y spread Bid-Ask menor a $0.10 USD.',
      description:
        'Las opciones sin volumen sufren de deslizamiento severo (slippage). Se requiere que los creadores de mercado coticen con horquilla estrecha para que la prima de la Call financie efectivamente el 100% de la Put protectora.',
    },
    {
      icon: ShieldCheck,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      title: 'Pilar 3: Volatilidad Implícita (IV) y Beta Moderadas',
      threshold: 'Volatilidad entre 18% y 45% anualizada; Beta entre 0.90 y 1.70.',
      description:
        'Si la volatilidad es ínfima (< 15%), la prima de la Call no alcanza a cubrir la Put. Si la volatilidad es desmedida (> 70%, como en biotecnológicas o criptoactivos), el riesgo de brecha violenta es demasiado alto.',
    },
    {
      icon: Calendar,
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      title: 'Pilar 4: Ausencia de Reportes de Ganancias (Earnings) Inmediatos',
      threshold: 'Sin reporte trimestral de resultados dentro de los próximos 15 a 30 días.',
      description:
        'Los reportes de ganancias conllevan un colapso súbito de volatilidad (IV crush) y saltos nocturnos de precio que rompen la simetría de la cobertura.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Protocolo y Criterios Cuantitativos de Selección de Empresas
              </h3>
              <p className="text-xs text-slate-400">
                Reglas algorítmicas de admisión para estructurar un Collar Spread a Costo Cero
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div key={idx} className="bg-[#0b0f19] border border-slate-800/80 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg border shrink-0 ${pillar.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white tracking-tight">
                      {pillar.title}
                    </h4>
                    <div className="mt-1.5 inline-block text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                      Umbral: {pillar.threshold}
                    </div>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
          >
            Entendido y Validado
          </button>
        </div>
      </div>
    </div>
  );
}
