import jwt from 'jsonwebtoken';
import boom from '@hapi/boom';
import config from '../../../config/config.js';

export const loginUser = async ({ username, password, databaseTarget = 'mongodb' }) => {
  // En un entorno de producción se consultaría una tabla de credenciales;
  // para esta entrega aún no lo manejamos, lo dejaremos para futuras versiones de la aplicación, esto es para v1 solamente.
  if (!username || !password) {
    throw boom.badRequest('Usuario y contraseña son requeridos.');
  }

  const validTargets = ['mongodb', 'supabase'];
  const target = databaseTarget.toLowerCase();
  if (!validTargets.includes(target)) {
    throw boom.badRequest(`databaseTarget inválido. Debe ser uno de: ${validTargets.join(', ')}`);
  }

  // Generamos el payload de sesión con el claim institucional dbTarget
  const payload = {
    userId: `usr-${username.toLowerCase()}`,
    username,
    role: 'INVESTOR',
    dbTarget: target,
    issuedAt: new Date().toISOString(),
  };

  const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: '24h' });

  return {
    message: 'Autenticación exitosa y contexto de persistencia seleccionado.',
    token,
    user: {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    },
    activeDatabase: target,
  };
};

export const verifySession = (token) => {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    throw boom.unauthorized('Token inválido o expirado.', error);
  }
};

