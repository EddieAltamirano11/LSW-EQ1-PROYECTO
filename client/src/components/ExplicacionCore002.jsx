import React from 'react';
import { Check } from 'lucide-react';
import { CORES_INFO } from '../services/coresInfo';

const ALTMAN = [
  {
    titulo: 'Manufactura',
    subtitulo: 'Producción de bienes',
    zonas: [
      { nombre: 'Quiebra', rango: '< 1.81', tono: 'rojo' },
      { nombre: 'Zona gris', rango: '1.81 – 2.99', tono: 'ambar' },
      { nombre: 'Segura', rango: '> 2.99', tono: 'verde' },
    ],
  },
  {
    titulo: 'No manufactura',
    subtitulo: 'Servicios y tecnología',
    zonas: [
      { nombre: 'Quiebra', rango: '< 1.10', tono: 'rojo' },
      { nombre: 'Zona gris', rango: '1.10 – 2.60', tono: 'ambar' },
      { nombre: 'Segura', rango: '> 2.60', tono: 'verde' },
    ],
  },
];

const PRUEBAS = [
  { etiqueta: 'ROA positivo' },
  { etiqueta: 'Flujo operativo +' },
  { etiqueta: 'ROA en mejora' },
  { etiqueta: 'Calidad de ganancias', nota: 'Efectivo > utilidad' },
  { etiqueta: 'Menor deuda larga' },
  { etiqueta: 'Mejor liquidez', nota: 'Razón corriente' },
  { etiqueta: 'Sin dilución', nota: 'No emite acciones' },
  { etiqueta: 'Mejor margen bruto' },
  { etiqueta: 'Mayor rotación activos' },
];

const VEREDICTOS = [
  { nombre: 'VIABLE', tono: 'verde', significado: 'Zona segura con flujo y utilidad positivos. Puede seguir al ranking si cumple el resto de filtros.' },
  { nombre: 'MARGINAL', tono: 'ambar', significado: 'Zona gris o flujo/utilidad negativa. Vetado del ranking.' },
  { nombre: 'NO_VIABLE', tono: 'rojo', significado: 'Zona de quiebra. Vetado del ranking.' },
  { nombre: 'UNKNOWN', tono: 'gris', significado: 'Datos insuficientes en los reportes.' },
];

const RIESGOS = [
  { nombre: 'HIGH', tono: 'rojo', valor: '≤ 7 días' },
  { nombre: 'MEDIUM', tono: 'ambar', valor: '8 – 30 días' },
  { nombre: 'LOW', tono: 'verde', valor: '> 30 días' },
  { nombre: 'UNVERIFIED', tono: 'gris', valor: 'Sin fecha · no resta puntos (parcial)' },
];

const NO_SELECCIONADO = [
  {
    titulo: 'Sigue pasando',
    tono: 'verde',
    puntos: [
      'Se consultan igual las cuentas, el precio y la fecha de resultados.',
      'Se calculan la salud financiera, las pruebas contables y el veredicto de viabilidad.',
      'Las empresas sin salud financiera siguen quedando fuera y no se les busca collar.',
      'Puedes abrir su detalle y su trazabilidad como siempre.',
    ],
  },
  {
    titulo: 'Ya no pasa',
    tono: 'gris',
    puntos: [
      'Su puntaje no entra en el ranking.',
      'No recibe peso y no aparece en la contribución.',
      'No cambia el orden de las empresas.',
      'No marca la fila como parcial por su propio estado.',
    ],
  },
];

const TONO = {
  rojo: 'border-rose-200 bg-rose-50 text-rose-700',
  ambar: 'border-amber-200 bg-amber-50 text-amber-700',
  verde: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  gris: 'border-slate-200 bg-slate-50 text-slate-600',
};
const PUNTO = {
  rojo: 'bg-rose-500',
  ambar: 'bg-amber-500',
  verde: 'bg-emerald-500',
  gris: 'bg-slate-400',
};

