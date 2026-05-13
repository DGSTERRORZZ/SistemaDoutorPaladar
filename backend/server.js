const express = require('express');
const cors = require('cors');
const path = require('path');
const { verifyToken } = require('./authMiddleware');
const { getDatabase, autoSave } = require('./database');

const authRoutes = require('./routes/auth');
const produtosRoutes = require('./routes/produtos');
const vendasRoutes = require('./routes/vendas');
const fiadoRoutes = require('./routes/fiado');
const despesasRoutes = require('./routes/despesas');
const pedidosRoutes = require('./routes/pedidos');
const agendamentosRoutes = require('./routes/agendamentos');
const configuracoesRoutes = require('./routes/configuracoes');
const fornecedoresRoutes = require('./routes/fornecedores');

async function main() {
  await getDatabase();

  const app = express();

  // CORS configurado com origens permitidas
  const allowedOrigins = (process.env.CORS_ORIGINS || '*').split(',');
  app.use(cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
    credentials: true
  }));

  app.use(express.json({ limit: '10mb' }));

  // Servir frontend estático
  app.use(express.static(path.join(__dirname, '..', 'SistemaDoutorPaladar-master', 'frontend')));

  // AutoSave middleware global
  app.use('/api', autoSave);

  // Rotas públicas
  app.use('/api/auth', authRoutes);

  // Rotas de pedidos - parcialmente públicas
  app.use('/api/pedidos', pedidosRoutes);

  // Rotas de agendamentos - GET público para clientes verem horários
  app.use('/api/agendamentos', agendamentosRoutes);

  // Rota pública de produtos para pedidos de clientes
  app.get('/api/produtos-publico', async (req, res) => {
    try {
      const db = await getDatabase();
      const { queryAll } = require('./database');
      const produtos = queryAll(db, 'SELECT id, nome, categoria, preco, estoque FROM produtos WHERE estoque > 0');
      res.json(produtos);
    } catch (err) {
      res.status(500).json({ erro: 'Erro ao buscar produtos' });
    }
  });

  // Rotas protegidas (exigem token)
  app.use('/api/produtos', verifyToken, produtosRoutes);
  app.use('/api/vendas', verifyToken, vendasRoutes);
  app.use('/api/fiado', verifyToken, fiadoRoutes);
  app.use('/api/despesas', verifyToken, despesasRoutes);
  app.use('/api/configuracoes', verifyToken, configuracoesRoutes);
  app.use('/api/fornecedores', verifyToken, fornecedoresRoutes);

  // Endpoint de saúde
  app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // Fallback para SPA
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'SistemaDoutorPaladar-master', 'frontend', 'index.html'));
  });

  // Error handler global
  app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🔥 Doutor Paladar rodando na porta ${PORT}`));
}

main().catch(err => console.error('Erro ao iniciar servidor:', err));
