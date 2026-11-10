import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { brokerOptions, databaseOptions, DEFAULT_BROKER, DEFAULT_DATABASE } from '../sessionTargets';

const textoNoDisponible = 'No disponible';
const formatoCantidad = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 12 });
const etiquetasEstado = new Map([['ACTIVE', 'Activa'], ['CLOSED', 'Cerrada'], ['EXPIRED', 'Vencida']]);
const etiquetasTipo = new Map([
  ['PROTECTIVE_PUT', 'Put de protección'], ['COLLAR', 'Collar'], ['COLLAR_SPREAD', 'Collar spread'],
]);
const etiquetasLado = new Map([['long', 'Larga'], ['short', 'Corta']]);

function esTextoValido(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function formatearImporte(importe, moneda) {
  if (importe === null) return textoNoDisponible;
  if (!/^[a-z]{3}$/i.test(moneda ?? '')) return formatoCantidad.format(importe);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda,
    currencyDisplay: 'code',
  }).format(importe);
}

function leerCuentaConfirmada(respuesta, corredorSeleccionado) {
  const cuenta = respuesta?.account;
  const importesValidos = ['cash', 'portfolioValue', 'buyingPower'].every(
    (campo) => cuenta?.[campo] === null || Number.isFinite(cuenta?.[campo])
  );
  const monedaValida = cuenta?.currency === null || esTextoValido(cuenta?.currency);
  return respuesta?.broker === corredorSeleccionado && importesValidos && monedaValida ? cuenta : null;
}

function leerPosicionesConfirmadas(respuesta, corredorSeleccionado) {
  const posiciones = respuesta?.positions;
  if (respuesta?.broker !== corredorSeleccionado || !Array.isArray(posiciones)) return null;
  const posicionesValidas = posiciones.every((posicion) => Number.isFinite(posicion?.qty)
    && (esTextoValido(posicion.symbol) || esTextoValido(posicion.assetId)));
  return posicionesValidas ? posiciones : null;
}

function leerCoberturasGuardadas(respuesta) {
  if (!Array.isArray(respuesta)) return null;
  const coberturasValidas = respuesta.every((cobertura) => esTextoValido(cobertura?.portfolioId)
    && esTextoValido(cobertura.underlying?.symbol)
    && esTextoValido(cobertura.strategyType)
    && esTextoValido(cobertura.status));
  return coberturasValidas ? respuesta : null;
}

function ResultadoConsulta({ lectura, etiqueta, children: contenido }) {
  if (!lectura) return <p role="status" className="text-sm text-[var(--ui-muted)]">Cargando {etiqueta}…</p>;
  if (lectura.error) {
    return <p role="alert" className="text-sm text-red-800">{lectura.error}</p>;
  }
  return contenido(lectura.datos);
}

