import React from 'react';

// Presentación de los resultados de cada core; la usa la consulta por core del selector.
export const LABELS = {
  '001': 'Técnico', '002': 'Fundamental', '003': 'Señales directas', '004': 'Estrategia de opciones',
  '005': 'Institucional', '006': 'Noticias', '007': 'Confluencia',
};
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' });
const decimal = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const conSigno = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
const fechaNoticia = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
const ESTADO_NOTICIA = { CONFIRMED: 'Confirmado', REPORTED: 'Reportado', OPEN: 'Riesgo abierto', SCHEDULED: 'Programado' };

export function NoticiaDelCore({ noticia }) {
  const instante = Date.parse(noticia.publishedAt);
  const reaccion = noticia.reaction;
  const metricas = reaccion?.status === 'AVAILABLE' ? [
    Number.isFinite(reaccion.openingGap) && `Apertura ${conSigno.format(reaccion.openingGap)} %`,
    Number.isFinite(reaccion.sessionChange) && `Cierre de sesión ${conSigno.format(reaccion.sessionChange)} %`,
    Number.isFinite(reaccion.relativeVolume) && `Volumen ${decimal.format(reaccion.relativeVolume)}×`,
    reaccion.benchmark && `Frente a ${reaccion.benchmark.symbol} ${conSigno.format(reaccion.benchmark.excess)} pp`,
  ].filter(Boolean) : [];
  const datosEvento = [
    noticia.event?.label ?? noticia.type, ESTADO_NOTICIA[noticia.event?.state],
    noticia.contextOnly ? 'Contexto' : Number.isFinite(noticia.impact) && `Impacto ${conSigno.format(noticia.impact)}`,
    noticia.timeSource === 'SEC_ACCEPTANCE' ? 'Aceptación en EDGAR' : noticia.source,
  ].filter(Boolean);

  return (
    <>
      {/^https:\/\//i.test(noticia.url ?? '') ? (
        <a href={noticia.url} target="_blank" rel="noreferrer" className="underline">{noticia.headline}</a>
      ) : noticia.headline}
      {Number.isFinite(instante) && <time dateTime={noticia.publishedAt} className="ml-2 text-[var(--ui-muted)]">{fechaNoticia.format(instante)} ET</time>}
      {datosEvento.length > 0 && <p className="text-[var(--ui-muted)]">{datosEvento.join(' · ')}</p>}
      {metricas.length > 0 && (
        <p className="text-[var(--ui-muted)]">{reaccion.session} · {metricas.join(' · ')} · {reaccion.source}</p>
      )}
      {reaccion?.status === 'PENDING' && <p className="text-[var(--ui-muted)]">Reacción pendiente al cierre del {reaccion.session}.</p>}
      {reaccion?.status === 'UNAVAILABLE' && <p className="text-[var(--ui-muted)]">Reacción sin velas verificables.</p>}
      {noticia.related?.length > 0 && (
        <details className="text-[var(--ui-muted)]">
          <summary className="cursor-pointer">Cobertura relacionada ({noticia.related.length})</summary>
          <ul className="ml-3">
            {noticia.related.map(item => <li key={item.id ?? item.headline}>
              {item.headline}{Number.isFinite(Date.parse(item.publishedAt)) && ` · ${fechaNoticia.format(Date.parse(item.publishedAt))} ET`}
            </li>)}
          </ul>
        </details>
      )}
    </>
  );
}
// UNVERIFIED: Webull no entregó una fecha de resultados y no se estima ninguna.
export const riesgoDeEvento = riesgo => (riesgo === 'UNVERIFIED' ? 'Earnings sin verificar' : riesgo);

export const formatNumber = value => Number.isFinite(value) ? decimal.format(value) : 'Sin datos';
const formatMoney = value => Number.isFinite(value) ? `${currency.format(value)} USD` : 'Sin datos';

