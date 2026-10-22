-- BACKUP COMPLETO DO SISTEMA DOUTOR PALADAR
-- Data: 2026-09-21T15:57:45.941Z

SET FOREIGN_KEY_CHECKS = 0;

-- Tabela: usuarios (5 registros)
DELETE FROM usuarios;
INSERT INTO usuarios (id, nome, username, telefone, turma, senha_hash, tipo, foto, totalPedidos, pontosFidelidade, limiteCredito, saldoDevedor, dataCadastro) VALUES (1, 'Deyse Nayana', 'admin', NULL, '', '$2a$10$TEMf242BtS.nLlSzoSkCb.Z3XIXmIqKOiK3wd0D7JFAlQvh.WPeau', 'administrador', '', 0, 0, '50.00', '0.00', '2026-08-24 16:25:44');
INSERT INTO usuarios (id, nome, username, telefone, turma, senha_hash, tipo, foto, totalPedidos, pontosFidelidade, limiteCredito, saldoDevedor, dataCadastro) VALUES (2, 'Aluno Teste', 'alunoteste', '11999998888', '3A', '$2a$10$M2il9Elu2eShQoOxmNxi6e4HWKxgGSHlhC9lFiJDtWbV.akLnOV6u', 'cliente', '', 0, 0, '75.00', '35.00', '2026-08-24 16:31:29');
INSERT INTO usuarios (id, nome, username, telefone, turma, senha_hash, tipo, foto, totalPedidos, pontosFidelidade, limiteCredito, saldoDevedor, dataCadastro) VALUES (3, 'erick', 'holl', '23132142333', '3 INFO', '$2a$10$C1u1Vt9tKnwkUUWoAiWIOuQCEW57Mc9uTbh5xL6nTcet86raz2tNC', 'cliente', '', 1, 24, '50.00', '0.00', '2026-08-31 16:24:53');
INSERT INTO usuarios (id, nome, username, telefone, turma, senha_hash, tipo, foto, totalPedidos, pontosFidelidade, limiteCredito, saldoDevedor, dataCadastro) VALUES (4, 'Valmir Pereira', 'terroz', '12997360623', '3 INFO', '$2a$10$vfMAtrhyeWx2snZ3LDYydOKnREjwxGd8I1h.NqGF1R3JWUqPz8mIC', 'cliente', '', 2, 39, '50.00', '0.00', '2026-08-31 17:03:38');
INSERT INTO usuarios (id, nome, username, telefone, turma, senha_hash, tipo, foto, totalPedidos, pontosFidelidade, limiteCredito, saldoDevedor, dataCadastro) VALUES (5, 'Valmir Pereira Da Rosa Filho', 'valmir1x', '12999999999', 'Visitante / Externo', '$2a$10$WU.Z0f23qrQio1S.FJGd/O5wJ9hNud6hPwCONvB0jFmitp1V5CsHe', 'cliente', '', 0, 0, '50.00', '0.00', '2026-09-21 14:18:10');

-- Tabela: fornecedores (1 registros)
DELETE FROM fornecedores;
INSERT INTO fornecedores (id, nome, cnpj, telefone, email, endereco) VALUES (3, 'Acarajé Santista', '43242323498', '1231334234', 'acarajesantista@gmail.com', 'Rua Belterra, 91');

