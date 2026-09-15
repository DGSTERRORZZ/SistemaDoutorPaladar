/**
 * Logger Profissional — Doutor Paladar
 * Substitui console.log com níveis, cores e timestamps
 */

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

const LEVELS = {
  debug: { color: COLORS.gray, label: 'DEBUG', icon: '🔍' },
  info:  { color: COLORS.cyan, label: 'INFO ', icon: '📋' },
  success: { color: COLORS.green, label: 'OK   ', icon: '✅' },
  warn:  { color: COLORS.yellow, label: 'WARN ', icon: '⚠️' },
  error: { color: COLORS.red, label: 'ERROR', icon: '❌' }
};

function formatTimestamp() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function log(level, message, meta = null) {
  const config = LEVELS[level] || LEVELS.info;
  const timestamp = formatTimestamp();
  const prefix = `${COLORS.gray}${timestamp}${COLORS.reset} ${config.color}${COLORS.bright}[${config.label}]${COLORS.reset}`;

  if (meta && typeof meta === 'object') {
    console.log(`${prefix} ${config.icon} ${message}`, meta);
  } else if (meta !== null && meta !== undefined) {
    console.log(`${prefix} ${config.icon} ${message}`, meta);
  } else {
    console.log(`${prefix} ${config.icon} ${message}`);
  }
}

const logger = {
  debug:   (msg, meta) => log('debug', msg, meta),
  info:    (msg, meta) => log('info', msg, meta),
  success: (msg, meta) => log('success', msg, meta),
  warn:    (msg, meta) => log('warn', msg, meta),
  error:   (msg, meta) => log('error', msg, meta),

  // Logger para requisições HTTP (como substituto do morgan para controle manual)
  request: (req) => {
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip || req.connection?.remoteAddress || '-';
    log('info', `${COLORS.bright}${method}${COLORS.reset} ${url} ${COLORS.gray}[${ip}]${COLORS.reset}`);
  },

  // Logger de startup
  startup: (msg) => {
    console.log(`\n${COLORS.green}${COLORS.bright}${'═'.repeat(60)}${COLORS.reset}`);
    console.log(`${COLORS.green}${COLORS.bright}  ${msg}${COLORS.reset}`);
    console.log(`${COLORS.green}${COLORS.bright}${'═'.repeat(60)}${COLORS.reset}\n`);
  }
};

module.exports = logger;