function Metrics({ entries }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
      {entries.map(([label, value]) => (
        <div className="min-w-0 break-words" key={label}>
          <dt className="text-xs text-[var(--ui-muted)]">{label}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CoreResult({ id, result }) {
  if (id === '001') {
    const day = result.timeframes.daily;
    return <Metrics entries={[
      ['Tendencia', { UP: 'Alcista', DOWN: 'Bajista', SIDEWAYS: 'Lateral' }[result.trend]], ['ADX diario', day.adx],
      ['RSI diario', day.rsi], ['Histograma MACD', day.macdHistogram], ['ATR', day.atr], ['Volumen relativo', day.relativeVolume],
      ['Soportes', result.support.map(level => formatNumber(level.price)).join(', ') || 'Sin niveles'],
      ['Resistencias', result.resistance.map(level => formatNumber(level.price)).join(', ') || 'Sin niveles'],
    ]} />;
  }
  if (id === '002') return <Metrics entries={[
    ['Viabilidad', result.classification], ['Valuación', result.valuation ?? 'Sin datos'], ['Riesgo de evento', riesgoDeEvento(result.risk)],
    result.risk === 'UNVERIFIED'
      ? ['Causa', result.event?.reason ?? 'Sin fecha de resultados verificable']
      : ['Próximos resultados', result.event?.start ? `${result.event.start}${result.event.estimated ? ' (ventana de Webull)' : ''}` : 'Sin datos'],
    ['Altman', formatNumber(result.altman?.value)], ['Piotroski', `${result.piotroski.passed}/${result.piotroski.evaluated}`],
    ['P/E', formatNumber(result.indicators.pe)], ['Ejercicios', result.fiscalYears.join(', ')],
  ]} />;
  if (id === '003') return <Metrics entries={[
    ['Señal', result.signal], ['Fuerza', result.strength], ['Regla', result.rule], ['Riesgo de evento', riesgoDeEvento(result.risk)],
    ...(result.risk === 'UNVERIFIED' && result.reason ? [['Causa', result.reason]] : []),
  ]} />;
  if (id === '004') return result.eligible ? <Metrics entries={[
    ['Put · ask', `${result.put.symbol} · ${formatMoney(result.put.ask)}`],
    ['Call · bid', `${result.call.symbol} · ${formatMoney(result.call.bid)}`], ['Vencimiento', result.expiration],
    ['Pérdida máxima', formatMoney(result.maxLoss)], ['Ganancia máxima', formatMoney(result.maxProfit)],
    ['Punto de equilibrio', formatMoney(result.breakEven)], ['Acciones', result.shares],
  ]} /> : <p>{result.reason}</p>;
  if (id === '005') return <Metrics entries={[
    ['Sesgo estimado', result.direction], ['Fuerza del flujo', result.strength],
    ['Zonas de interés', result.zones.map(zone => `${zone.strike} · ${zone.expiration}`).join(', ')],
    ['Contexto 13F', result.holdings ? `${result.holdings.filer} · ${result.holdings.period} · ${result.holdings.positions.length} registros` : 'Sin datos'],
  ]} />;
  if (id === '006') return (
    <div className="space-y-2">
      <Metrics entries={[
        ['Sentimiento', result.sentiment], ['Impacto estimado', result.impact], ['Titulares analizados', result.observed],
        ...(Number.isFinite(result.contextObserved) ? [['Titulares en contexto', result.contextObserved]] : []),
      ]} />
      <ul className="space-y-2 text-xs">
        {(result.events ?? result.headlines).map(item => <li key={`${item.source}:${item.id ?? item.headline}`} className="break-words">
          <NoticiaDelCore noticia={item} />
        </li>)}
      </ul>
    </div>
  );
  return (
    <div className="space-y-2">
      <Metrics entries={[
        ['Puntaje', result.score], ['Confianza', result.confidence], ['Señal final', result.signal ?? 'Evaluación individual'],
        ['Conflictos', result.conflicts.length ? 'Sesgos opuestos' : 'Sin conflictos'],
      ]} />
      <ul className="space-y-1 text-xs">
        {result.drivers.map(driver => <li key={driver.id}>{LABELS[driver.id]} · peso {formatNumber(driver.weight * 100)} % · puntaje {driver.score}</li>)}
      </ul>
      {result.dependency && <p className="text-xs text-[var(--ui-muted)]">{result.dependency}</p>}
    </div>
  );
}

// Detalle completo de un core para una empresa: motivo, métricas, inferencia y evidencia.
export function CoreDetail({ id, diagnostic }) {
  return (
    <div className="space-y-2 text-sm">
      {diagnostic.reason && <p>{diagnostic.reason}</p>}
      {diagnostic.result && <CoreResult id={id} result={diagnostic.result} />}
      {diagnostic.result?.inference && <p className="text-xs text-[var(--ui-muted)]">{diagnostic.result.inference}</p>}
      {diagnostic.result?.scenario && <p className="text-xs text-[var(--ui-muted)]">{diagnostic.result.scenario}</p>}
      {diagnostic.evidence.length > 0 && <ul className="space-y-1 break-words text-xs text-[var(--ui-muted)]">
        {diagnostic.evidence.map((item, index) => <li key={`${item.source}-${item.reference}-${index}`}>
          {item.source}{item.reference && ` · ${item.reference}`}{item.observedAt && ` · ${item.observedAt}`}
          {item.delayMinutes > 0 && ` · retraso ${item.delayMinutes} min`}
        </li>)}
      </ul>}
    </div>
  );
}