-- Tabela: produtos (56 registros)
DELETE FROM produtos;
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (1, 'Hambúrgão Cheddar', 'Salgados', '8.00', 12, 5, NULL, 'imagens/hamburgao_cheddar.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (2, 'Hambúrgão c/ Bacon', 'Salgados', '9.00', 20, 5, NULL, 'imagens/hamburgao_bacon.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (3, 'Coxinha de Frango', 'Salgados', '5.50', 20, 10, NULL, 'imagens/coxinha_frango.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (5, 'Risolis de Queijo', 'Salgados', '5.00', 20, 10, NULL, 'imagens/risolis.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (6, 'Risolis de Carne', 'Salgados', '5.00', 20, 10, NULL, 'imagens/risolis.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (7, 'Esfiha de Carne', 'Salgados', '4.50', 20, 10, NULL, 'imagens/esfiha_carne.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (8, 'Pão de Queijo', 'Salgados', '4.00', 28, 15, NULL, 'imagens/pao_de_queijo.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (9, 'Pão Batata Frango', 'Salgados', '6.00', 20, 5, NULL, 'imagens/pao_batata_frango.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (10, 'Pão Batata Calabresa', 'Salgados', '6.00', 20, 5, NULL, 'imagens/pao_batata_calabresa.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (11, 'Enroladinho Bauru', 'Salgados', '5.00', 20, 10, NULL, 'imagens/enroladinho_bauru.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (12, 'Enroladinho Salsicha', 'Salgados', '5.00', 15, 10, NULL, 'imagens/enroladinho_salsicha.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (13, 'Pizza Enrolada', 'Salgados', '6.00', 20, 5, NULL, 'imagens/enroladinho_bauru.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (14, 'Kibe', 'Salgados', '5.00', 20, 10, NULL, 'imagens/kibe.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (51, 'Croissant de Chocolate', 'Doces', '8.00', 19, 5, NULL, 'imagens/croissant.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (15, 'Coca-Cola Lata 350ml', 'Bebidas', '7.00', 60, 20, NULL, 'imagens/coca_cola_lata_350ml.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (16, 'Coca-Cola Pet 600ml', 'Bebidas', '7.00', 57, 20, NULL, 'imagens/coca_cola_pet_600ml.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (17, 'Coca-Cola Zero 350ml', 'Bebidas', '7.00', 36, 10, NULL, 'imagens/coca_cola_zero_350ml.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (18, 'Coca-Cola Zero 200ml', 'Bebidas', '5.00', 72, 15, NULL, 'imagens/coca_cola_zero_200ml.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (19, 'Sprite Lata 350ml', 'Bebidas', '6.00', 21, 10, NULL, 'imagens/sprite_lata_350ml.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (20, 'Guaraná Antarctica Zero Lata', 'Bebidas', '5.00', 56, 20, NULL, 'imagens/guarana_antarctica_zero_lata.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (21, 'Água Passa Quatro c/ Gás', 'Bebidas', '4.00', 35, 15, NULL, 'imagens/agua_passa_quatro_sem_gas.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (22, 'Água Passa Quatro s/ Gás', 'Bebidas', '4.00', 48, 15, NULL, 'imagens/agua_passa_quatro_sem_gas.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (23, 'Suco K-mais Integral 300ml', 'Bebidas', '5.00', 36, 10, NULL, 'imagens/suco_kmais_caju_300ml.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (24, 'Suco K-mais Uva 300ml', 'Bebidas', '5.00', 12, 5, NULL, 'imagens/suco_kmais_caju_300ml.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (25, 'Suco K-mais Goiaba 300ml', 'Bebidas', '5.00', 12, 5, NULL, 'imagens/suco_kmais_caju_300ml.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (26, 'Suco K-mais Caju 300ml', 'Bebidas', '5.00', 11, 5, NULL, 'imagens/suco_kmais_caju_300ml.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (27, 'Café Coado (copo)', 'Bebidas', '3.00', 96, 20, NULL, 'imagens/cafe_coado.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (28, 'Cremosinho Sorvete Iogurte', 'Doces', '2.50', 30, 10, NULL, 'imagens/cremosinho.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (29, 'Geladão de Açaí', 'Doces', '7.00', 10, 5, NULL, 'imagens/geladao.jpg', 0);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (30, 'Trento Chocolate', 'Doces', '3.50', 24, 10, NULL, 'imagens/trento_chocolate.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (31, 'Trento Branco', 'Doces', '3.50', 24, 10, NULL, 'imagens/trento_chocolate.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (32, 'Pão de Mel 50g', 'Doces', '4.00', 20, 10, NULL, 'imagens/pao_de_mel_50g.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (34, 'Caldo Sopa de Legumes', 'Caldos', '20.00', 5, 2, NULL, 'imagens/caldo_sopa_legumes.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (35, 'Caldo Mandioquinha c/ Frango', 'Caldos', '20.00', 5, 2, NULL, 'imagens/caldo_mandioquinha_frango.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (36, 'Caldo de Abóbora Seca Barriga', 'Caldos', '20.00', 5, 2, NULL, 'imagens/caldo_abobora.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (37, 'Caldo Verde c/ Carne', 'Caldos', '20.00', 5, 2, NULL, 'imagens/caldo_verde_carne.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (38, 'Caldo Vaca Atolada', 'Caldos', '20.00', 5, 2, NULL, 'imagens/caldo_vaca_atolada.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (39, 'Halls Melancia', 'Doces', '2.00', 21, 5, NULL, 'imagens/halls.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (50, 'Croissant de Queijo', 'Salgados', '7.50', 20, 5, NULL, 'imagens/croissant.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (40, 'Halls Morango', 'Doces', '2.00', 21, 5, NULL, 'imagens/halls.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (41, 'Halls Menta', 'Doces', '2.00', 21, 5, NULL, 'imagens/halls.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (42, 'Trident Hortela', 'Doces', '2.50', 21, 5, NULL, 'imagens/trident.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (43, 'Trident Morango', 'Doces', '2.50', 21, 5, NULL, 'imagens/trident.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (44, 'Trident Tutti Frutti', 'Doces', '2.50', 21, 5, NULL, 'imagens/trident.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (45, 'Cremosinho Abacaxi', 'Doces', '4.00', 29, 5, NULL, 'imagens/cremosinho.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (46, 'Cremosinho Maracujá', 'Doces', '4.00', 30, 5, NULL, 'imagens/cremosinho.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (47, 'Cremosinho Morango', 'Doces', '4.00', 30, 5, NULL, 'imagens/cremosinho.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (52, 'Geladão de Açaí - Leite Condensado', 'Doces', '7.00', 20, 5, NULL, 'imagens/geladao.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (49, 'Croissant de Frango', 'Salgados', '7.50', 20, 5, NULL, 'imagens/croissant.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (53, 'Geladão de Açaí - Leite Ninho', 'Doces', '7.00', 20, 5, NULL, 'imagens/geladao.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (54, 'Geladão de Açaí - Maracujá', 'Doces', '7.00', 20, 5, NULL, 'imagens/geladao.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (55, 'Geladão de Açaí - Morango', 'Doces', '7.00', 20, 5, NULL, 'imagens/geladao.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (56, 'Trento Avelã', 'Doces', '3.50', 20, 5, NULL, 'imagens/trento_chocolate.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (57, 'Trento Dark 55%', 'Doces', '3.50', 20, 5, NULL, 'imagens/trento_chocolate.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (58, 'Trento Maracujá', 'Doces', '3.50', 20, 5, NULL, 'imagens/trento_chocolate.jpg', 1);
INSERT INTO produtos (id, nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem, ativo) VALUES (59, 'Trento Torta de Limão', 'Doces', '3.50', 20, 5, NULL, 'imagens/trento_chocolate.jpg', 1);

-- Tabela: pedidos (6 registros)
DELETE FROM pedidos;
INSERT INTO pedidos (id, clienteAppId, nomeCliente, turma, mesa, formaPagamento, horarioRetirada, total, status, data, observacao, canal, subtotal, desconto, descontoPontos, pontosUsados, cupomCodigo, promocaoId) VALUES (1, 3, 'erick', '', NULL, 'pix', 'Em breve', '14.00', 'entregue', '2026-08-31 16:52:19', NULL, 'app', '0.00', '0.00', '0.00', 0, NULL, NULL);
INSERT INTO pedidos (id, clienteAppId, nomeCliente, turma, mesa, formaPagamento, horarioRetirada, total, status, data, observacao, canal, subtotal, desconto, descontoPontos, pontosUsados, cupomCodigo, promocaoId) VALUES (2, 4, 'Valmir Pereira', '', NULL, 'dinheiro', 'Em breve', '15.00', 'entregue', '2026-08-31 17:04:37', 'Telefone: 12997360623', 'app', '0.00', '0.00', '0.00', 0, NULL, NULL);
INSERT INTO pedidos (id, clienteAppId, nomeCliente, turma, mesa, formaPagamento, horarioRetirada, total, status, data, observacao, canal, subtotal, desconto, descontoPontos, pontosUsados, cupomCodigo, promocaoId) VALUES (3, 4, 'Valmir Pereira', '', NULL, 'dinheiro', 'Em breve', '4.00', 'entregue', '2026-09-14 15:42:07', 'Telefone: 12997360623', 'app', '0.00', '0.00', '0.00', 0, NULL, NULL);
INSERT INTO pedidos (id, clienteAppId, nomeCliente, turma, mesa, formaPagamento, horarioRetirada, total, status, data, observacao, canal, subtotal, desconto, descontoPontos, pontosUsados, cupomCodigo, promocaoId) VALUES (4, NULL, 'Samuel Branco', '', NULL, 'pix', 'Em breve', '45.00', 'entregue', '2026-09-14 21:12:28', 'Telefone: 12453535353', 'app', '0.00', '0.00', '0.00', 0, NULL, NULL);
INSERT INTO pedidos (id, clienteAppId, nomeCliente, turma, mesa, formaPagamento, horarioRetirada, total, status, data, observacao, canal, subtotal, desconto, descontoPontos, pontosUsados, cupomCodigo, promocaoId) VALUES (5, 5, 'Valmir Filho', '', NULL, 'pix', 'Em breve', '17.10', 'pendente', '2026-09-21 14:52:49', 'Telefone: 12999999999', 'app', '19.00', '1.90', '0.00', 0, 'BEMVINDO10', 1);
INSERT INTO pedidos (id, clienteAppId, nomeCliente, turma, mesa, formaPagamento, horarioRetirada, total, status, data, observacao, canal, subtotal, desconto, descontoPontos, pontosUsados, cupomCodigo, promocaoId) VALUES (6, 2, 'Aluno Teste', '', NULL, 'fiado', 'Em breve', '20.00', 'pendente', '2026-09-21 18:44:41', NULL, 'app', '20.00', '0.00', '0.00', 0, NULL, NULL);

-- Tabela: itens_pedido (13 registros)
DELETE FROM itens_pedido;
INSERT INTO itens_pedido (id, pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (1, 1, 16, 'Coca-Cola Pet 600ml', 2, '7.00');
INSERT INTO itens_pedido (id, pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (2, 2, 16, 'Coca-Cola Pet 600ml', 1, '7.00');
INSERT INTO itens_pedido (id, pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (3, 2, 26, 'Suco K-mais Caju 300ml', 1, '5.00');
INSERT INTO itens_pedido (id, pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (4, 2, 27, 'Café Coado (copo)', 1, '3.00');
INSERT INTO itens_pedido (id, pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (5, 3, 45, 'Cremosinho Abacaxi', 1, '4.00');
INSERT INTO itens_pedido (id, pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (6, 4, 20, 'Guaraná Antarctica Zero Lata', 4, '5.00');
INSERT INTO itens_pedido (id, pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (7, 4, 19, 'Sprite Lata 350ml', 3, '6.00');
INSERT INTO itens_pedido (id, pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (8, 4, 27, 'Café Coado (copo)', 1, '3.00');
INSERT INTO itens_pedido (id, pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (9, 4, 21, 'Água Passa Quatro c/ Gás', 1, '4.00');
INSERT INTO itens_pedido (id, pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (10, 5, 51, 'Croissant de Chocolate', 1, '8.00');
INSERT INTO itens_pedido (id, pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (11, 5, 27, 'Café Coado (copo)', 1, '3.00');
INSERT INTO itens_pedido (id, pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (12, 5, 8, 'Pão de Queijo', 2, '4.00');
INSERT INTO itens_pedido (id, pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (13, 6, 1, '', 2, '10.00');

-- Tabela: pedidos_status_log (14 registros)
DELETE FROM pedidos_status_log;
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (1, 2, 'pendente', 'preparando', 'Gestor', '2026-08-31 17:06:49');
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (2, 1, 'pendente', 'preparando', 'Gestor', '2026-08-31 17:06:55');
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (3, 2, 'preparando', 'pronto', 'Gestor', '2026-08-31 17:06:56');
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (4, 1, 'preparando', 'pronto', 'Gestor', '2026-08-31 18:00:21');
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (5, 2, 'pronto', 'entregue', 'Gestor', '2026-08-31 18:00:22');
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (6, 1, 'pronto', 'entregue', 'Gestor', '2026-08-31 18:00:23');
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (7, 3, 'pendente', 'preparando', 'Gestor', '2026-09-14 16:57:44');
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (8, 3, 'preparando', 'pronto', 'Gestor', '2026-09-14 16:57:44');
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (9, 3, 'pronto', 'entregue', 'Gestor', '2026-09-14 16:57:46');
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (10, 4, 'pendente', 'preparando', 'Gestor', '2026-09-14 21:13:03');
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (11, 4, 'preparando', 'pronto', 'Gestor', '2026-09-14 21:13:04');
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (12, 4, 'pronto', 'entregue', 'Gestor', '2026-09-14 21:13:05');
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (13, 5, 'nenhum', 'pendente', 'Cliente / App', '2026-09-21 14:52:49');
INSERT INTO pedidos_status_log (id, pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (14, 6, 'nenhum', 'pendente', 'Cliente / App', '2026-09-21 18:44:41');

-- Tabela: vendas (6 registros)
DELETE FROM vendas;
INSERT INTO vendas (id, total, formaPagamento, data, pedidoId) VALUES (1, '15.00', 'dinheiro', '2026-08-31 17:04:37', 2);
INSERT INTO vendas (id, total, formaPagamento, data, pedidoId) VALUES (2, '14.00', 'pix', '2026-08-31 16:52:19', 1);
INSERT INTO vendas (id, total, formaPagamento, data, pedidoId) VALUES (3, '4.00', 'dinheiro', '2026-09-14 15:42:07', 3);
INSERT INTO vendas (id, total, formaPagamento, data, pedidoId) VALUES (4, '45.00', 'pix', '2026-09-14 21:12:28', 4);
INSERT INTO vendas (id, total, formaPagamento, data, pedidoId) VALUES (5, '15.00', 'a_prazo', '2026-09-21 18:42:48', NULL);
INSERT INTO vendas (id, total, formaPagamento, data, pedidoId) VALUES (6, '20.00', 'a_prazo', '2026-09-21 18:44:41', NULL);

-- Tabela: itens_venda (11 registros)
DELETE FROM itens_venda;
INSERT INTO itens_venda (id, vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (1, 1, 16, 'Coca-Cola Pet 600ml', 1, '7.00');
INSERT INTO itens_venda (id, vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (2, 1, 26, 'Suco K-mais Caju 300ml', 1, '5.00');
INSERT INTO itens_venda (id, vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (3, 1, 27, 'Café Coado (copo)', 1, '3.00');
INSERT INTO itens_venda (id, vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (4, 2, 16, 'Coca-Cola Pet 600ml', 2, '7.00');
INSERT INTO itens_venda (id, vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (5, 3, 45, 'Cremosinho Abacaxi', 1, '4.00');
INSERT INTO itens_venda (id, vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (6, 4, 20, 'Guaraná Antarctica Zero Lata', 4, '5.00');
INSERT INTO itens_venda (id, vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (7, 4, 19, 'Sprite Lata 350ml', 3, '6.00');
INSERT INTO itens_venda (id, vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (8, 4, 27, 'Café Coado (copo)', 1, '3.00');
INSERT INTO itens_venda (id, vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (9, 4, 21, 'Água Passa Quatro c/ Gás', 1, '4.00');
INSERT INTO itens_venda (id, vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (10, 5, 1, '', 1, '15.00');
INSERT INTO itens_venda (id, vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (11, 6, 1, '', 2, '10.00');

-- Tabela: dividas (2 registros)
DELETE FROM dividas;
INSERT INTO dividas (id, clienteId, data, total, valorPago, pago) VALUES (1, 2, '2026-09-21 18:42:48', '15.00', '0.00', 0);
INSERT INTO dividas (id, clienteId, data, total, valorPago, pago) VALUES (2, 2, '2026-09-21 18:44:41', '20.00', '0.00', 0);

-- Tabela: itens_divida (2 registros)
DELETE FROM itens_divida;
INSERT INTO itens_divida (id, dividaId, produtoId, quantidade, precoUnitario) VALUES (1, 1, 1, 1, '15.00');
INSERT INTO itens_divida (id, dividaId, produtoId, quantidade, precoUnitario) VALUES (2, 2, 1, 2, '10.00');

-- Tabela: agendamentos (4 registros)
DELETE FROM agendamentos;
INSERT INTO agendamentos (id, data, horario, pratoDoDia, vagasTotais, vagasOcupadas, preco, bloqueado, dataCriacao) VALUES (2, '2026-09-21 03:00:00', '12:00', 'Prato Feito Especial', 50, 0, '18.00', 0, '2026-08-17 12:00:08');
INSERT INTO agendamentos (id, data, horario, pratoDoDia, vagasTotais, vagasOcupadas, preco, bloqueado, dataCriacao) VALUES (3, '2026-09-21 03:00:00', '12:30', 'Almoço Light / Fitness', 50, 0, '18.00', 0, '2026-08-17 12:00:08');
INSERT INTO agendamentos (id, data, horario, pratoDoDia, vagasTotais, vagasOcupadas, preco, bloqueado, dataCriacao) VALUES (4, '2026-09-21 03:00:00', '13:00', 'Almoço Tradicional', 50, 0, '18.00', 0, '2026-08-17 12:00:08');
INSERT INTO agendamentos (id, data, horario, pratoDoDia, vagasTotais, vagasOcupadas, preco, bloqueado, dataCriacao) VALUES (5, '2026-09-21 03:00:00', '19:00', 'Jantar da Noite', 40, 0, '15.00', 0, '2026-08-17 12:00:08');

-- Tabela: historico_fidelidade (3 registros)
DELETE FROM historico_fidelidade;
INSERT INTO historico_fidelidade (id, clienteId, pedidoId, pontos, tipo, descricao, data) VALUES (1, 4, 2, 25, 'ganho', 'Pontos do Pedido #2', '2026-08-31 18:00:22');
INSERT INTO historico_fidelidade (id, clienteId, pedidoId, pontos, tipo, descricao, data) VALUES (2, 3, 1, 24, 'ganho', 'Pontos do Pedido #1', '2026-08-31 18:00:23');
INSERT INTO historico_fidelidade (id, clienteId, pedidoId, pontos, tipo, descricao, data) VALUES (3, 4, 3, 14, 'ganho', 'Pontos do Pedido #3', '2026-09-14 16:57:46');

-- Tabela: configuracoes (15 registros)
DELETE FROM configuracoes;
INSERT INTO configuracoes (id, chave, valor) VALUES (1, 'nome_cantina', 'Cantina Doutor Paladar - IFSP');
INSERT INTO configuracoes (id, chave, valor) VALUES (2, 'telefone_contato', '(11) 99999-9999');
INSERT INTO configuracoes (id, chave, valor) VALUES (3, 'email_contato', 'cantina@ifsp.edu.br');
INSERT INTO configuracoes (id, chave, valor) VALUES (4, 'endereco', 'Instituto Federal - Rua Principal, 100');
INSERT INTO configuracoes (id, chave, valor) VALUES (5, 'meta_diaria', '500.00');
INSERT INTO configuracoes (id, chave, valor) VALUES (6, 'aviso_cardapio', 'Seja bem-vindo à cantina! Faça seu pedido online ou escaneie o QR Code da mesa.');
INSERT INTO configuracoes (id, chave, valor) VALUES (7, 'fidelidade_ativa', '1');
INSERT INTO configuracoes (id, chave, valor) VALUES (8, 'fidelidade_taxa', '10');
INSERT INTO configuracoes (id, chave, valor) VALUES (9, 'fidelidade_resgate_min', '50');
INSERT INTO configuracoes (id, chave, valor) VALUES (10, 'fidelidade_valor_ponto', '0.10');
INSERT INTO configuracoes (id, chave, valor) VALUES (11, 'fidelidade_pedido_minimo', '5.00');
INSERT INTO configuracoes (id, chave, valor) VALUES (12, 'promocoes_ativas', '1');
INSERT INTO configuracoes (id, chave, valor) VALUES (13, 'limite_padrao_fiado', '0.00');
INSERT INTO configuracoes (id, chave, valor) VALUES (14, 'fiado_ativo', '1');
INSERT INTO configuracoes (id, chave, valor) VALUES (15, 'fiado_app_ativo', '1');

-- Tabela: promocoes (5 registros)
DELETE FROM promocoes;
INSERT INTO promocoes (id, codigo, nome, descricao, tipo, valor, valor_minimo_pedido, desconto_maximo, regras_json, ativa, data_inicio, data_fim, usos_maximos, usos_atuais, criado_em) VALUES (1, 'BEMVINDO10', 'Boas-Vindas App', '10% de desconto no seu 1º pedido pelo aplicativo!', 'primeira_compra', '10.00', '10.00', '15.00', '[object Object]', 1, NULL, NULL, NULL, 1, '2026-09-18 11:17:33');
INSERT INTO promocoes (id, codigo, nome, descricao, tipo, valor, valor_minimo_pedido, desconto_maximo, regras_json, ativa, data_inicio, data_fim, usos_maximos, usos_atuais, criado_em) VALUES (2, 'QUARTA2X', 'Quarta Maluca: Pontos em Dobro', 'Ganhe o dobro de pontos de fidelidade em pedidos feitos às quartas-feiras!', 'pontos_dobro', '2.00', '0.00', NULL, '[object Object]', 0, NULL, NULL, NULL, 0, '2026-09-18 11:17:33');
INSERT INTO promocoes (id, codigo, nome, descricao, tipo, valor, valor_minimo_pedido, desconto_maximo, regras_json, ativa, data_inicio, data_fim, usos_maximos, usos_atuais, criado_em) VALUES (3, 'COMBOPALADAR', 'Combo Econômico Cantina', 'R$ 3,00 de desconto automático para pedidos acima de R$ 25,00', 'desconto_fixo', '3.00', '25.00', NULL, '[object Object]', 1, NULL, NULL, NULL, 0, '2026-09-18 11:17:33');
INSERT INTO promocoes (id, codigo, nome, descricao, tipo, valor, valor_minimo_pedido, desconto_maximo, regras_json, ativa, data_inicio, data_fim, usos_maximos, usos_atuais, criado_em) VALUES (4, 'PALADAR15', 'Cupom Especial Estudante', '15% de desconto em pedidos acima de R$ 30,00', 'desconto_porcentagem', '15.00', '30.00', '10.00', '[object Object]', 1, NULL, NULL, NULL, 0, '2026-09-18 11:17:33');
INSERT INTO promocoes (id, codigo, nome, descricao, tipo, valor, valor_minimo_pedido, desconto_maximo, regras_json, ativa, data_inicio, data_fim, usos_maximos, usos_atuais, criado_em) VALUES (5, 'S10', 'Segunda', 'Valido para qualquer valor', 'desconto_porcentagem', '5.00', '7.00', NULL, NULL, 1, NULL, NULL, NULL, 0, '2026-09-21 11:21:16');

SET FOREIGN_KEY_CHECKS = 1;
