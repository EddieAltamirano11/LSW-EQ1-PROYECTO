export const databaseContextMiddleware = (req, res, next) => {
  // 1. Prioridad: Encabezado explícito x-database-selection (ideal para pruebas y Swagger/REST Client)
  const headerSelection = req.headers['x-database-selection']?.toLowerCase();
  
  // 2. Segunda prioridad: Claim del token JWT del usuario logueado
  const tokenTarget = req.user?.dbTarget?.toLowerCase();

  // 3. Selección final
  let selected = 'mongodb';
  if (['mongodb', 'supabase'].includes(headerSelection)) {
    selected = headerSelection;
  } else if (['mongodb', 'supabase'].includes(tokenTarget)) {
    selected = tokenTarget;
  }

  req.dbTarget = selected;
  // Exponemos la cabecera en la respuesta para telemetría
  res.setHeader('X-Active-Database', selected);
  next();
};

