# 🍔 Doutor Paladar — Sistema de Gestão de Cantina Escolar

Sistema completo de gestão de cantina com backend Node.js + MySQL e frontend HTML/CSS/JS puro.

---

## 📋 Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- [MySQL](https://www.mysql.com/) 8.0 ou superior

---

## 🗄️ Passo 1 — Preparar o banco de dados MySQL

```bash
mysql -u root -p
```

Execute os comandos abaixo no prompt do MySQL:

```sql
CREATE DATABASE IF NOT EXISTS doutor_paladar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'doutor_user'@'localhost' IDENTIFIED BY 'Doutor@2026';
GRANT ALL PRIVILEGES ON doutor_paladar.* TO 'doutor_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> As tabelas são criadas **automaticamente** ao iniciar o servidor. Nenhum script SQL extra é necessário.

---

## ⚙️ Passo 2 — Configurar variáveis de ambiente

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `.env` se necessário (por exemplo, para usar credenciais MySQL diferentes):

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=doutor_user
DB_PASS=Doutor@2026
DB_NAME=doutor_paladar
JWT_SECRET=doutor_paladar_secret_key_2026_mude_isso_em_producao
PORT=3000
```

---

## 📦 Passo 3 — Instalar dependências

```bash
cd backend
npm install
```

---

## 🚀 Passo 4 — Iniciar o servidor

```bash
node server.js
```

O servidor irá:
1. Conectar ao MySQL
2. Criar todas as tabelas automaticamente (se não existirem)
3. Inserir dados padrão (admin, horários, produtos de exemplo, configurações)
4. Iniciar em `http://localhost:3000`

---

## 🌐 Passo 5 — Acessar o sistema

| Tela | URL |
|------|-----|
| Cardápio (cliente) | http://localhost:3000 |
| Painel Admin | http://localhost:3000/admin.html |
| PDV | http://localhost:3000/pdv.html |

---

## 🔐 Credenciais padrão

| Tipo | Usuário | Senha |
|------|---------|-------|
| Admin | `admin` | `admin123` |

**Acesso admin:** Na tela principal, use o Konami Code:
```
⬆️ ⬆️ ⬇️ ⬇️ ⬅️ ➡️ ⬅️ ➡️ Espaço Enter
```

Ou clique no botão 🔑 no canto superior direito da tela inicial.

---

## 🕐 Horários de funcionamento padrão

| Período | Horário |
|---------|---------|
| Almoço 1 | 13:00 – 13:30 |
| Almoço 2 | 13:30 – 14:00 |
| Jantar 1 | 20:40 – 21:10 |
| Jantar 2 | 21:10 – 21:40 |

---

## 🎯 Funcionalidades

### 👤 Cliente
- Cardápio com categorias, busca e imagens
- Carrinho de compras
- Cadastro com validação de senha forte (6+ chars, 1 número, 1 símbolo)
- Login com usuário ou telefone
- Histórico de pedidos com status em tempo real
- Chat ao vivo com o admin
- Easter Eggs:
  - 5 cliques no logo → mensagem secreta
  - Digite `lua` na busca → fundo estrelado
  - Peça Coxinha + Suco + Brigadeiro → combo especial
  - 3 pedidos → selo VIP 🌟

### 🛡️ Administrador
- **Dashboard** com gráficos Chart.js (vendas, categorias, formas de pagamento, top produtos)
- **Gestão de Pedidos** com fluxo: pendente → confirmado → preparando → pronto → entregue
- **PDV** com categorias, busca, carrinho e suporte a conta (fiado)
- **Estoque** — CRUD completo de produtos com alerta de estoque mínimo
- **Contas a Receber (Fiado)** — cadastro de clientes, registro de dívidas e pagamentos
- **Despesas** — registro por categoria com filtros
- **Fornecedores** — cadastro e controle de pedidos de compra
- **Agendamentos** — horários de funcionamento com limite de pedidos
- **Desempenhos** — relatórios e gráficos de vendas
- **Chat** — conversas com clientes em tempo real (Socket.io)
- **Configurações** — nome da cantina, metas, horários, senha do admin

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js + Express |
| Banco de dados | MySQL (mysql2/promise) |
| Autenticação | JWT + bcryptjs |
| Tempo real | Socket.io |
| Frontend | HTML5 + CSS3 + JavaScript |
| Gráficos | Chart.js |
| Ícones | Font Awesome 6 |
| Fontes | Google Fonts (Inter) |

---

## 📁 Estrutura do Projeto

```
SistemaDoutorPaladar/
├── backend/
│   ├── routes/
│   │   ├── auth.js          — Login do admin
│   │   ├── clientes_app.js  — Cadastro/login de clientes
│   │   ├── produtos.js      — CRUD de produtos
│   │   ├── vendas.js        — PDV e estatísticas
│   │   ├── pedidos.js       — Gestão de pedidos
│   │   ├── fiado.js         — Contas a receber
│   │   ├── despesas.js      — Controle de despesas
│   │   ├── agendamentos.js  — Horários de funcionamento
│   │   ├── fornecedores.js  — Gestão de fornecedores
│   │   ├── configuracoes.js — Configurações do sistema
│   │   └── chat.js          — Chat em tempo real
│   ├── database.js          — Conexão MySQL + criação de tabelas
│   ├── authMiddleware.js    — Middleware JWT
│   ├── server.js            — Servidor principal
│   ├── seed.js              — Script de seed independente
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html           — Cardápio público
│   ├── admin.html           — Painel administrativo
│   ├── pdv.html             — Ponto de Venda
│   ├── pedidos.html         — Pedidos do cliente
│   ├── pedidos-admin.html   — Gestão de pedidos (admin)
│   ├── contas-receber.html  — Fiado
│   ├── despesas.html        — Despesas
│   ├── fornecedores.html    — Fornecedores
│   ├── agendamentos.html    — Agendamentos
│   ├── desempenhos.html     — Relatórios
│   ├── configuracoes.html   — Configurações
│   ├── estoque.html         — Estoque
│   ├── chat.html            — Chat
│   ├── css/style.css
│   └── js/
│       ├── api.js           — Funções de API
│       ├── auth.js          — Autenticação
│       ├── dashboard.js     — Dashboard
│       ├── pdv.js           — PDV
│       ├── despesas.js      — Despesas
│       ├── chat.js          — Chat
│       └── contas-receber.js
└── README.md
```

---

## 🐛 Correções aplicadas nesta versão

- ✅ `atualizarUI is not defined` — refatorado
- ✅ `renderProdutos` chamada antes dos produtos carregarem — corrigido
- ✅ `p.preco.toFixed is not a function` — parseFloat em todos os preços
- ✅ `Router.use() requires a middleware but got Object` — rotas exportadas corretamente
- ✅ `req.db.prepare is not a function` — removidos todos os vestígios de SQLite
- ✅ Sidebar do admin agora fica fixa ao rolar (position: fixed)
- ✅ Token salvo como `token` (não `admin_token`) em todos os lugares
- ✅ Autenticação do admin usa API real (não mais hardcoded)
- ✅ Chat atualizado com Socket.io (tempo real) + fallback polling
- ✅ Persistência real no banco para: despesas, clientes fiado, fornecedores, agendamentos, configurações
- ✅ Datas normalizadas para MySQL DATETIME em todas as rotas
