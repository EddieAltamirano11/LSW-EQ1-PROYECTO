import * as QuantService from '../services/quant.service.js';

export const valuateBlackScholes = async (req, res, next) => {
  try {
    const result = QuantService.calculateBlackScholes(req.body);
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

