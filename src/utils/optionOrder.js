// Utilidades para validar ordenes de opciones antes de enviarlas al broker.
// Un contrato OCC se compone de: subyacente + YYMMDD + C|P + strike (8 digitos).

const OCC_PARTS_PATTERN = /^([A-Z0-9.]+?)(\d{6})([CP])(\d{8})$/;

/**
 * Descompone un simbolo OCC. Devuelve null si no tiene ese formato.
 */
export const parseOccParts = (symbol) => {
  const match = String(symbol || '').toUpperCase().match(OCC_PARTS_PATTERN);
  if (!match) return null;

  const [, underlying, dateCode, type, strikeCode] = match;
  return {
    underlying,
    dateCode,
    optionType: type === 'C' ? 'CALL' : 'PUT',
    strike: Number(strikeCode) / 1000,
  };
};

export const parseOccUnderlying = (symbol) => parseOccParts(symbol)?.underlying || null;

const isLongPosition = (position) => {
  const direction = String(position?.side || 'long').toLowerCase();
  return direction !== 'short' && Number(position?.qty) > 0;
};

const normalize = (value) => String(value || '').toUpperCase();

/**
 * Evalua si una venta de opcion esta cubierta por la posicion actual.
 *
 * Reglas:
 *  - Si ya existe una posicion larga del mismo contrato >= qty, es un cierre
 *    (sell to close) y no requiere acciones.
 *  - Si es una apertura (sell to open), requiere 100 acciones largas del
 *    subyacente por contrato; de lo contrario el broker la rechaza como
 *    "uncovered option contract".
 *
 * Devuelve null si el simbolo no es OCC o qty no es valido.
 */
export const evaluateCoveredOptionSell = ({ contractSymbol, qty = 1, positions = [] } = {}) => {
  const parts = parseOccParts(contractSymbol);
  const contracts = Math.floor(Number(qty));
  if (!parts || !Number.isFinite(contracts) || contracts <= 0) return null;

  const list = Array.isArray(positions) ? positions : [];

  const longOption = list.find(
    (position) =>
      normalize(position?.symbol) === normalize(contractSymbol) && isLongPosition(position)
  );

  if (longOption && Number(longOption.qty) >= contracts) {
    return {
      ok: true,
      closesLongOption: true,
      underlying: parts.underlying,
      requiredShares: 0,
      availableShares: Number(longOption.qty) * 100,
    };
  }

  const underlyingPosition = list.find(
    (position) => normalize(position?.symbol) === parts.underlying && isLongPosition(position)
  );

  const availableShares = underlyingPosition ? Number(underlyingPosition.qty) : 0;
  const requiredShares = contracts * 100;

  return {
    ok: availableShares >= requiredShares,
    closesLongOption: false,
    underlying: parts.underlying,
    requiredShares,
    availableShares,
  };
};

export default { parseOccParts, parseOccUnderlying, evaluateCoveredOptionSell };