function ResumenCuenta({ cuenta }) {
  const importes = [
    { etiqueta: 'Efectivo', importe: cuenta.cash },
    { etiqueta: 'Valor de cuenta', importe: cuenta.portfolioValue },
    { etiqueta: 'Poder de compra', importe: cuenta.buyingPower },
  ];
  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-3">
        {importes.map(({ etiqueta, importe }) => (
          <div key={etiqueta} className="min-w-0 rounded-lg bg-[var(--ui-soft)] p-3">
            <dt className="text-sm font-medium text-[var(--ui-muted)]">{etiqueta}</dt>
            <dd className="mt-1 break-words font-semibold tabular-nums">{formatearImporte(importe, cuenta.currency)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-[var(--ui-muted)]">Moneda de cuenta: {cuenta.currency ?? textoNoDisponible}</p>
      {esTextoValido(cuenta.source) && <p className="mt-1 text-xs text-[var(--ui-muted)]">{cuenta.source}</p>}
    </>
  );
}

function TablaPortafolio({ titulo, columnas, filas }) {
  return (
    <div className="overflow-x-auto" role="region" aria-labelledby={titulo} tabIndex={0}>
      <table aria-labelledby={titulo} className="w-full text-left text-sm">
        <thead className="bg-[var(--ui-soft)] text-[var(--ui-forest)]">
          <tr>
            {columnas.map((columna) => <th key={columna} scope="col" className="px-2 py-2 sm:px-3">{columna}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--ui-border)]">
          {filas.map(({ clave, valores }) => (
            <tr key={clave}>
              {valores.map((valor, indice) => (
                <td key={columnas[indice]} className="break-words px-2 py-2.5 align-top sm:px-3">{valor}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaPosiciones({ posiciones }) {
  if (!posiciones.length) return <p className="text-sm text-[var(--ui-muted)]">La cuenta no tiene posiciones abiertas.</p>;

  const filas = posiciones.map((posicion, indice) => ({
    clave: `${posicion.assetId ?? posicion.symbol}-${indice}`,
    valores: [
      esTextoValido(posicion.symbol) ? posicion.symbol : posicion.assetId,
      formatoCantidad.format(posicion.qty),
      etiquetasLado.get(posicion.side) ?? textoNoDisponible,
    ],
  }));
  return <TablaPortafolio titulo="titulo-posiciones" columnas={['Instrumento', 'Cantidad', 'Lado']} filas={filas} />;
}

function TablaCoberturas({ coberturas }) {
  if (!coberturas.length) return <p className="text-sm text-[var(--ui-muted)]">La base seleccionada no tiene coberturas guardadas.</p>;

  const filas = coberturas.map((cobertura, indice) => ({
    clave: cobertura.id ?? cobertura._id ?? `${cobertura.portfolioId}-${indice}`,
    valores: [
      cobertura.portfolioId,
      cobertura.underlying.symbol,
      etiquetasTipo.get(cobertura.strategyType) ?? cobertura.strategyType,
      etiquetasEstado.get(cobertura.status) ?? cobertura.status,
    ],
  }));
  return <TablaPortafolio titulo="titulo-coberturas" columnas={['Portafolio', 'Símbolo', 'Tipo', 'Estado']} filas={filas} />;
}

export default function VistaPortafolio({ sesion, urlBaseApi }) {
  const corredorSeleccionado = sesion.brokerTarget || DEFAULT_BROKER;
  const baseDatosSeleccionada = sesion.databaseTarget || DEFAULT_DATABASE;
  const tokenSesion = sesion.token;
  const esDemoSinConexion = sesion.isOfflineDemo;
  const nombreCorredor = brokerOptions.find((opcion) => opcion.value === corredorSeleccionado)?.label ?? corredorSeleccionado;
  const nombreBaseDatos = databaseOptions.find((opcion) => opcion.value === baseDatosSeleccionada)?.label ?? baseDatosSeleccionada;
  const [numeroActualizacion, asignarNumeroActualizacion] = useState(0);
  const [resultado, guardarResultado] = useState(null);
  const contexto = useMemo(() => ({
    urlBaseApi, tokenSesion, corredorSeleccionado, baseDatosSeleccionada, esDemoSinConexion, numeroActualizacion,
  }), [urlBaseApi, tokenSesion, corredorSeleccionado, baseDatosSeleccionada, esDemoSinConexion, numeroActualizacion]);
  const lecturas = resultado?.contexto === contexto ? resultado.lecturas : {};

  useEffect(() => {
    if (contexto.esDemoSinConexion) return;
    const controlador = new AbortController();
    const encabezadosSesion = { Authorization: `Bearer ${contexto.tokenSesion}` };
    const encabezadosBroker = { ...encabezadosSesion, 'x-broker-selection': contexto.corredorSeleccionado };
    const encabezadosBase = { ...encabezadosSesion, 'x-database-selection': contexto.baseDatosSeleccionada };

    async function cargarLectura(nombre, ruta, encabezados, leerDatos, mensajeError) {
      let lectura;
      try {
        const respuesta = await fetch(`${contexto.urlBaseApi}/api/v2${ruta}`, {
          headers: encabezados,
          signal: controlador.signal,
          cache: 'no-store',
        });
        if (respuesta.status === 401) {
          lectura = { error: `${mensajeError} Se requiere una sesión válida. Vuelve a iniciar sesión.` };
        } else {
          const datos = respuesta.ok ? leerDatos(await respuesta.json()) : null;
          lectura = datos === null ? { error: mensajeError } : { datos };
        }
      } catch {
        lectura = { error: mensajeError };
      }

      if (!controlador.signal.aborted) {
        guardarResultado((anterior) => ({
          contexto,
          lecturas: {
            ...(anterior?.contexto === contexto ? anterior.lecturas : {}),
            [nombre]: lectura,
          },
        }));
      }
    }

    cargarLectura('cuenta', '/broker/account?strict=true', encabezadosBroker,
      (respuesta) => leerCuentaConfirmada(respuesta, contexto.corredorSeleccionado), 'Cuenta no disponible.');
    cargarLectura('posiciones', '/broker/positions?strict=true', encabezadosBroker,
      (respuesta) => leerPosicionesConfirmadas(respuesta, contexto.corredorSeleccionado), 'Posiciones no disponibles.');
    cargarLectura('coberturas', '/hedging', encabezadosBase, leerCoberturasGuardadas, 'Coberturas no disponibles.');

    return () => controlador.abort();
  }, [contexto]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">Portafolio</h1>
          <p className="mt-2 text-sm text-[var(--ui-muted)]">Consulta de cuenta, posiciones y estrategias de cobertura.</p>
        </div>
        {!esDemoSinConexion && (
          <button
            type="button"
            className="ui-button"
            onClick={() => asignarNumeroActualizacion((actual) => actual + 1)}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Actualizar
          </button>
        )}
      </div>

      {esDemoSinConexion ? (
        <p className="ui-panel p-4 text-sm" role="status">
          Inicia sesión con el servidor para consultar los datos de Portafolio.
        </p>
      ) : (
        <>
          <section aria-labelledby="titulo-broker" className="ui-panel min-w-0 space-y-5 p-4 sm:p-5">
            <div>
              <h2 id="titulo-broker" className="text-lg font-semibold">Broker</h2>
              <p className="mt-1 text-sm text-[var(--ui-muted)]">{nombreCorredor}</p>
            </div>
            <ResultadoConsulta lectura={lecturas.cuenta} etiqueta="la cuenta">
              {(cuenta) => <ResumenCuenta cuenta={cuenta} />}
            </ResultadoConsulta>
            <div className="space-y-2">
              <h3 id="titulo-posiciones" className="font-semibold">Posiciones abiertas</h3>
              <ResultadoConsulta lectura={lecturas.posiciones} etiqueta="las posiciones">
                {(posiciones) => <TablaPosiciones posiciones={posiciones} />}
              </ResultadoConsulta>
            </div>
          </section>

          <section aria-labelledby="titulo-coberturas" className="ui-panel min-w-0 space-y-3 p-4 sm:p-5">
            <div>
              <h2 id="titulo-coberturas" className="text-lg font-semibold">Coberturas guardadas</h2>
              <p className="mt-1 text-sm text-[var(--ui-muted)]">Estrategias registradas en {nombreBaseDatos}</p>
            </div>
            <ResultadoConsulta lectura={lecturas.coberturas} etiqueta="las coberturas">
              {(coberturas) => <TablaCoberturas coberturas={coberturas} />}
            </ResultadoConsulta>
          </section>
        </>
      )}
    </main>
  );
}
