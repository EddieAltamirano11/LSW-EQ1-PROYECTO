import boom from '@hapi/boom';

export const errorHandler = (err, req, res, next) => {
  let error = err;

  console.error('[API Error Detail]:', err);

  // Si no es un error Boom, lo envolvemos
  if (!boom.isBoom(error)) {
    if (error.name === 'ValidationError') {
      error = boom.badRequest(error.message);
    } else if (error.code === 11000) {
      error = boom.conflict('Llave duplicada en la base de datos.');
    } else {
      error = boom.badImplementation(error.message || 'Error interno del servidor.');
    }
  }

  const { output } = error;
  res.status(output.statusCode).json({
    ...output.payload,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    activeDatabase: req.dbTarget || 'unknown',
  });
};