function Badge({ tono, children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold ${TONO[tono]}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PUNTO[tono]}`} aria-hidden="true" />
      {children}
    </span>
  );
}

function Tarjeta({ titulo, children }) {
  return (
    <div className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-panel)] p-3">
      <p className="mb-1.5 text-xs font-semibold text-[var(--ui-muted)]">{titulo}</p>
      {children}
    </div>
  );
}

function Seccion({ titulo, subtitulo, children }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-[var(--ui-ink)]">{titulo}</h3>
        {subtitulo && <p className="text-xs text-[var(--ui-muted)]">{subtitulo}</p>}
      </div>
      {children}
    </section>
  );
}

function ZonaAltman({ zona }) {
  return (
    <tr className="border-t border-[var(--ui-border)] first:border-0">
      <th scope="row" className="py-1 pr-2 text-left font-medium">
        <Badge tono={zona.tono}>{zona.nombre}</Badge>
      </th>
      <td className="py-1 text-right font-semibold tabular-nums text-[var(--ui-ink)]">{zona.rango}</td>
    </tr>
  );
}

export default function ExplicacionCore002({ evaluado }) {
  const { peso, participa } = CORES_INFO['002'];

  return (
    <div className="space-y-4 text-sm">
      {!evaluado && (
        <p role="status" className="rounded-lg bg-[var(--ui-soft)] px-3 py-2 text-[var(--ui-green)]">
          Evalúa los cores para ver resultados por empresa.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Tarjeta titulo="Fuentes">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
            <span className="rounded-md bg-[var(--ui-soft)] px-2 py-1 font-semibold text-[var(--ui-green)]">SEC EDGAR</span>
            <span className="text-[var(--ui-muted)]">10-K / 20-F</span>
            <span className="text-[var(--ui-border)]" aria-hidden="true">·</span>
            <span className="rounded-md bg-[var(--ui-soft)] px-2 py-1 font-semibold text-[var(--ui-green)]">Webull</span>
            <span className="text-[var(--ui-muted)]">fechas de resultados</span>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Ventana">
          <p className="text-xs text-[var(--ui-ink)]">
            <span className="mr-1 text-base font-bold tabular-nums">2</span>
            años fiscales consecutivos
          </p>
        </Tarjeta>
      </div>

      <Seccion titulo="Altman Z-Score" subtitulo="Salud financiera y riesgo de quiebra">
        <div className="grid gap-2 md:grid-cols-2">
          {ALTMAN.map(tipo => (
            <Tarjeta key={tipo.titulo} titulo={`${tipo.titulo} · ${tipo.subtitulo}`}>
              <table className="w-full text-xs">
                <caption className="sr-only">Umbrales de Altman Z para {tipo.titulo}</caption>
                <tbody>
                  {tipo.zonas.map(zona => <ZonaAltman key={zona.nombre} zona={zona} />)}
                </tbody>
              </table>
            </Tarjeta>
          ))}
        </div>
        <div>
          <Badge tono="gris">Financieras: N/A (sin cálculo Z → UNKNOWN)</Badge>
        </div>
      </Seccion>

      <Seccion titulo="Piotroski F-Score" subtitulo="Calidad fundamental · 9 pruebas">
        <p className="text-xs leading-relaxed text-[var(--ui-ink)]">
          Evalúa 9 criterios de rentabilidad, deuda y eficiencia (mínimo 6 datos válidos).
          Aporta el <strong className="font-bold">20 %</strong> del puntaje.
        </p>
        <ul aria-label="9 pruebas del F-Score" className="flex flex-wrap gap-1.5">
          {PRUEBAS.map(prueba => (
            <li key={prueba.etiqueta} className="inline-flex items-center gap-1 rounded-md border border-[var(--ui-border)] bg-[var(--ui-page)] px-2 py-1 text-xs">
              <Check className="h-3 w-3 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>
                <span className="font-medium">{prueba.etiqueta}</span>
                {prueba.nota && <span className="ml-1 text-[10px] text-[var(--ui-muted)]">({prueba.nota})</span>}
              </span>
            </li>
          ))}
        </ul>
        <div className="space-y-1">
          <div className="flex gap-1" aria-hidden="true">
            {PRUEBAS.map(prueba => (
              <span key={prueba.etiqueta} className="h-2 flex-1 rounded-sm border border-[var(--ui-border)] bg-[var(--ui-soft)]" />
            ))}
          </div>
          <p className="text-[11px] leading-snug text-[var(--ui-muted)]">
            Cada bloque es una prueba, no una vela de precio. El puntaje usa aprobadas/evaluables
            (mínimo 6). Las velas OHLC pertenecen al Core 001.
          </p>
        </div>
      </Seccion>

      <Seccion titulo="Veredicto de viabilidad" subtitulo="Filtro GATE">
        <div className="grid gap-2 sm:grid-cols-2">
          {VEREDICTOS.map(veredicto => (
            <div key={veredicto.nombre} className="flex flex-wrap items-start gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-page)] p-2">
              <Badge tono={veredicto.tono}>{veredicto.nombre}</Badge>
              <p className="flex-1 text-xs leading-snug text-[var(--ui-muted)]">{veredicto.significado}</p>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Riesgo por resultados" subtitulo="Earnings · no cambia el puntaje">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RIESGOS.map(riesgo => (
            <div key={riesgo.nombre} className="space-y-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-page)] p-2 text-center">
              <Badge tono={riesgo.tono}>{riesgo.nombre}</Badge>
              <p className="text-xs font-semibold tabular-nums text-[var(--ui-ink)]">{riesgo.valor}</p>
            </div>
          ))}
        </div>
      </Seccion>

      <div className="grid gap-2 sm:grid-cols-2">
        <Tarjeta titulo="Peso en confluencia">
          <p className="text-xs leading-relaxed text-[var(--ui-ink)]">{peso}</p>
        </Tarjeta>
        <Tarjeta titulo="Regla GATE">
          <p className="text-xs leading-relaxed text-[var(--ui-ink)]">{participa}</p>
        </Tarjeta>
      </div>

      <Seccion titulo="Si no seleccionas el Core 002" subtitulo="Sigue calculándose, pero no suma al puntaje">
        <div className="grid gap-2 sm:grid-cols-2">
          {NO_SELECCIONADO.map(grupo => (
            <Tarjeta key={grupo.titulo} titulo={grupo.titulo}>
              <ul className="space-y-1.5">
                {grupo.puntos.map(punto => (
                  <li key={punto} className="flex items-start gap-2 text-xs leading-snug text-[var(--ui-ink)]">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${PUNTO[grupo.tono]}`} aria-hidden="true" />
                    {punto}
                  </li>
                ))}
              </ul>
            </Tarjeta>
          ))}
        </div>
      </Seccion>
    </div>
  );
}
