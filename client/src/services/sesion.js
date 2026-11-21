// Vigencia de la sesión: el backend firma un JWT con vencimiento (24 h). Una sesión vencida no se sigue usando.

export const AVISO_SESION_VENCIDA = 'Tu sesión venció. Inicia sesión de nuevo para seguir consultando el broker.';

// Instante de vencimiento (ms) que declara el token, o null si no es un JWT legible.
export function vencimientoDelToken(token) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const carga = JSON.parse(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')));
    return Number.isFinite(carga?.exp) ? carga.exp * 1000 : null;
  } catch {
    return null;
  }
}

// Un token sin vencimiento legible no se descarta aquí: si el backend lo rechaza, el 401 cierra la sesión.
export function tokenVencido(token, ahora = Date.now()) {
  const vence = vencimientoDelToken(token);
  return vence !== null && vence <= ahora;
}

// Un 401 a una petición que llevaba el token de la sesión hacia el backend de la sesión significa que ya no es válida.
export function esRechazoDeSesion(url, opciones, estado, urlBaseApi) {
  if (estado !== 401) return false;
  const destino = typeof url === 'string' ? url : url?.url ?? '';
  const encabezados = opciones?.headers;
  const autorizacion = encabezados instanceof Headers ? encabezados.get('Authorization') : encabezados?.Authorization ?? encabezados?.authorization;
  return Boolean(autorizacion) && destino.startsWith(urlBaseApi);
}
