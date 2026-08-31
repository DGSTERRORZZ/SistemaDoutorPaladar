require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const os = require('os');
const { Server } = require('socket.io');

// ── Segurança & Performance ──
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// ── Utilitários internos ──
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { sanitizeBody } = require('./middleware/validate');
const { getDatabase } = require('./database');
const { verifyAdmin } = require('./authMiddleware');

// ═══════════════════════════════════════════════════════════════════
//  INICIALIZAÇÃO DO APP
// ═══════════════════════════════════════════════════════════════════

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});
app.set('io', io);

// ═══════════════════════════════════════════════════════════════════
//  MIDDLEWARES GLOBAIS
// ═══════════════════════════════════════════════════════════════════

// Segurança HTTP Headers
app.use(helmet({
  contentSecurityPolicy: false, // Desativado para permitir CDNs de fontes e ícones
  crossOriginEmbedderPolicy: false
}));

// Compressão GZIP (~60% redução no payload)
app.use(compression());

// CORS
app.use(cors());

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitização automática de inputs string
app.use(sanitizeBody);

// Logging de requisições HTTP
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :response-time ms', {
    stream: { write: (msg) => logger.info(msg.trim()) }
  }));
}

// Rate Limiting Global (100 req/min por IP)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em 1 minuto.', codigo: 429 }
});
app.use('/api/', globalLimiter);

// Rate Limiting Específico para Login (brute force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máx 10 tentativas
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Tente novamente em 15 minutos.', codigo: 429 }
});

// ── Favicon & Arquivos Estáticos ──
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, '../frontend/favicon.svg')));
app.use(express.static(path.join(__dirname, '../frontend'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

// ═══════════════════════════════════════════════════════════════════
//  ROTAS DA API
// ═══════════════════════════════════════════════════════════════════

const clientesAppRoutes = require('./routes/clientes_app');
const produtosRoutes = require('./routes/produtos');
const authRoutes = require('./routes/auth');
const vendasRoutes = require('./routes/vendas');
const pedidosRoutes = require('./routes/pedidos');
const fiadoRoutes = require('./routes/fiado');
const despesasRoutes = require('./routes/despesas');
const agendamentosRoutes = require('./routes/agendamentos');
const fornecedoresRoutes = require('./routes/fornecedores');
const configuracoesRoutes = require('./routes/configuracoes');
const pixRoutes = require('./routes/pix');
const analyticsRoutes = require('./routes/analytics');

// --- Autenticação (com rate limiting) ---
app.post('/api/auth/login', loginLimiter, authRoutes.loginAdmin);
app.post('/api/clientes/cadastrar', clientesAppRoutes.cadastrar);
app.post('/api/clientes/login', loginLimiter, clientesAppRoutes.login);

// --- Clientes (app do consumidor) ---
app.get('/api/clientes/perfil', clientesAppRoutes.getPerfil);
app.put('/api/clientes/alterar-senha', clientesAppRoutes.alterarSenha);
app.put('/api/clientes/atualizar-perfil', clientesAppRoutes.atualizarPerfil);
app.get('/api/clientes/historico-pedidos', clientesAppRoutes.getHistoricoPedidos);
app.get('/api/clientes/admin/listar', verifyAdmin, clientesAppRoutes.listarClientesAdmin);

// --- Produtos ---
app.get('/api/produtos/mais-pedidos', produtosRoutes.obterMaisPedidos);
app.get('/api/produtos', produtosRoutes.listarProdutos);
app.post('/api/produtos', verifyAdmin, produtosRoutes.criarProduto);
app.put('/api/produtos/:id', verifyAdmin, produtosRoutes.atualizarProduto);
app.delete('/api/produtos/:id', verifyAdmin, produtosRoutes.deletarProduto);

// --- Rotas modulares (Express Router) ---
app.use('/api/vendas', vendasRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/fiado', fiadoRoutes);
app.use('/api/despesas', despesasRoutes);
app.use('/api/agendamentos', agendamentosRoutes);
app.use('/api/fornecedores', fornecedoresRoutes);
app.use('/api/configuracoes', configuracoesRoutes);
app.use('/api/pix', pixRoutes);
app.use('/api/analytics', analyticsRoutes);

// ═══════════════════════════════════════════════════════════════════
//  ROTAS UTILITÁRIAS
// ═══════════════════════════════════════════════════════════════════

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.get('/api/server-info', (req, res) => {
  const localIp = getLocalIpAddress();
  const port = process.env.PORT || 3000;
  const baseUrl = process.env.BASE_URL || `http://${localIp}:${port}`;
  res.json({ localIp, port, baseUrl });
});

// Health check com métricas
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '3.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
//  SOCKET.IO — TEMPO REAL
// ═══════════════════════════════════════════════════════════════════

io.on('connection', (socket) => {
  logger.info(`🔌 Cliente conectado: ${socket.id}`);

  socket.on('join_admin', () => {
    socket.join('admin_room');
    logger.debug(`Admin entrou na sala: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    logger.debug(`🔌 Cliente desconectado: ${socket.id}`);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  ERROR HANDLING (deve ser registrado POR ÚLTIMO)
// ═══════════════════════════════════════════════════════════════════

app.use('/api/*', notFoundHandler);
app.use(errorHandler);

// ═══════════════════════════════════════════════════════════════════
//  INICIALIZAÇÃO DO SERVIDOR
// ═══════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await getDatabase();
    server.listen(PORT, '0.0.0.0', () => {
      const localIp = getLocalIpAddress();
      logger.startup('DOUTOR PALADAR — SERVIDOR v3.0');
      logger.success(`Servidor rodando em http://localhost:${PORT}`);
      logger.success(`Rede local (QR Codes): http://${localIp}:${PORT}`);
      logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`PID: ${process.pid} | Node: ${process.version}`);
    });
  } catch (error) {
    logger.error('Falha ao iniciar o servidor:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
function gracefulShutdown(signal) {
  logger.warn(`${signal} recebido. Encerrando servidor...`);
  server.close(async () => {
    logger.info('Servidor encerrado com sucesso.');
    process.exit(0);
  });
  // Forçar saída após 10s se não encerrar
  setTimeout(() => {
    logger.error('Timeout de encerramento. Forçando saída.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

start();
