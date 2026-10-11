import jwt from 'jsonwebtoken';
import boom from '@hapi/boom';
import config from '../config/config.js';

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Si no trae token, continúa como anónimo pero databaseContextMiddleware asignará mongodb por defecto
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    next(boom.unauthorized('Token de autorización inválido o expirado.'));
  }
};

