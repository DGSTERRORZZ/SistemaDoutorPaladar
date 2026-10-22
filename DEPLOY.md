# 🚀 Guia de Hospedagem & Deploy — Sistema Doutor Paladar

Este guia detalha o passo a passo completo para colocar o **Sistema Doutor Paladar** em produção na nuvem de forma segura, com banco de dados MySQL gerenciado, backend Node.js resiliente com Socket.io e frontend web com suporte a conexões seguras HTTPS/WSS.

---

## 1. Arquitetura do Sistema

- **Backend:** Node.js (v18+) com Express, Helmet, CORS, Rate Limit, Socket.io e MySQL2.
- **Frontend:** HTML5, CSS3 moderno (Vanilla com design tokens e variáveis), JavaScript moderno.
- **Banco de Dados:** MySQL 8.0+.
- **Integração:** Mercado Pago (PIX com Webhook e Checkout Pro).

---

## 2. Opções Recomendadas de Hospedagem

| Provedor | Modelo | Vantagens | Custo |
| :--- | :--- | :--- | :--- |
| **Railway** | PaaS (Backend + MySQL) | Deploy com 1 clique do GitHub, MySQL gerenciado, variáveis de ambiente fáceis, suporte total a WebSocket | Grátis / ~$5/mês |
| **Render** | PaaS (Web Service) | Deploy automático de repositório Git, certificado SSL automático grátis | Grátis / ~$7/mês |
| **VPS (DigitalOcean / Linode / Oracle Cloud)** | IaaS (Ubuntu + Docker / PM2 + Nginx) | Controle total, melhor custo-benefício para alto tráfego escolar | A partir de $4 a $6/mês |

---

## 3. Passo a Passo: Deploy na Railway (Opção Mais Rápida e Fácil)

### Passo 1: Criar o Banco de Dados MySQL
1. Acesse [railway.app](https://railway.app) e crie uma conta.
2. Clique em **New Project** > **Provision MySQL**.
3. Na aba **Variables** do serviço MySQL, anote as credenciais:
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE`

### Passo 2: Criar o Serviço Node.js do Backend
1. No mesmo projeto, clique em **+ New** > **GitHub Repo** e selecione o repositório do Sistema Doutor Paladar.
2. Defina o **Root Directory** como `/SistemaDoutorPaladar-Valmir/backend` (ou caminho correspondente).
3. Na aba **Variables**, configure as seguintes variáveis:
   ```env
   PORT=3000
   NODE_ENV=production
   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_USER=${{MySQL.MYSQLUSER}}
   DB_PASS=${{MySQL.MYSQLPASSWORD}}
   DB_NAME=${{MySQL.MYSQLDATABASE}}
   JWT_SECRET=sua_chave_secreta_jwt_longa_e_aleatoria_aqui
   MERCADOPAGO_ACCESS_TOKEN=seu_access_token_do_mercadopago_aqui
   MERCADOPAGO_PUBLIC_KEY=sua_public_key_aqui
   WEBHOOK_URL=https://seu-dominio-backend.up.railway.app/api/pix/webhook
   ```
4. O Railway fará o build (`npm install`) e iniciará com `npm start`.

---

## 4. Passo a Passo: Deploy em VPS Linux (Ubuntu 22.04 / 24.04 com PM2 + Nginx)

Para cantinas escolares ou instituições de ensino que preferem servidor próprio ou VPS dedicada:

### Passo 1: Atualizar o Servidor e Instalar Pacotes
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx mysql-server ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### Passo 2: Configurar o MySQL Seguro
```bash
sudo mysql_secure_installation
sudo mysql -u root -p
```
No terminal do MySQL:
```sql
CREATE DATABASE IF NOT EXISTS cantina_doutor_paladar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cantina_user'@'localhost' IDENTIFIED BY 'SenhaForte123!#';
GRANT ALL PRIVILEGES ON cantina_doutor_paladar.* TO 'cantina_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Passo 3: Clonar o Projeto e Configurar o `.env`
```bash
cd /var/www
sudo git clone https://github.com/seu-usuario/doutor-paladar.git
cd doutor-paladar/SistemaDoutorPaladar-Valmir/backend
npm install --production
cp .env.example .env
nano .env
```
Preencha o `.env` com as credenciais do banco local configuradas acima.

### Passo 4: Executar o Backend com PM2 (Process Manager)
```bash
pm2 start server.js --name "doutor-paladar-api"
pm2 save
pm2 startup
```

### Passo 5: Configurar o Nginx como Proxy Reverso com Suporte a WebSocket
Edite o arquivo `/etc/nginx/sites-available/doutor-paladar`:
```nginx
server {
    listen 80;
    server_name cantina.seudominio.com.br;

    # Frontend Estático
    root /var/www/doutor-paladar/SistemaDoutorPaladar-Valmir/frontend;
    index index.html cardapio.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Node.js
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSockets do Socket.io para pedidos em tempo real
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```
Ative a configuração:
```bash
sudo ln -s /etc/nginx/sites-available/doutor-paladar /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Passo 6: Certificado SSL Gratuito com Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d cantina.seudominio.com.br
```

---

## 5. Checklist de Segurança para Produção (Boas Práticas & OWASP)

1. ✅ **HTTPS Obrigatório:** Nunca trafegar senhas ou pagamentos sem SSL/TLS ativo.
2. ✅ **Variáveis de Ambiente:** Nunca versionar arquivos `.env` no Git.
3. ✅ **JWT_SECRET Complexo:** Utilizar chave aleatória com mais de 32 caracteres.
4. ✅ **Rate Limiting:** Ativo no backend contra ataques de força bruta no login.
5. ✅ **Helmet:** Cabeçalhos de segurança HTTP ativados no `backend/server.js`.
6. ✅ **Validação de Entrada:** Proteção contra SQL Injection (queries preparadas `?` no MySQL2).
7. ✅ **Backup Automático:** Agendar dump diário do MySQL com `cron`:
   ```bash
   0 3 * * * mysqldump -u cantina_user -p'SenhaForte123!#' cantina_doutor_paladar > /var/backups/cantina_$(date +\%F).sql
   ```
