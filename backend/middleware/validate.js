/**
 * Validação Centralizada — Doutor Paladar
 * Funções utilitárias para sanitização e validação de dados
 */

const { AppError } = require('./errorHandler');

/**
 * Sanitiza string removendo tags HTML e espaços extras
 */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

/**
 * Valida que campos obrigatórios existem no body
 * @param {string[]} fields - nomes dos campos obrigatórios
 * @returns {Function} middleware Express
 */
function requireFields(...fields) {
  return (req, _res, next) => {
    const missing = fields.filter(f => {
      const val = req.body[f];
      return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
    });
    if (missing.length > 0) {
      return next(new AppError(`Campos obrigatórios ausentes: ${missing.join(', ')}`, 400));
    }
    next();
  };
}

/**
 * Valida que um valor é um número positivo
 */
function isPositiveNumber(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
}

/**
 * Valida que um valor é um inteiro não negativo
 */
function isNonNegativeInt(value) {
  const num = parseInt(value);
  return !isNaN(num) && num >= 0 && Number.isInteger(num);
}

/**
 * Valida email
 */
function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Valida telefone brasileiro
 */
function isValidPhone(phone) {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

/**
 * Sanitiza todos os campos string do body
 */
function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitize(req.body[key]);
      }
    }
  }
  next();
}

/**
 * Valida que o body contém um array não vazio
 */
function requireArray(fieldName) {
  return (req, _res, next) => {
    const arr = req.body[fieldName];
    if (!Array.isArray(arr) || arr.length === 0) {
      return next(new AppError(`Campo '${fieldName}' deve ser um array não vazio`, 400));
    }
    next();
  };
}

/**
 * Middleware que aplica limite de tamanho a strings
 */
function maxLength(fieldName, max) {
  return (req, _res, next) => {
    const val = req.body[fieldName];
    if (typeof val === 'string' && val.length > max) {
      return next(new AppError(`Campo '${fieldName}' excede o limite de ${max} caracteres`, 400));
    }
    next();
  };
}

module.exports = {
  sanitize,
  requireFields,
  isPositiveNumber,
  isNonNegativeInt,
  isValidEmail,
  isValidPhone,
  sanitizeBody,
  requireArray,
  maxLength
};
