/**
 * Error Handler Global — Doutor Paladar
 * Middleware centralizado de tratamento de erros
 */

const logger = require('../utils/logger');

/**
 * Classe de erro operacional (erros previstos da aplicação)
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware: captura erros de rotas async sem try/catch manual
 * Uso: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Middleware final de tratamento de erros (deve ser registrado por último)
 */
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Erro interno do servidor';

  // Log estruturado
  const logData = {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message: err.message
  };

  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} → ${statusCode}`, logData);
    if (err.stack && process.env.NODE_ENV !== 'production') {
      logger.debug('Stack trace:', err.stack);
    }
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} → ${statusCode}: ${err.message}`);
  }

  res.status(statusCode).json({
    erro: message,
    codigo: statusCode,
    ...(process.env.NODE_ENV !== 'production' && statusCode >= 500 && { detalhes: err.message })
  });
}

/**
 * Middleware: rota não encontrada (404)
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    erro: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
    codigo: 404
  });
}

module.exports = { AppError, asyncHandler, errorHandler, notFoundHandler };
