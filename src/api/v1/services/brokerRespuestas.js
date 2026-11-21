import boom from '@hapi/boom';

// Traducción común de respuestas de brokers: 400 si el broker rechaza, 502 si responde algo ilegible
// o incompleto y 503 si no responde. Los números que el broker no reporta quedan en null.

export function numeroReportado(valor) {
  if (valor === null || valor === undefined || valor === '' || typeof valor === 'boolean') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

// Errores de clientes HTTP (axios): con respuesta 4xx es un rechazo del broker; 5xx o sin respuesta, no disponible.
export function errorDeBroker(nombre, error) {
  if (error?.isBoom) return error;
  const estado = error?.response?.status;
  const detalle = error?.response?.data?.message ?? error?.response?.data?.error ?? error?.message ?? 'sin detalle';
  if (estado >= 400 && estado < 500) return boom.badRequest(`${nombre} rechazó la solicitud: ${detalle}`);
  return boom.serverUnavailable(`${nombre} no respondió correctamente: ${detalle}`);
}

// Resultado de un puente (Webull o IBKR). `null` significa que el proceso no devolvió JSON: el broker no respondió.
// `success: false` con un estado HTTP 4xx del broker es un rechazo; con 502 es una respuesta ilegible; lo demás, no disponible.
export function exigirPuente(nombre, resultado, { rechazoComo400 = false } = {}) {
  if (!resultado) throw boom.serverUnavailable(`${nombre} no respondió: el puente no devolvió una respuesta.`);
  if (resultado.success) return resultado;
  const detalle = resultado.error ?? 'sin detalle del broker';
  const estado = Number(resultado.status);
  if (estado === 502) throw boom.badGateway(`${nombre} devolvió una respuesta ilegible o incompleta: ${detalle}`);
  if (rechazoComo400 && !(estado >= 500)) throw boom.badRequest(`${nombre} rechazó la solicitud: ${detalle}`);
  if (estado >= 400 && estado < 500) throw boom.badRequest(`${nombre} rechazó la solicitud: ${detalle}`);
  throw boom.serverUnavailable(`${nombre} no respondió correctamente: ${detalle}`);
}
