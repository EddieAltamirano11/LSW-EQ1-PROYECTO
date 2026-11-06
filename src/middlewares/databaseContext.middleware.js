/**
 * Middleware de Contexto de Base de Datos Unificado
 * Filosofía de Arquitectura: Los Headers HTTP (x-database-selection / x-db-target)
 * son la autoridad rectora de persistencia políglota (MongoDB Atlas vs Supabase PostgreSQL).
 */
export const databaseContextMiddleware = (req, res, next) => {
  // 1. Autoridad rectora: Encabezado institucional x-database-selection o x-db-target
  const headerSelection = (req.headers['x-database-selection'] || req.headers['x-db-target'])?.toLowerCase();
  
  // 2. Claim del token JWT del usuario logueado
  const tokenTarget = req.user?.dbTarget?.toLowerCase();

  // 3. Parámetro query en URL (?database=mongodb o ?database=supabase)
  const queryTarget = (req.query?.database || req.query?.dbTarget || req.query?.db)?.toLowerCase();

  let selected = 'mongodb';
  if (['mongodb', 'supabase'].includes(headerSelection)) {
    selected = headerSelection;
  } else if (['mongodb', 'supabase'].includes(tokenTarget)) {
    selected = tokenTarget;
  } else if (['mongodb', 'supabase'].includes(queryTarget)) {
    selected = queryTarget;
  } else if (req.body?.databaseTarget && ['mongodb', 'supabase'].includes(String(req.body.databaseTarget).toLowerCase())) {
    selected = String(req.body.databaseTarget).toLowerCase();
  }

  // Establecer la BD rectora en la petición
  req.dbTarget = selected;

  // Normalizar el body para que jamás exista contradicción
  if (req.body && typeof req.body === 'object') {
    req.body.databaseTarget = selected;
  }

  // Exponer cabecera de observabilidad en la respuesta HTTP
  res.setHeader('X-Active-Database', selected);
  next();
};

export default databaseContextMiddleware;
