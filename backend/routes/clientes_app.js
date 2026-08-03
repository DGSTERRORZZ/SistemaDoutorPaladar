const bcrypt = require('bcryptjs');
const { query, execute } = require('../database');
const { generateToken, SECRET } = require('../authMiddleware');
const jwt = require('jsonwebtoken');

async function cadastrar(req, res) {
  const { nome, usuario, telefone, turma, senha } = req.body;
  if (!nome || !usuario || !telefone || !senha) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }
  if (senha.length < 6 || !/[0-9]/.test(senha) || !/[!@#$%^&*(),.?":{}|<>]/.test(senha)) {
    return res.status(400).json({ erro: 'Senha deve ter mínimo 6 caracteres, 1 número e 1 símbolo' });
  }
  try {
    const usuarioExistente = await query('SELECT id FROM clientes_app WHERE usuario = ?', [usuario]);
    if (usuarioExistente.length > 0) return res.status(400).json({ erro: 'Usuário já cadastrado' });
    const telefoneExistente = await query('SELECT id FROM clientes_app WHERE telefone = ?', [telefone]);
    if (telefoneExistente.length > 0) return res.status(400).json({ erro: 'Telefone já cadastrado' });
    const senha_hash = bcrypt.hashSync(senha, 10);
    const dataCadastro = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await execute(
      'INSERT INTO clientes_app (nome, usuario, telefone, turma, senha_hash, dataCadastro) VALUES (?, ?, ?, ?, ?, ?)',
      [nome, usuario, telefone, turma || '', senha_hash, dataCadastro]
    );
    res.status(201).json({ sucesso: true, mensagem: 'Cadastro realizado com sucesso!' });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

async function login(req, res) {
  const { login: loginField, senha } = req.body;
  if (!loginField || !senha) return res.status(400).json({ erro: 'Usuário/telefone e senha são obrigatórios' });
  try {
    const users = await query('SELECT * FROM clientes_app WHERE usuario = ? OR telefone = ?', [loginField, loginField]);
    if (users.length === 0) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const user = users[0];
    const senhaValida = bcrypt.compareSync(senha, user.senha_hash);
    if (!senhaValida) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const token = generateToken({ id: user.id, nome: user.nome, tipo: 'cliente' });
    res.json({ token, id: user.id, nome: user.nome, usuario: user.usuario, telefone: user.telefone, turma: user.turma, foto: user.foto || '' });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

async function getPerfil(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ erro: 'Token não fornecido' });
    const decoded = jwt.verify(token, SECRET);
    const users = await query('SELECT id, nome, usuario, telefone, turma, foto, dataCadastro, totalPedidos FROM clientes_app WHERE id = ?', [decoded.id]);
    if (users.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(users[0]);
  } catch (error) {
    res.status(401).json({ erro: 'Token inválido' });
  }
}

async function alterarSenha(req, res) {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha) return res.status(400).json({ erro: 'Senha atual e nova senha são obrigatórias' });
  if (novaSenha.length < 6 || !/[0-9]/.test(novaSenha) || !/[!@#$%^&*(),.?":{}|<>]/.test(novaSenha)) {
    return res.status(400).json({ erro: 'Nova senha deve ter mínimo 6 caracteres, 1 número e 1 símbolo' });
  }
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, SECRET);
    const users = await query('SELECT senha_hash FROM clientes_app WHERE id = ?', [decoded.id]);
    if (users.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
    if (!bcrypt.compareSync(senhaAtual, users[0].senha_hash)) return res.status(401).json({ erro: 'Senha atual incorreta' });
    const novaSenhaHash = bcrypt.hashSync(novaSenha, 10);
    await execute('UPDATE clientes_app SET senha_hash = ? WHERE id = ?', [novaSenhaHash, decoded.id]);
    res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso!' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao alterar senha' });
  }
}

async function atualizarPerfil(req, res) {
  const { nome, telefone, turma, foto } = req.body;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, SECRET);
    const updates = [];
    const params = [];
    if (nome) { updates.push('nome = ?'); params.push(nome); }
    if (telefone) { updates.push('telefone = ?'); params.push(telefone); }
    if (turma !== undefined) { updates.push('turma = ?'); params.push(turma); }
    if (foto !== undefined) { updates.push('foto = ?'); params.push(foto); }
    if (updates.length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar' });
    params.push(decoded.id);
    await execute(`UPDATE clientes_app SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ sucesso: true, mensagem: 'Perfil atualizado!' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar perfil' });
  }
}

async function getHistoricoPedidos(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ erro: 'Token não fornecido' });
    const decoded = jwt.verify(token, SECRET);
    const pedidos = await query(
      'SELECT * FROM pedidos WHERE clienteAppId = ? ORDER BY id DESC LIMIT 20',
      [decoded.id]
    );
    for (const pedido of pedidos) {
      pedido.itens = await query('SELECT * FROM itens_pedido WHERE pedidoId = ?', [pedido.id]);
      pedido.total = parseFloat(pedido.total);
      pedido.itens.forEach(item => { item.precoUnitario = parseFloat(item.precoUnitario); });
    }
    res.json(pedidos);
  } catch (error) {
    res.status(401).json({ erro: 'Erro ao buscar pedidos' });
  }
}

module.exports = { cadastrar, login, getPerfil, alterarSenha, atualizarPerfil, getHistoricoPedidos };
