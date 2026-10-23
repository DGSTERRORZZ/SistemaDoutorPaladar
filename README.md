# 🍔 Doutor Paladar — Sistema de Gestão de Cantina Escolar

Sistema completo de gestão comercial, financeira e pedidos para cantina escolar, com backend em **Node.js + MySQL** e frontend responsivo em **HTML5/CSS3/JavaScript**.

---

## 🌐 Acesso em Produção (Nuvem)

O sistema está implantado e disponível 24/7 com certificado SSL seguro:

- **Link Oficial:** [https://sistemadoutorpaladar.onrender.com](https://sistemadoutorpaladar.onrender.com)
- **Cardápio Digital (Clientes/Alunos):** `https://sistemadoutorpaladar.onrender.com/cardapio.html`
- **Painel Administrativo:** `https://sistemadoutorpaladar.onrender.com/admin.html`
- **Frente de Caixa (PDV):** `https://sistemadoutorpaladar.onrender.com/pdv.html`

> **Credenciais Padrão do Administrador:**  
> - **Usuário:** `admin`  
> - **Senha:** `admin123`

---

## 🏗️ Arquitetura do Projeto

```text
SistemaDoutorPaladar/
├── backend/                  # API RESTful e WebSocket (Node.js/Express)
│   ├── certs/                # Certificados SSL para ambiente local
│   ├── middleware/           # Autenticação, sanitização e tratamento de erros
│   ├── routes/               # Rotas modulares (produtos, pedidos, pix, auth, etc.)
│   ├── scripts/              # Utilitários e histórico de migrações
│   ├── utils/                # Sistema de logging e auxiliares
│   ├── database.js           # Gerenciador de conexão MySQL e auto-migrações
│   ├── server.js             # Ponto de entrada do servidor HTTP/HTTPS
│   ├── package.json          # Dependências do backend
│   └── .env.example          # Modelo de configuração de ambiente
│
├── frontend/                 # Interface do Usuário (Vanilla HTML/CSS/JS)
│   ├── css/                  # Estilos globais, temas e responsividade
│   ├── js/                   # Controladores de tela, integração API e Socket.io
│   ├── imagens/              # Logotipos, ícones e fotos de produtos
│   ├── admin.html            # Painel gerencial e dashboard
│   ├── cardapio.html         # Cardápio digital com carrinho e agendamento
│   ├── pdv.html              # Caixa rápido / Ponto de Venda balcão
│   ├── index.html            # Landing page institucional
│   └── login.html            # Autenticação de clientes e colaboradores
│
├── backup_banco_doutor_paladar.sql  # Backup base para restauração
├── DEPLOY.md                 # Guia detalhado de deploy em VPS e nuvem
└── README.md                 # Documentação principal
```

---

## 🚀 Execução Local

### 1. Pré-requisitos
- [Node.js](https://nodejs.org/) v18 ou superior
- [MySQL](https://www.mysql.com/) 8.0 ou superior

### 2. Configurar o Banco de Dados
Acesse o MySQL e execute:
```sql
CREATE DATABASE IF NOT EXISTS doutor_paladar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'doutor_user'@'localhost' IDENTIFIED BY 'Doutor@2026';
GRANT ALL PRIVILEGES ON doutor_paladar.* TO 'doutor_user'@'localhost';
FLUSH PRIVILEGES;
```

> **Nota:** As tabelas, colunas, chaves estrangeiras e dados iniciais (produtos oficiais e admin) são verificados e criados **automaticamente** ao iniciar o servidor.

### 3. Configurar o Ambiente
Na pasta `backend/`, crie o arquivo `.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=doutor_user
DB_PASS=Doutor@2026
DB_NAME=doutor_paladar
PORT=3000
JWT_SECRET=sua_chave_secreta_jwt_aqui
```

### 4. Instalar e Iniciar
```bash
cd backend
npm install
npm start
```
Acesse localmente em: **`https://localhost:3000`**

---

## 📦 Deploy Contínuo (CI/CD)

O repositório está integrado diretamente ao **Render** e ao **TiDB Cloud**:
1. Toda alteração enviada para o GitHub (`git push origin Valmir` ou `master`) dispara um deploy automático.
2. Em menos de 2 minutos, a nova versão entra no ar sem interrupção de dados.

---

## 🛡️ Tecnologias Utilizadas

- **Backend:** Node.js, Express.js, Socket.IO (atualização em tempo real), MySQL2, Helmet, JWT, Bcrypt.
- **Frontend:** HTML5 Semântico, CSS3 Moderno (Custom Properties, Flexbox, Grid), JavaScript (ES6+).
- **Banco de Dados:** MySQL 8.0 (Local) e TiDB Cloud Serverless (Nuvem).
- **Hospedagem:** Render.com.
