import React from 'react';
import { AlertTriangle, Shield, Zap } from 'lucide-react';

// Boleta de coberturas de la terminal derecha: muestra la vista previa real (contratos, primas observadas, instante y fuente)
// y solo habilita la emisión cuando la hay. Sin vista previa explica la causa y no muestra primas ni probabilidades.

const dinero = valor => (Number.isFinite(valor) ? `$${valor.toFixed(2)}` : 'sin dato');

function Fila({ etiqueta, valor, clase = '' }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-[var(--ui-muted)]">{etiqueta}</span>
      <span className={`min-w-0 font-bold text-right break-words ${clase}`}>{valor}</span>
    </div>
  );
}

function Estado({ estado, cargando }) {
  if (estado?.fase === 'cargando') {
    return <p role="status" className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-3.5 text-sm text-[var(--ui-muted)]">{cargando}</p>;
  }
  return (
    <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="break-words">{estado?.causa ?? 'Sin vista previa de la cobertura.'} La emisión queda deshabilitada.</span>
    </div>
  );
}

function BotonEmitir({ habilitado, ejecutando, broker, icono: Icono, onClick }) {
  return (
    <button
      type="button"
      disabled={!habilitado || ejecutando}
      onClick={onClick}
      className="ui-button ui-button--primary w-full justify-center py-3 text-sm sm:text-base font-bold shadow-sm"
    >
      <Icono className="h-4 w-4" aria-hidden="true" />
      <span>{ejecutando ? 'Enviando órdenes al broker…' : `Emitir a Broker (LIVE)${broker ? ` · ${broker}` : ''}`}</span>
    </button>
  );
}

export function BoletaCollar({ estado, onEmitir, ejecutando = false, broker }) {
  const vista = estado?.fase === 'lista' ? estado.vista : null;
  return (
    <div className="mt-4 space-y-3.5">
      {vista ? (
        <div className="space-y-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-page)] p-3.5 text-sm shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-[var(--ui-ink)]">{vista.etiqueta}</span>
            <span className="rounded border border-[var(--ui-border)] bg-[var(--ui-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ui-muted)]">
              {vista.fuente === 'RANKING' ? 'Core 004 del ranking' : 'Vista previa del backend'}
            </span>
          </div>
          <Fila etiqueta="Subyacente" valor={`100 acciones de ${vista.symbol}`} />
          <Fila etiqueta="Put (compra al ask)" valor={`${vista.put.contractSymbol} · ${dinero(vista.put.ask)}`} clase="text-red-800" />
          <Fila etiqueta="Call (venta al bid)" valor={`${vista.call.contractSymbol} · ${dinero(vista.call.bid)}`} clase="text-[var(--ui-green)]" />
          <Fila etiqueta="Vencimiento" valor={vista.put.expirationDate} />
          <Fila etiqueta="Costo neto" valor={vista.costoNeto ? (vista.costoNeto.tipo === 'Costo cero' ? 'Costo cero' : `${vista.costoNeto.tipo} ${dinero(vista.costoNeto.monto)}/acc`) : 'sin dato'} />
          <p className="text-[11px] text-[var(--ui-muted)] break-words">
            Cotizado {vista.put.quoteTime ?? 'sin instante'} · {vista.put.source ?? 'sin fuente'}. Al emitir, el backend vuelve a cotizar estos contratos.
          </p>
        </div>
      ) : (
        <Estado estado={estado} cargando="Cargando el collar del Core 004…" />
      )}
      <BotonEmitir habilitado={Boolean(vista)} ejecutando={ejecutando} broker={broker} icono={Zap} onClick={() => onEmitir(vista)} />
    </div>
  );
}

export function BoletaProtectivePut({ estado, onEmitir, ejecutando = false, broker, children }) {
  const put = estado?.fase === 'lista' ? estado.vista : null;
  return (
    <div className="mt-4 space-y-3.5 text-sm">
      {children}
      {put ? (
        <div className="space-y-2 rounded-xl border border-[var(--ui-border)] p-3.5 text-sm">
          <Fila etiqueta="Put recomendado" valor={put.contractSymbol} clase="text-red-800" />
          <Fila etiqueta="Strike · vencimiento" valor={`${dinero(put.strike)} · ${put.expirationDate}`} />
          <Fila etiqueta="Prima observada (ask)" valor={`${dinero(put.ask)} USD/acc`} />
          {Number.isFinite(put.spotPrice) && Number.isFinite(put.ask) && (
            <Fila etiqueta="Pérdida máxima estimada" valor={`${dinero(put.spotPrice - put.strike + put.ask)}/acc`} />
          )}
          <p className="text-[11px] text-[var(--ui-muted)] break-words">
            Cotizado {put.quoteTime ?? 'sin instante'} · {put.source ?? 'sin fuente'}. Al emitir, el backend vuelve a cotizar el contrato.
          </p>
        </div>
      ) : (
        <Estado estado={estado} cargando="Cargando el Put recomendado…" />
      )}
      <BotonEmitir habilitado={Boolean(put)} ejecutando={ejecutando} broker={broker} icono={Shield} onClick={() => onEmitir(put)} />
    </div>
  );
}
