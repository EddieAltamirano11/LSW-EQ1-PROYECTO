// Utilidades de vencimiento para contratos de opciones (convencion OCC).
// El codigo OCC de fecha es YYMMDD y las opciones de acciones listadas
// vencen en viernes; las mensuales usan el tercer viernes del mes.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Subyacente + YYMMDD + tipo (C/P) + strike en milesimas con 8 digitos.
const OCC_SYMBOL_PATTERN = /^([A-Z0-9.]+?)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;

/**
 * Normaliza cualquier fecha (Date, ISO completo o YYYY-MM-DD) a un Date UTC
 * a medianoche. Devuelve null si la fecha es invalida.
 */
export const toUtcDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

/**
 * Fecha en formato YYYY-MM-DD (descarta la hora de un ISO completo).
 */
export const toExpirationDateString = (value) => {
  const date = toUtcDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
};

/**
 * Tercer viernes del mes indicado (mes 0-11), a medianoche UTC.
 * Es el vencimiento estandar de las opciones mensuales listadas.
 */
export const thirdFridayOfMonth = (year, month) => {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  // 5 = viernes en getUTCDay()
  const firstFridayOffset = (5 - firstOfMonth.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + firstFridayOffset + 14));
};

/**
 * Siguiente vencimiento valido: tercer viernes del mes actual si esta a
 * `minDaysAhead` dias o mas, o el del mes siguiente. Nunca devuelve una fecha
 * pasada ni un dia que no sea viernes de expiracion listada.
 */
export const nextValidExpiration = ({ minDaysAhead = 30, from = new Date() } = {}) => {
  const base = toUtcDate(from);
  const limit = base.getTime() + minDaysAhead * MS_PER_DAY;

  let year = base.getUTCFullYear();
  let month = base.getUTCMonth();

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = thirdFridayOfMonth(year, month);
    if (candidate.getTime() > base.getTime() && candidate.getTime() >= limit) {
      return candidate.toISOString().slice(0, 10);
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return thirdFridayOfMonth(year, month).toISOString().slice(0, 10);
};

/**
 * Codigo de fecha OCC (YYMMDD) a partir de una fecha YYYY-MM-DD / Date / ISO.
 */
export const occDateCode = (value) => {
  const normalized = toExpirationDateString(value);
  return normalized ? normalized.replace(/-/g, '').slice(2) : null;
};

/**
 * Arma un simbolo OCC: SUBYACENTE + YYMMDD + C|P + strike*1000 (8 digitos).
 */
export const buildOccSymbol = (underlying, expirationDate, optionType, strike) => {
  const ticker = String(underlying || '').toUpperCase();
  const dateCode = occDateCode(expirationDate);
  const type = String(optionType || '').toUpperCase();
  const strikeValue = Number(strike);

  if (!ticker || !dateCode) return null;
  if (!['CALL', 'PUT', 'C', 'P'].includes(type)) return null;
  if (!Number.isFinite(strikeValue) || strikeValue <= 0) return null;

  const letter = type.startsWith('C') ? 'C' : 'P';
  const strikeCode = String(Math.round(strikeValue * 1000)).padStart(8, '0');
  return `${ticker}${dateCode}${letter}${strikeCode}`;
};

export const isOccSymbol = (value) => OCC_SYMBOL_PATTERN.test(String(value || '').toUpperCase());

/**
 * Fecha de expiracion embebida en un simbolo OCC. null si no es OCC.
 */
export const parseOccExpiration = (value) => {
  const match = String(value || '').toUpperCase().match(OCC_SYMBOL_PATTERN);
  if (!match) return null;

  const [, , year, month, day] = match;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (monthNumber < 1 || monthNumber > 12) return null;
  if (dayNumber < 1 || dayNumber > 31) return null;

  const date = new Date(Date.UTC(2000 + Number(year), monthNumber - 1, dayNumber));
  if (Number.isNaN(date.getTime())) return null;
  // Rechaza dias que no existen en el mes (p. ej. 31 de febrero se desborda a marzo).
  if (date.getUTCMonth() !== monthNumber - 1 || date.getUTCDate() !== dayNumber) return null;
  return date;
};

/**
 * true si el simbolo OCC corresponde a un contrato ya vencido respecto de `now`.
 * El contrato vive hasta el cierre del dia de expiracion.
 */
export const isExpiredOptionSymbol = (value, now = new Date()) => {
  const expiration = parseOccExpiration(value);
  if (!expiration) return false;
  return expiration.getTime() + MS_PER_DAY <= now.getTime();
};

export default {
  toUtcDate,
  toExpirationDateString,
  thirdFridayOfMonth,
  nextValidExpiration,
  occDateCode,
  buildOccSymbol,
  isOccSymbol,
  parseOccExpiration,
  isExpiredOptionSymbol,
};
