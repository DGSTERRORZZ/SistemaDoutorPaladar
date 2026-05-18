const express = require('express');
const cors = require('cors');
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
  app.use(cors());
  app.use(express.json());
  
  app.use('/api/produtos', autoSave);
  app.use('/api/vendas', autoSave);
  app.use('/api/fiado', autoSave);
  app.use('/api/despesas', autoSave);
  app.use('/api/pedidos', autoSave);
  app.use('/api/agendamentos', autoSave);
  app.use('/api/configuracoes', autoSave);
  app.use('/api/fornecedores', autoSave);

  app.use('/api/auth', authRoutes);
  app.use('/api/pedidos', pedidosRoutes);
  app.use('/api/produtos', verifyToken, produtosRoutes);
  app.use('/api/vendas', verifyToken, vendasRoutes);
  app.use('/api/fiado', verifyToken, fiadoRoutes);
  app.use('/api/despesas', verifyToken, despesasRoutes);
  app.use('/api/agendamentos', verifyToken, agendamentosRoutes);
  app.use('/api/configuracoes', verifyToken, configuracoesRoutes);
  app.use('/api/fornecedores', verifyToken, fornecedoresRoutes);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🔥 Backend rodando na porta ${PORT}`));
}

main().catch(err => console.error(err));