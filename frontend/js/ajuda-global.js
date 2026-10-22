/**
 * Sistema Doutor Paladar - Script Global de Ajuda (Help Modals & Floating Buttons)
 * Injeta dinamicamente o botão flutuante de ajuda e o modal contextual de suporte
 * para todas as telas do sistema (Admin, PDV, Estoque, Clientes, Financeiro, etc.)
 */

(function () {
    // Dicionário de ajuda contextual baseado na URL / página atual
    const paginasAjuda = {
        'pdv.html': {
            titulo: 'Ajuda · Ponto de Venda (PDV)',
            subtitulo: 'Operação rápida de caixa, pedidos e recebimentos',
            duvidas: [
                { q: 'Como adicionar itens à venda?', a: 'Clique nos cards de produtos ou use o campo de busca. Pressione F2 para focar na busca imediatamente.' },
                { q: 'Como vender a prazo / Fiado?', a: 'Selecione o cliente cadastrado. O sistema verifica se ele está desbloqueado e possui limite disponível (padrão R$ 50,00).' },
                { q: 'Como aplicar desconto de fidelidade?', a: 'Se o cliente selecionado tiver pontos acumulados (mínimo 50 pontos), ative o botão de resgate no carrinho.' },
                { q: 'Como finalizar pagamento no PIX?', a: 'Selecione PIX para gerar o QR Code Mercado Pago. O sistema aprova e finaliza a venda automaticamente via webhook/socket.' }
            ]
        },
        'pedidos-admin.html': {
            titulo: 'Ajuda · Painel de Cozinha & Pedidos',
            subtitulo: 'Acompanhamento em tempo real dos pedidos dos alunos',
            duvidas: [
                { q: 'Como avançar o status do pedido?', a: 'Clique nos botões "Preparar", "Pronto para Retirada" ou "Entregue". O aluno recebe notificação instantânea.' },
                { q: 'Novos pedidos tocam som?', a: 'Sim! Ao chegar um novo pedido online ou no balcão, o sistema emite um alerta sonoro discreto para a cozinha.' },
                { q: 'Como filtrar pedidos por status?', a: 'Use os botões de filtro no topo (Pendentes, Em Preparo, Prontos, Entregues e Cancelados).' }
            ]
        },
        'estoque.html': {
            titulo: 'Ajuda · Gestão de Estoque & Cardápio',
            subtitulo: 'Controle de quantidades, preços e visibilidade no cardápio',
            duvidas: [
                { q: 'Como pausar ou ativar um produto no cardápio?', a: 'Utilize a nova coluna "No Cardápio" com o botão verde/cinza. Ao pausar, o item some do cardápio do aluno sem ser excluído do sistema.' },
                { q: 'Como dar entrada em mercadorias?', a: 'Clique em "Dar Entrada", selecione o produto, a quantidade comprada e o valor de custo.' },
                { q: 'O que significa o alerta de Estoque Baixo?', a: 'Itens com quantidade igual ou inferior ao estoque mínimo ficam destacados em vermelho para reposição imediata.' }
            ]
        },
        'clientes.html': {
            titulo: 'Ajuda · Gestão de Clientes & Limites',
            subtitulo: 'Controle de alunos, limite fiado e bloqueios',
            duvidas: [
                { q: 'Como alterar o limite de crédito fiado de um cliente?', a: 'Clique no botão de lápis na coluna "Limite Fiado". O padrão é R$ 50,00, mas pode ser personalizado livremente.' },
                { q: 'Como bloquear um cliente com pendências?', a: 'Clique no botão "Bloquear" na linha do cliente. Clientes bloqueados não conseguem comprar a prazo no PDV nem no cardápio.' },
                { q: 'Como buscar clientes rapidamente?', a: 'Digite o nome, turma, CPF ou matrícula no campo de pesquisa no topo.' }
            ]
        },
        'contas-receber.html': {
            titulo: 'Ajuda · Contas a Receber (Fiado)',
            subtitulo: 'Baixa de débitos, pagamentos parciais e extrato',
            duvidas: [
                { q: 'Como dar baixa em um débito?', a: 'Localize o aluno com saldo devedor, clique em "Receber", informe o valor pago (total ou parcial) e a forma de pagamento.' },
                { q: 'Posso emitir recibo ou comprovante?', a: 'Sim, após registrar a baixa é gerado o comprovante impresso ou em PDF com os itens liquidados.' },
                { q: 'Como acompanhar vencimentos?', a: 'Aba lateral mostra totais em aberto, débitos vencidos há mais de 30 dias e valor total previsto.' }
            ]
        },
        'despesas.html': {
            titulo: 'Ajuda · Gestão Financeira de Despesas',
            subtitulo: 'Controle de contas a pagar, compras e custos operacionais',
            duvidas: [
                { q: 'Como cadastrar nova conta a pagar?', a: 'Clique em "Nova Despesa", preencha a descrição, categoria (alimentos, embalagens, utilidades), valor e data de vencimento.' },
                { q: 'Como marcar despesa como paga?', a: 'Na lista de contas pendentes, clique no botão "Liquidar" informando a conta de saída.' }
            ]
        },
        'desempenhos.html': {
            titulo: 'Ajuda · Relatórios Gerenciais & DRE',
            subtitulo: 'Mais de 10 relatórios estratégicos para tomada de decisão',
            duvidas: [
                { q: 'Como acessar a nova Central de 10+ Relatórios?', a: 'Clique na aba "Central de 10+ Relatórios" no topo. Selecione o relatório desejado no menu suspenso.' },
                { q: 'Quais relatórios estão disponíveis?', a: 'Faturamento Mensal, Curva ABC, Vendas por Categoria, Formas de Pagamento, Horários de Pico, Inadimplência/Fiado, Estoque Crítico, DRE/Lucro Real, etc.' },
                { q: 'Como exportar ou imprimir?', a: 'Clique em "Imprimir / Salvar PDF" para gerar uma via formatada em papel ou formato eletrônico.' }
            ]
        },
        'agendamentos.html': {
            titulo: 'Ajuda · Agendamento de Refeições & Almoços',
            subtitulo: 'Controle de pratos reservados com antecedência',
            duvidas: [
                { q: 'Como funciona o agendamento de refeições?', a: 'Alunos podem reservar almoços e lanches para datas futuras, reduzindo desperdício na cozinha.' },
                { q: 'Como confirmar a entrega do prato?', a: 'Busque pelo nome do aluno ou QR Code do ticket no balcão e clique em "Validar Entrega".' }
            ]
        },
        'admin.html': {
            titulo: 'Ajuda · Painel Administrativo Geral',
            subtitulo: 'Acesso a todas as áreas de controle da cantina',
            duvidas: [
                { q: 'Onde configuro as opções do sistema?', a: 'Acesse o menu "Configurações" para alterar nome da cantina, dados do PIX e parâmetros de fidelidade.' },
                { q: 'Como monitorar as vendas do dia?', a: 'O dashboard inicial exibe faturamento, ticket médio, total de pedidos e alertas de estoque em tempo real.' }
            ]
        }
    };

    function obterNomeArquivo() {
        const path = window.location.pathname;
        const nome = path.split('/').pop().toLowerCase();
        return nome || 'index.html';
    }

    function inicializarAjudaGlobal() {
        // Se já existe modal de ajuda criado, não duplicar
        if (document.getElementById('modalAjudaGlobalSistema')) return;

        const paginaAtual = obterNomeArquivo();
        const config = paginasAjuda[paginaAtual] || {
            titulo: 'Precisa de Ajuda?',
            subtitulo: 'Guia de suporte do Sistema Doutor Paladar',
            duvidas: [
                { q: 'Dúvidas sobre o funcionamento?', a: 'Nossa equipe de suporte está à disposição no balcão da cantina ou através do canal administrativo.' },
                { q: 'Atalhos do sistema?', a: 'Pressione Esc para fechar janelas e modais abertos a qualquer momento.' },
                { q: 'Segurança e Dados?', a: 'O sistema adota autenticação criptografada JWT e proteção contra injeções e ataques web.' }
            ]
        };

        // 1. Criar Modal
        const modalHtml = `
        <div id="modalAjudaGlobalSistema" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(6px); z-index:99999; align-items:center; justify-content:center; padding:16px;" onclick="if(event.target === this) fecharAjudaGlobalSistema()">
            <div style="background:#ffffff; width:100%; max-width:540px; border-radius:24px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.3); overflow:hidden; border:1px solid #e2e8f0; animation: animModalAjuda 0.25s ease-out;" onclick="event.stopPropagation()">
                
                <!-- Header -->
                <div style="background:linear-gradient(135deg, #064e3b 0%, #047857 100%); padding:20px 24px; color:#ffffff; position:relative; display:flex; align-items:center; gap:14px;">
                    <div style="width:44px; height:44px; background:rgba(255,255,255,0.18); border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">
                        <i class="fas fa-question-circle"></i>
                    </div>
                    <div style="flex:1;">
                        <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#ffffff;">${config.titulo}</h3>
                        <p style="margin:3px 0 0 0; font-size:0.8rem; color:#d1fae5;">${config.subtitulo}</p>
                    </div>
                    <button type="button" onclick="fecharAjudaGlobalSistema()" style="background:none; border:none; color:#ffffff; font-size:1.6rem; cursor:pointer; padding:4px 8px; line-height:1; opacity:0.85;">&times;</button>
                </div>

                <!-- Lista de Dúvidas -->
                <div style="padding:22px; max-height:420px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; background:#f8fafc;">
                    ${config.duvidas.map(d => `
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:12px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                                <i class="fas fa-info-circle" style="color:#059669; font-size:0.85rem;"></i>
                                <strong style="color:#0f172a; font-size:0.88rem;">${d.q}</strong>
                            </div>
                            <p style="margin:0; font-size:0.82rem; color:#64748b; line-height:1.45; padding-left:22px;">${d.a}</p>
                        </div>
                    `).join('')}

                    <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:14px; padding:12px 16px; display:flex; align-items:center; gap:12px;">
                        <i class="fas fa-headset" style="color:#059669; font-size:1.2rem;"></i>
                        <div style="font-size:0.8rem; color:#065f46;">
                            <strong>Ainda tem dúvidas?</strong> Fale diretamente com o administrador ou consulte a documentação da cantina escolar.
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="padding:16px 22px; background:#ffffff; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end; gap:10px;">
                    <button type="button" onclick="fecharAjudaGlobalSistema()" style="padding:10px 22px; background:#047857; color:#fff; border:none; border-radius:10px; font-weight:700; font-size:0.88rem; cursor:pointer; box-shadow:0 4px 12px rgba(4,120,87,0.25);">
                        Entendido
                    </button>
                </div>
            </div>
        </div>
        <style>
            @keyframes animModalAjuda {
                from { opacity: 0; transform: scale(0.95) translateY(8px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
        </style>
        `;

        // 2. Injetar modal no body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 3. Injetar botão flutuante se não for cardápio (cardápio já tem o próprio)
        if (paginaAtual !== 'cardapio.html' && !document.getElementById('btnAjudaFlutuanteGlobal')) {
            const btnFlutuante = document.createElement('button');
            btnFlutuante.id = 'btnAjudaFlutuanteGlobal';
            btnFlutuante.type = 'button';
            btnFlutuante.title = 'Precisa de ajuda nesta tela?';
            btnFlutuante.innerHTML = '<i class="fas fa-question"></i>';
            btnFlutuante.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 9999;
                background: #047857;
                color: #ffffff;
                border: 2px solid rgba(255, 255, 255, 0.4);
                width: 48px;
                height: 48px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.25rem;
                cursor: pointer;
                box-shadow: 0 10px 25px rgba(4, 120, 87, 0.4);
                transition: transform 0.2s, background-color 0.2s;
            `;
            btnFlutuante.onmouseover = () => { btnFlutuante.style.transform = 'scale(1.08)'; btnFlutuante.style.backgroundColor = '#065f46'; };
            btnFlutuante.onmouseout = () => { btnFlutuante.style.transform = 'scale(1)'; btnFlutuante.style.backgroundColor = '#047857'; };
            btnFlutuante.onclick = window.abrirAjudaGlobalSistema;
            document.body.appendChild(btnFlutuante);
        }
    }

    window.abrirAjudaGlobalSistema = function () {
        const modal = document.getElementById('modalAjudaGlobalSistema');
        if (modal) modal.style.display = 'flex';
    };

    window.fecharAjudaGlobalSistema = function () {
        const modal = document.getElementById('modalAjudaGlobalSistema');
        if (modal) modal.style.display = 'none';
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarAjudaGlobal);
    } else {
        inicializarAjudaGlobal();
    }
})();
