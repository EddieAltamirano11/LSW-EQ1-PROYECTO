import * as QuantService from '../services/quant.service.js';
import { validateBlackScholesInput, assertFiniteBlackScholesResult } from '../validators/black-scholes.validator.js';

export const valuateBlackScholes = async (req, res, next) => {
  try {
    const input = validateBlackScholesInput(req.body);
    const result = QuantService.calculateBlackScholes(input);
    assertFiniteBlackScholesResult(result);
    res.status(200).json({
      message: 'Valuación analítica Black-Scholes y Griegas calculadas.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const computeImpliedVolatility = async (req, res, next) => {
  try {
    const result = QuantService.calculateImpliedVolatility(req.body);
    res.status(200).json({
      message: 'Volatilidad implícita calculada mediante Newton-Raphson.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

