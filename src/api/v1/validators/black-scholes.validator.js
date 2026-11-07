import boom from '@hapi/boom';

const requiredFields = new Set(['spotPrice', 'strikePrice', 'timeToExpirationYears']);
const numericFields = [...requiredFields, 'volatility', 'riskFreeRate'];

export const validateBlackScholesInput = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw boom.badRequest('El cuerpo debe ser un objeto JSON.');
  }

  const input = {};
  for (const field of numericFields) {
    const value = body[field];
    if (value === undefined) {
      if (requiredFields.has(field)) {
        throw boom.badRequest(`${field} es obligatorio.`);
      }
      continue; // El servicio conserva sus valores predeterminados.
    }

    const numericType = typeof value === 'number'
      || (typeof value === 'string' && value.trim() !== '');
    if (!numericType || !Number.isFinite(Number(value))) {
      throw boom.badRequest(`${field} debe ser un número finito.`);
    }

    const number = Number(value);
    if (field !== 'riskFreeRate' && number <= 0) {
      throw boom.badRequest(`${field} debe ser mayor que cero.`);
    }
    input[field] = number;
  }

  if (body.optionType !== undefined) {
    if (typeof body.optionType !== 'string'
      || !['CALL', 'PUT'].includes(body.optionType.toUpperCase())) {
      throw boom.badRequest('optionType debe ser CALL o PUT.');
    }
    input.optionType = body.optionType.toUpperCase();
  }

  return input;
};

export const assertFiniteBlackScholesResult = (result) => {
  const { delta, gamma, theta, vega, rho } = result.greeks;
  if (![result.theoreticalPrice, delta, gamma, theta, vega, rho].every(Number.isFinite)) {
    throw boom.badRequest('Los parámetros exceden el rango numérico admitido para Black-Scholes.');
  }
};
