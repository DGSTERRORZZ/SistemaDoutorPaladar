# Segurança — branch Valmir

## Configuração antes de iniciar

1. Configure um banco **de testes** e copie \`backend/.env.example\` para \`backend/.env\` (nunca versionar a chave).
2. Defina \`DB_PASS\`, \`JWT_SECRET\` (mínimo 32 bytes aleatórios) e \`ENCRYPTION_KEY\` (32 bytes em base64). Geração: \`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"\`.
3. Reinicie o backend. O esquema cria \`two_factor_secret\`, \`two_factor_last_step\` e a tabela \`dispositivos_confiaveis_2fa\` se faltarem.
4. Configure TOTP para cada administrador: \`cd backend && node scripts/configurar_2fa_admin.js NOME_USUARIO\`. Cadastre a chave em app autenticador (Google Authenticator, Microsoft Authenticator etc.). Guarde o segredo fora do GitHub. O backend não devolve o segredo nem o código no login.
5. Execute \`cd backend && npm test\`; para teste de integração, use um MySQL isolado e contas de teste. Os testes unitários **não** equivalem a um pentest.

## Regras e limitações
- Senhas: novos cadastros e alterações usam bcrypt; executar a rota restrita de auditoria para verificar registros legados. Hash já vazado não pode ser recuperado: trocar senhas comprometidas.
- Alçadas: \`verificarAlcada('supervisor')\` verifica no banco a função atual. \`verifyAdmin\` consulta o papel no banco, não aceita permissão vinda do navegador. Revisar rotas administrativas existentes para aplicar alçadas mais específicas.
- 2FA: TOTP com tolerância de um passo de 30 segundos, sem reutilização do mesmo passo; trava de 5 erros / 15 min, adicional ao limitador de IP. Dispositivo confiável por 7 dias com cookie HttpOnly. A confiança é **por navegador**, não por conta.
- Em produção use **HTTPS** (cookie Secure), CSP apropriada, proxy reverso confiável e proteção de CSRF para endpoints com cookies. Não configurar trust proxy genericamente.
- Criptografia: relatórios e segredo TOTP em AES-256-GCM. A chave é necessária para decifrar os dados; perda da chave significa perda dos relatórios. A cifra não é criptografia ponta a ponta.
- SQL injection: a rota de demonstração executa somente prepared statement, sem simulação vulnerável no banco. Auditoria ampla de todas as queries, DAST e revisão de infraestrutura continuam necessários. \`simular-bruteforce\` também é apenas simulação, sem bloquear conta real.
- Países: \`GEOIP_COUNTRY_CIDRS\` contém **faixas explicitamente definidas**. IP sem mapeamento é XX e não é bloqueado por localização. Para países reais, obter uma base geográfica licenciada/atualizada e integrar de forma apropriada; os CIDRs do exemplo são de documentação, não dados geográficos reais.
- Blacklist: endpoint administrativo aceita somente IPv4/IPv6 válido; comparação exata (não CIDR). Nunca confiar no \`X-Forwarded-For\` enviado diretamente por clientes.
- A antiga recuperação de senha baseada apenas em usuário/telefone foi desligada. Antes de reativar, criar confirmação de e-mail/SMS por token aleatório, com expiração, uso único e limitação de tentativas.
- Bootstrap de administrador com senha conhecida foi removido. Provisionar administrador em ambiente seguro; não incluir senhas no código.

## Casos que exigem validação integrada
- Cadastro público tentando \`tipo=administrador\` deve criar cliente.
- Login administrativo precisa de senha + TOTP, salvo cookie confiável válido; segundo dispositivo pede código.
- TOTP repetido/rejeitado, conta bloqueada, blacklist e restrições geográficas devem resultar em negativa.
- Relatório adulterado não pode ser decifrado; payload SQL malicioso não deve devolver credenciais ou dados sensíveis.

**Nota:** A proteção em código precisa ser ativada e testada em ambiente de homologação antes de produção. Migrações, configurações, contas existentes, proxies e certificados devem ser validados separadamente.
