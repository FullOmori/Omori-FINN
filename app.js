// Lógica Principal - Painel Financeiro Neon

// Estado Global da Aplicação
let state = {};
let selectedTab = 'dashboard';
let selectedCardId = null;
let chartIncomesExpensesInstance = null;
let chartCategoriesInstance = null;

// Variáveis Globais do Chat AI e Simulações
let chatHistory = [];
let activeSimulationOption = null;

// Inicialização da Aplicação
document.addEventListener('DOMContentLoaded', () => {
  initAppState();
  initTabNavigation();
  initPaydayWidget();
  setupFormListeners();
  
  // Renderizar a tela inicial
  renderApp();
});

// 1. GERENCIAMENTO DE ESTADO E PERSISTÊNCIA
let currentWizardStep = 1;

function initAppState() {
  const onboarded = localStorage.getItem('neonfi_onboarded');
  
  if (onboarded === 'true') {
    // Exibe painel principal e oculta assistente
    document.querySelector('.app-container').style.display = 'grid';
    document.getElementById('onboardingWizard').style.display = 'none';
    
    const savedState = localStorage.getItem('neonfi_state');
    if (savedState) {
      try {
        state = JSON.parse(savedState);
      } catch (e) {
        console.error("Erro ao carregar estado do localStorage. Restaurando padrões.", e);
        state = JSON.parse(JSON.stringify(window.INITIAL_DATA));
      }
    } else {
      state = JSON.parse(JSON.stringify(window.INITIAL_DATA));
      saveState();
    }
  } else {
    // Exibe assistente e oculta painel
    document.querySelector('.app-container').style.display = 'none';
    document.getElementById('onboardingWizard').style.display = 'flex';
    
    // Inicia com template 100% limpo
    state = JSON.parse(JSON.stringify(window.EMPTY_TEMPLATE));
    currentWizardStep = 1;
    updateWizardUI();
  }

  // Seleciona o primeiro cartão de crédito por padrão, se houver
  if (state.creditCards && state.creditCards.length > 0) {
    selectedCardId = state.creditCards[0].id;
  }
}

function saveState() {
  localStorage.setItem('neonfi_state', JSON.stringify(state));
}

// 2. NAVEGAÇÃO POR ABAS (SPA)
function initTabNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = link.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  selectedTab = tabId;
  
  // Atualiza classes do menu
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
  if (activeLink) activeLink.classList.add('active');
  
  // Alterna visibilidade dos containers
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  const activeContent = document.getElementById(tabId);
  if (activeContent) activeContent.classList.add('active');
  
  // Executa lógicas específicas de renderização da aba
  renderTabContent(tabId);
}

function renderTabContent(tabId) {
  switch (tabId) {
    case 'dashboard':
      renderDashboard();
      updateCharts();
      break;
    case 'pj-pf':
      renderPjPf();
      break;
    case 'payments':
      renderPayments();
      break;
    case 'credit-cards':
      renderCreditCards();
      break;
    case 'debts':
      renderDebts();
      runDebtSimulation();
      break;
    case 'goals':
      renderGoals();
      break;
    case 'transactions':
      renderTransactions();
      break;
    case 'ai-advisor':
      renderAiAdvisor();
      break;
  }
}

// 3. CÁLCULO E WIDGET DO 5º DIA ÚTIL
function initPaydayWidget() {
  const widget = document.getElementById('paydayWidget');
  widget.addEventListener('click', () => {
    // Abre modal para configurar dia de pagamento
    document.getElementById('paydayTypeSelect').value = state.profile.paydayType;
    document.getElementById('paydayGoalPercentInput').value = state.profile.paydayGoalPercent || 0;
    openModal('modal-config-payday');
  });
}

// Função para calcular o 5º dia útil de um mês/ano
function getFifthBusinessDay(year, month) {
  // Nota: month é 0-indexed (0 = Janeiro, 11 = Dezembro)
  let date = new Date(year, month, 1);
  let businessDaysCount = 0;
  
  while (businessDaysCount < 5) {
    let dayOfWeek = date.getDay();
    // 0 = Domingo, 6 = Sábado. Dias úteis são de Segunda (1) a Sexta (5)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDaysCount++;
    }
    if (businessDaysCount < 5) {
      date.setDate(date.getDate() + 1);
    }
  }
  return date;
}

// Retorna a próxima data de recebimento do usuário
function getNextPaydayDate() {
  const today = new Date();
  
  if (state.profile.paydayType === 'weekly_friday') {
    // Próxima sexta-feira
    let result = new Date(today);
    let dayOfWeek = today.getDay();
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    // Se hoje é sexta, vamos assumir que o próximo pagamento é na próxima sexta
    if (daysUntilFriday === 0) daysUntilFriday = 7;
    result.setDate(today.getDate() + daysUntilFriday);
    return result;
  } else {
    // 5º Dia Útil do mês
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentPayday = getFifthBusinessDay(currentYear, currentMonth);
    
    // Compara apenas as datas (zerando horas)
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const currentPaydayZero = new Date(currentPayday.getFullYear(), currentPayday.getMonth(), currentPayday.getDate());
    
    if (todayZero <= currentPaydayZero) {
      return currentPayday;
    } else {
      // Já passou do 5º dia útil do mês atual, calcula para o próximo mês
      let nextMonth = currentMonth + 1;
      let nextYear = currentYear;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear++;
      }
      return getFifthBusinessDay(nextYear, nextMonth);
    }
  }
}

function updatePaydayDisplay() {
  const nextPayday = getNextPaydayDate();
  const today = new Date();
  
  // Formatar data em PT-BR
  const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
  const formattedDate = nextPayday.toLocaleDateString('pt-BR', options);
  
  // Calcular dias restantes
  const diffTime = nextPayday - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let labelText = "";
  if (diffDays === 0) {
    labelText = "É HOJE! 💸";
  } else if (diffDays === 1) {
    labelText = "Amanhã! ⏳";
  } else {
    labelText = `Em ${diffDays} dias (${formattedDate})`;
  }
  
  document.getElementById('nextPaydayVal').innerText = labelText;
}

// 4. MÉTODOS DE RENDERIZAÇÃO DE TELAS

function renderApp() {
  updatePaydayDisplay();
  
  // Renderiza o perfil no rodapé da barra lateral
  document.getElementById('profileName').innerText = state.profile.name;
  const names = state.profile.name.split(" ");
  const initials = names.length > 1 ? (names[0][0] + names[names.length - 1][0]).toUpperCase() : names[0][0].toUpperCase();
  document.getElementById('profileInitials').innerText = initials;
  document.getElementById('welcomeTitle').innerText = `Olá, ${names[0]}!`;
  
  // Renderiza a aba atual
  renderTabContent(selectedTab);
}

// FORMATAÇÃO DE MOEDA (BRL)
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// FORMATAR DATA
function formatDateBr(dateString) {
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

// ABA: DASHBOARD
function renderDashboard() {
  // Saldo PF
  const balPF = state.profile.balancePF;
  const dashBalPF = document.getElementById('dashBalancePF');
  dashBalPF.innerText = formatCurrency(balPF);
  
  const descPF = document.getElementById('dashBalancePFDesc');
  if (balPF < 500) {
    descPF.innerHTML = '<span class="card-trend-down"><i class="fa-solid fa-circle-exclamation"></i> Crítico! Evite novos gastos</span>';
  } else if (balPF < 1500) {
    descPF.innerHTML = '<span class="card-trend-down">Abaixo do recomendado</span>';
  } else {
    descPF.innerHTML = '<span class="card-trend-up">Saldo saudável</span>';
  }

  // Saldo PJ
  document.getElementById('dashBalancePJ').innerText = formatCurrency(state.pj.balance);

  // Faturas do Cartão
  let totalCards = 0;
  state.creditCards.forEach(card => {
    // Soma transações atuais + parcelas do mês
    const txSum = card.transactions.reduce((acc, t) => acc + t.amount, 0);
    const instSum = card.installments.reduce((acc, inst) => acc + inst.monthlyAmount, 0);
    totalCards += (txSum + instSum);
  });
  document.getElementById('dashCardsTotal').innerText = formatCurrency(totalCards);
  document.getElementById('dashCardsDesc').innerText = `${state.creditCards.length} cartões monitorados`;

  // Dívidas
  const totalDebts = state.debts.reduce((acc, d) => acc + d.balance, 0);
  document.getElementById('dashDebtsTotal').innerText = formatCurrency(totalDebts);
  
  const highPriorityDebts = state.debts.filter(d => d.priority === 'high').length;
  const debtDesc = document.getElementById('dashDebtsDesc');
  if (highPriorityDebts > 0) {
    debtDesc.innerHTML = `<span class="card-trend-down"><i class="fa-solid fa-fire"></i> ${highPriorityDebts} dívida(s) de juros críticos</span>`;
  } else {
    debtDesc.innerHTML = `<span>Total acumulado sob controle</span>`;
  }

  // Lançamentos recentes (últimos 5 lançamentos PF)
  const recentTable = document.getElementById('recentTransactionsTable');
  recentTable.innerHTML = '';
  
  // Ordenar transações PF por data desc
  const sortedTx = [...state.transactionsPF]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
    
  if (sortedTx.length === 0) {
    recentTable.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Nenhuma atividade registrada.</td></tr>';
  } else {
    sortedTx.forEach(tx => {
      const isExpense = tx.amount < 0 || tx.type === 'expense';
      const colorClass = isExpense ? 'color-pink' : 'color-green';
      const sign = isExpense ? '-' : '+';
      const absAmount = Math.abs(tx.amount);
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${formatDateBr(tx.date)}</td>
        <td>${tx.description}</td>
        <td class="mono ${colorClass}" style="text-align:right;">${sign} ${formatCurrency(absAmount)}</td>
      `;
      recentTable.appendChild(tr);
    });
  }

  // Assistente Inteligente Neon (Feedback Prático)
  const assistant = document.getElementById('assistantFeedback');
  if (totalDebts > 10000) {
    const highInterestDebt = state.debts.find(d => d.interestRate > 5);
    if (highInterestDebt) {
      assistant.innerHTML = `⚠️ <strong>Foco urgente:</strong> Sua dívida <em>"${highInterestDebt.name}"</em> possui juros de <strong>${highInterestDebt.interestRate}% ao mês</strong>! Use todo o dinheiro extra recebido no 5º dia útil para liquidá-la antes de qualquer outra coisa. Juros altos corroem sua riqueza.`;
    } else {
      assistant.innerHTML = `💸 <strong>Alerta de Dívida:</strong> Você deve ${formatCurrency(totalDebts)}. Recomendamos usar o <strong>Método Avalanche</strong> na aba "Quitar Dívidas" para simular como aportes de R$ 200 adicionais reduzem drasticamente seu tempo de quitação.`;
    }
  } else if (state.pj.balance > 2000) {
    assistant.innerHTML = `💼 <strong>Dinheiro parado na PJ:</strong> Você possui ${formatCurrency(state.pj.balance)} na conta empresarial. Faça a transferência para a conta física deduzindo impostos para poder pagar as contas do mês e quitar cartões.`;
  } else if (balPF < totalCards) {
    assistant.innerHTML = `🚨 <strong>Risco de inadimplência:</strong> Seu saldo de conta física (${formatCurrency(balPF)}) é menor do que a fatura acumulada do cartão (${formatCurrency(totalCards)}). Evite compras no crédito nas próximas semanas!`;
  } else {
    assistant.innerHTML = `🚀 <strong>Tudo sob controle!</strong> Suas contas estão em dia. Que tal direcionar <strong>${state.profile.paydayGoalPercent}%</strong> do próximo dia útil de pagamento para alimentar sua <em>Reserva de Emergência</em>?`;
  }
}

// ABA: FLUXO PJ ➔ PF
function renderPjPf() {
  document.getElementById('flowPjBalance').innerText = formatCurrency(state.pj.balance);
  document.getElementById('flowPfBalance').innerText = formatCurrency(state.profile.balancePF);
  
  // Atualiza simulação de taxas conforme entrada do formulário
  updatePjTransferSimulation();

  // Tabela de faturamentos PJ
  const invoicesTable = document.getElementById('pjInvoicesTable');
  invoicesTable.innerHTML = '';
  
  if (!state.pj.monthlyInvoices || state.pj.monthlyInvoices.length === 0) {
    invoicesTable.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nenhum faturamento lançado.</td></tr>';
  } else {
    state.pj.monthlyInvoices.forEach(inv => {
      const statusBadge = inv.status === 'received' 
        ? '<span class="badge badge-green">Recebido</span>' 
        : '<span class="badge badge-orange">Pendente</span>';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${inv.client}</td>
        <td class="mono">${formatDateBr(inv.date)}</td>
        <td class="mono font-bold">${formatCurrency(inv.amount)}</td>
        <td>${statusBadge}</td>
      `;
      invoicesTable.appendChild(tr);
    });
  }
}

function updatePjTransferSimulation() {
  const amount = parseFloat(document.getElementById('transferAmount').value) || 0;
  const dasRate = state.pj.taxesConfig.dasRate;
  const dasVal = amount * (dasRate / 100);
  
  // A contabilidade e tarifas bancárias são custos fixos mensais PJ. 
  // Numa simulação de transferência individual, podemos mostrar o desconto pro-rata ou apenas destacar o valor.
  // Vamos deduzir o Simples Nacional diretamente na simulação como imposto real.
  const accounting = state.pj.taxesConfig.accountingFee;
  const bank = state.pj.taxesConfig.bankFee;
  
  // Líquido final estimado enviado à conta PF
  const netTransfer = Math.max(0, amount - dasVal);

  document.getElementById('simDasRate').innerText = dasRate;
  document.getElementById('simDasValue').innerText = `- ${formatCurrency(dasVal)}`;
  document.getElementById('simAccountingValue').innerText = `Ref: ${formatCurrency(accounting)}/mês`;
  document.getElementById('simNetTransfer').innerText = formatCurrency(netTransfer);
}

// Listener para alteração em tempo real no input de transferência
document.getElementById('transferAmount').addEventListener('input', updatePjTransferSimulation);

function handlePjTransfer(event) {
  event.preventDefault();
  const rawAmount = parseFloat(document.getElementById('transferAmount').value);
  if (isNaN(rawAmount) || rawAmount <= 0) return;
  
  if (rawAmount > state.pj.balance) {
    alert("Saldo PJ insuficiente para essa transferência!");
    return;
  }
  
  const dasRate = state.pj.taxesConfig.dasRate;
  const taxAmount = rawAmount * (dasRate / 100);
  const netAmount = rawAmount - taxAmount;
  
  // 1. Deduz da conta PJ o valor bruto
  state.pj.balance -= rawAmount;
  
  // 2. Adiciona à conta PF o valor líquido
  state.profile.balancePF += netAmount;
  
  // 3. Registra transação na PJ
  state.pj.transfers.push({
    id: 'tr_' + Date.now(),
    amount: rawAmount,
    taxDeducted: taxAmount,
    date: new Date().toISOString().split('T')[0],
    status: 'completed'
  });
  
  // 4. Registra receita na PF
  state.transactionsPF.push({
    id: 'pf_t_' + Date.now(),
    description: "Transferência PJ (Pro-Labore Líquido)",
    amount: netAmount,
    date: new Date().toISOString().split('T')[0],
    type: "income",
    category: "Pró-Labore"
  });
  
  saveState();
  renderApp();
  alert(`Transferência efetuada com sucesso! \nBruto: ${formatCurrency(rawAmount)} \nImpostos retidos (${dasRate}%): ${formatCurrency(taxAmount)} \nLíquido na PF: ${formatCurrency(netAmount)}`);
  
  // Limpar formulário
  document.getElementById('transferAmount').value = '';
  updatePjTransferSimulation();
}

// ABA: CONTAS A PAGAR (ORGANIZADOR MENSAL)
let activeFilter = 'all';

function renderPayments() {
  const container = document.getElementById('paymentsListContainer');
  container.innerHTML = '';
  
  // Ordenar contas pelo dia de vencimento (numérico 1 a 31)
  const sortedBills = [...state.bills].sort((a, b) => parseInt(a.dueDate) - parseInt(b.dueDate));
  
  let totalPendingBeforePayday = 0;
  const nextPayday = getNextPaydayDate();
  const paydayDay = nextPayday.getDate();
  
  // Filtro
  const filtered = sortedBills.filter(bill => {
    if (activeFilter === 'pending') return bill.status === 'pending';
    if (activeFilter === 'paid') return bill.status === 'paid';
    return true; // all
  });
  
  // Calcular totais urgentes
  sortedBills.forEach(bill => {
    if (bill.status === 'pending') {
      // Se vence antes ou no dia do pagamento
      if (parseInt(bill.dueDate) <= paydayDay) {
        totalPendingBeforePayday += bill.amount;
      }
    }
  });
  
  // Atualizar widget informador
  const pendingCount = sortedBills.filter(b => b.status === 'pending').length;
  document.getElementById('paydayPendingCount').innerText = pendingCount;
  document.getElementById('paydayPendingAmount').innerText = formatCurrency(sortedBills.filter(b => b.status === 'pending').reduce((a, b) => a + b.amount, 0));

  if (filtered.length === 0) {
    container.innerHTML = '<div class="card" style="text-align:center; padding:3rem; color:var(--text-muted);">Nenhuma conta encontrada nesta categoria.</div>';
    return;
  }
  
  filtered.forEach(bill => {
    let overdueClass = "";
    let actionBtn = "";
    
    // Status visual
    const today = new Date().getDate();
    if (bill.status === 'pending') {
      if (parseInt(bill.dueDate) < today) {
        overdueClass = "overdue"; // Atrasado
      } else {
        overdueClass = "pending"; // Pendente
      }
      actionBtn = `<button class="btn btn-success btn-sm" onclick="payBill('${bill.id}')"><i class="fa-solid fa-check"></i> Pagar</button>`;
    } else {
      overdueClass = "paid"; // Pago
      actionBtn = `<button class="btn btn-secondary btn-sm" onclick="unpayBill('${bill.id}')"><i class="fa-solid fa-undo"></i> Estornar</button>`;
    }
    
    const div = document.createElement('div');
    div.className = `timeline-item ${overdueClass}`;
    div.innerHTML = `
      <div class="timeline-left">
        <div class="timeline-date-box">
          <span class="date-day">${bill.dueDate}</span>
          <span class="date-label">Dia</span>
        </div>
        <div class="timeline-info">
          <span class="timeline-title">${bill.name}</span>
          <span class="timeline-cat">${bill.category}</span>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:1.5rem;">
        <span class="mono" style="font-weight:700; font-size:1.05rem;">${formatCurrency(bill.amount)}</span>
        ${actionBtn}
        <button class="btn btn-danger btn-sm" onclick="deleteBill('${bill.id}')" title="Excluir"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `;
    container.appendChild(div);
  });
}

function filterBills(filterType) {
  activeFilter = filterType;
  document.querySelectorAll('.btn-filter').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-filter') === filterType) {
      btn.classList.add('active');
    }
  });
  renderPayments();
}

function payBill(billId) {
  const bill = state.bills.find(b => b.id === billId);
  if (!bill) return;
  
  if (state.profile.balancePF < bill.amount) {
    const confirmPay = confirm(`Atenção: Seu saldo PF (${formatCurrency(state.profile.balancePF)}) é menor que o valor da conta (${formatCurrency(bill.amount)}). Deseja pagar mesmo assim (ficará com saldo negativo)?`);
    if (!confirmPay) return;
  }
  
  // Atualiza saldo e status da conta
  state.profile.balancePF -= bill.amount;
  bill.status = 'paid';
  
  // Registra no extrato PF
  state.transactionsPF.push({
    id: 'pf_t_bill_' + Date.now(),
    description: `Pgto Conta: ${bill.name}`,
    amount: -bill.amount,
    date: new Date().toISOString().split('T')[0],
    type: "expense",
    category: bill.category
  });
  
  saveState();
  renderApp();
}

function unpayBill(billId) {
  const bill = state.bills.find(b => b.id === billId);
  if (!bill) return;
  
  // Estorna o valor da conta
  state.profile.balancePF += bill.amount;
  bill.status = 'pending';
  
  // Adiciona transação de estorno ou apenas remove a antiga
  state.transactionsPF.push({
    id: 'pf_t_bill_refund_' + Date.now(),
    description: `Estorno Pgto: ${bill.name}`,
    amount: bill.amount,
    date: new Date().toISOString().split('T')[0],
    type: "income",
    category: "Estorno"
  });
  
  saveState();
  renderApp();
}

function deleteBill(billId) {
  if (confirm("Deseja realmente excluir esta conta mensal?")) {
    state.bills = state.bills.filter(b => b.id !== billId);
    saveState();
    renderApp();
  }
}

// ABA: CARTÕES DE CRÉDITO
function renderCreditCards() {
  const container = document.getElementById('cardsContainer');
  container.innerHTML = '';
  
  if (!state.creditCards || state.creditCards.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);">Nenhum cartão cadastrado. Clique no botão superior para adicionar.</p>';
    document.getElementById('selectedCardTitle').innerText = "Nenhum Cartão Selecionado";
    document.getElementById('cardTransactionsTable').innerHTML = '<tr><td colspan="4" style="text-align:center;">Sem lançamentos</td></tr>';
    document.getElementById('cardInstallmentsContainer').innerHTML = '';
    return;
  }
  
  state.creditCards.forEach(card => {
    // Calcular saldo de fatura atual
    const txSum = card.transactions.reduce((acc, t) => acc + t.amount, 0);
    const instSum = card.installments.reduce((acc, inst) => acc + inst.monthlyAmount, 0);
    const currentInvoice = txSum + instSum;
    const availableLimit = card.limit - currentInvoice;
    const usagePercent = Math.min(100, (currentInvoice / card.limit) * 100);
    const isSelected = card.id === selectedCardId;
    
    const cardEl = document.createElement('div');
    cardEl.className = `credit-card-item ${isSelected ? 'selected' : ''}`;
    cardEl.style.background = `linear-gradient(135deg, ${card.color}dd, #100f1c)`;
    cardEl.style.boxShadow = isSelected ? `0 0 25px ${card.color}55` : 'var(--shadow-neon)';
    cardEl.style.borderColor = isSelected ? card.color : 'rgba(255,255,255,0.05)';
    cardEl.onclick = () => {
      selectedCardId = card.id;
      renderCreditCards();
    };
    
    cardEl.innerHTML = `
      <div class="card-brand-row">
        <span style="font-weight:700; letter-spacing:1px;">${card.name.toUpperCase()}</span>
        <div class="card-chip"></div>
      </div>
      <div>
        <div class="card-num">•••• •••• •••• ${card.dueDay.toString().padStart(2, '0')}</div>
        <p style="font-size:0.7rem; color:rgba(255,255,255,0.6); margin-top:2px;">Vence dia ${card.dueDay}</p>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.25rem;">
        <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
          <span>Fatura: <strong>${formatCurrency(currentInvoice)}</strong></span>
          <span style="opacity:0.8;">Lim: ${formatCurrency(card.limit)}</span>
        </div>
        <div class="card-limit-progress">
          <div class="card-limit-bar" style="width: ${usagePercent}%; background-color: ${card.color}; box-shadow: 0 0 10px ${card.color};"></div>
        </div>
      </div>
    `;
    container.appendChild(cardEl);
  });
  
  renderSelectedCardDetails();
}

function renderSelectedCardDetails() {
  const card = state.creditCards.find(c => c.id === selectedCardId);
  if (!card) return;
  
  // Título do cartão selecionado
  document.getElementById('selectedCardTitle').innerHTML = `<i class="fa-solid fa-credit-card" style="color:${card.color};"></i> Fatura Atual - ${card.name}`;
  
  // Transações avulsas
  const table = document.getElementById('cardTransactionsTable');
  table.innerHTML = '';
  
  if (card.transactions.length === 0) {
    table.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nenhuma compra avulsa neste mês.</td></tr>';
  } else {
    card.transactions.forEach(tx => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${formatDateBr(tx.date)}</td>
        <td>${tx.description}</td>
        <td><span class="badge badge-pink" style="border-color:${card.color}44; color:${card.color}; background:${card.color}11;">${tx.category}</span></td>
        <td class="mono font-bold">${formatCurrency(tx.amount)}</td>
      `;
      table.appendChild(tr);
    });
  }
  
  // Compras parceladas
  const instContainer = document.getElementById('cardInstallmentsContainer');
  instContainer.innerHTML = '';
  
  if (!card.installments || card.installments.length === 0) {
    instContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:1.5rem;">Nenhum parcelamento ativo neste cartão.</p>';
  } else {
    card.installments.forEach(inst => {
      const progressPercent = (inst.currentInstallment / inst.totalInstallments) * 100;
      
      const div = document.createElement('div');
      div.className = 'card';
      div.style.padding = '1rem';
      div.style.marginBottom = '0.5rem';
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <div>
            <h4 style="font-size:0.9rem; font-weight:600;">${inst.description}</h4>
            <span style="font-size:0.75rem; color:var(--text-muted);">Parcela ${inst.currentInstallment} de ${inst.totalInstallments}</span>
          </div>
          <div style="text-align:right;">
            <span class="mono" style="font-weight:700; color:var(--neon-pink);">${formatCurrency(inst.monthlyAmount)}/mês</span>
            <p style="font-size:0.7rem; color:var(--text-muted);">Total: ${formatCurrency(inst.totalAmount)}</p>
          </div>
        </div>
        <div class="progress-bar-container" style="margin:0 0 0.5rem 0; height:4px;">
          <div class="progress-bar-fill" style="width: ${progressPercent}%; background: linear-gradient(to right, ${card.color}, var(--neon-pink));"></div>
        </div>
      `;
      instContainer.appendChild(div);
    });
  }
}

// ABA: QUITAR DÍVIDAS & EMPRÉSTIMOS
function renderDebts() {
  const container = document.getElementById('debtsListContainer');
  container.innerHTML = '';
  
  if (!state.debts || state.debts.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:3rem;">Você não possui dívidas cadastradas. Excelente! 🎉</p>';
    return;
  }
  
  state.debts.forEach(debt => {
    // Prioridades neon
    let colorClass = "glow-orange";
    let badgeText = "Normal";
    let badgeClass = "badge-orange";
    
    if (debt.priority === 'high') {
      colorClass = "glow-pink";
      badgeText = "Urgente (Juros Altos)";
      badgeClass = "badge-pink";
    } else if (debt.priority === 'low') {
      colorClass = "glow-green";
      badgeText = "Baixa";
      badgeClass = "badge-green";
    }
    
    // Cálculo de progresso de quitação (se houver total contratado)
    let progressHtml = "";
    if (debt.totalInstallments > 0) {
      const paidInstallments = debt.totalInstallments - debt.remainingInstallments;
      const progressPercent = (paidInstallments / debt.totalInstallments) * 100;
      progressHtml = `
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-top:0.75rem; color:var(--text-muted);">
          <span>Parcelas Pagas: ${paidInstallments}/${debt.totalInstallments}</span>
          <span>${Math.round(progressPercent)}%</span>
        </div>
        <div class="progress-bar-container" style="margin: 0.25rem 0 0.5rem 0; height:6px;">
          <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
        </div>
      `;
    }
    
    const div = document.createElement('div');
    div.className = `card ${colorClass}`;
    div.style.padding = '1.25rem';
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <span class="badge ${badgeClass}" style="margin-bottom:0.5rem;">${badgeText}</span>
          <h4 style="font-size:1.05rem; font-weight:700;">${debt.name}</h4>
          <span style="font-size:0.8rem; color:var(--text-muted);">Taxa: <strong class="color-orange">${debt.interestRate}% a.m.</strong></span>
        </div>
        <div style="text-align:right;">
          <span class="mono" style="font-size:1.25rem; font-weight:700; color:var(--neon-orange);">${formatCurrency(debt.balance)}</span>
          <p style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Parcela: ${formatCurrency(debt.monthlyPayment)}/mês</p>
        </div>
      </div>
      ${progressHtml}
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.75rem;">
        <button class="btn btn-secondary btn-sm" onclick="amortizeDebt('${debt.id}')"><i class="fa-solid fa-hand-holding-dollar"></i> Amortizar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteDebt('${debt.id}')" title="Excluir"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `;
    container.appendChild(div);
  });
}

function deleteDebt(debtId) {
  if (confirm("Deseja realmente remover esta dívida do painel?")) {
    state.debts = state.debts.filter(d => d.id !== debtId);
    saveState();
    renderApp();
  }
}

function amortizeDebt(debtId) {
  const debt = state.debts.find(d => d.id === debtId);
  if (!debt) return;
  
  const amountStr = prompt(`Quanto deseja amortizar diretamente do saldo devedor de "${debt.name}"?\n(Saldo Atual: ${formatCurrency(debt.balance)})`);
  const amount = parseFloat(amountStr);
  
  if (isNaN(amount) || amount <= 0) return;
  
  if (amount > state.profile.balancePF) {
    alert("Saldo PF insuficiente para esta amortização!");
    return;
  }
  
  state.profile.balancePF -= amount;
  debt.balance = Math.max(0, debt.balance - amount);
  
  // Registra no extrato PF
  state.transactionsPF.push({
    id: 'pf_t_amort_' + Date.now(),
    description: `Amortização Dívida: ${debt.name}`,
    amount: -amount,
    date: new Date().toISOString().split('T')[0],
    type: "expense",
    category: "Juros/Quitação"
  });
  
  if (debt.balance === 0) {
    alert(`Parabéns! Você quitou totalmente a dívida "${debt.name}"! 🎉`);
  }
  
  saveState();
  renderApp();
}

// SIMULADOR DE QUITAÇÃO (AVALANCHE vs BOLA DE NEVE)
function runDebtSimulation() {
  if (!state.debts || state.debts.length === 0) return;
  
  const method = document.getElementById('simulationMethod').value;
  const extraAmount = parseFloat(document.getElementById('simulationExtraAmount').value) || 0;
  
  // 1. Simulação Baseline (Sem aporte extra)
  const baseResult = simulateDebtPayoff(0, method);
  // 2. Simulação Com Aporte Extra
  const targetResult = simulateDebtPayoff(extraAmount, method);
  
  // Atualiza tela
  document.getElementById('simDebtOriginalMonths').innerText = `${baseResult.months} meses`;
  document.getElementById('simDebtNewMonths').innerText = `${targetResult.months} meses`;
  
  const savedMonths = baseResult.months - targetResult.months;
  document.getElementById('simDebtSavedMonths').innerText = savedMonths > 0 
    ? `${savedMonths} meses mais rápido!` 
    : "Mesmo tempo";
    
  const savedInterest = baseResult.totalInterestPaid - targetResult.totalInterestPaid;
  document.getElementById('simDebtInterestSaved').innerText = formatCurrency(Math.max(0, savedInterest));
}

// Simulador Matemático de Dívidas
function simulateDebtPayoff(extraMonthly, method) {
  // Criar clone profundo das dívidas
  let tempDebts = state.debts.map(d => ({
    name: d.name,
    balance: d.balance,
    monthlyPayment: d.monthlyPayment,
    interestRate: d.interestRate,
    priority: d.priority
  }));
  
  let months = 0;
  let totalInterestPaid = 0;
  const maxMonths = 360; // 30 anos limite para evitar loops
  
  while (months < maxMonths) {
    // Filtra apenas as dívidas com saldo ativo
    let activeDebts = tempDebts.filter(d => d.balance > 0);
    if (activeDebts.length === 0) break;
    
    // Calcula o juro do mês corrente antes do pagamento e acumula
    activeDebts.forEach(d => {
      let monthlyInterest = d.balance * (d.interestRate / 100);
      d.balance += monthlyInterest;
      totalInterestPaid += monthlyInterest;
    });
    
    // Ordena conforme o método selecionado
    if (method === 'avalanche') {
      // Ordenar por taxa de juros decrescente (Juros altos primeiro)
      activeDebts.sort((a, b) => b.interestRate - a.interestRate);
    } else {
      // Snowball: Ordenar por menor saldo devedor crescente (Dívidas menores primeiro)
      activeDebts.sort((a, b) => a.balance - b.balance);
    }
    
    // Reserva de Aporte Mensal do Usuário
    let extraAvailable = extraMonthly;
    
    // Aplicação dos pagamentos mensais
    for (let i = 0; i < activeDebts.length; i++) {
      let d = activeDebts[i];
      let minPayment = d.monthlyPayment;
      
      // Se for a dívida de maior prioridade (índice 0), aplicamos o aporte extra
      let paymentToApply = minPayment;
      if (i === 0) {
        paymentToApply += extraAvailable;
        extraAvailable = 0; // Consumiu o aporte extra
      }
      
      if (d.balance <= paymentToApply) {
        // Sobrou dinheiro! Dívida quitada neste mês
        let excess = paymentToApply - d.balance;
        d.balance = 0;
        
        // Joga a sobra de volta no pool extra para a próxima dívida no loop
        extraAvailable += excess;
      } else {
        d.balance -= paymentToApply;
      }
    }
    
    months++;
  }
  
  return { months, totalInterestPaid };
}

// ABA: METAS DE ECONOMIA
function renderGoals() {
  const container = document.getElementById('goalsListContainer');
  container.innerHTML = '';
  
  if (!state.goals || state.goals.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:3rem;">Nenhuma meta cadastrada.</p>';
    return;
  }
  
  state.goals.forEach(goal => {
    const progressPercent = Math.min(100, Math.round((goal.current / goal.target) * 100));
    
    const div = document.createElement('div');
    div.className = 'card goal-card';
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
        <div>
          <span class="badge badge-green" style="margin-bottom:0.25rem;">${goal.category}</span>
          <h4 style="font-size:1.05rem; font-weight:700;">${goal.name}</h4>
        </div>
        <span class="mono" style="font-size:1.15rem; font-weight:700; color:var(--neon-green);">${progressPercent}%</span>
      </div>
      
      <div class="progress-bar-container" style="height:6px; margin-bottom:0.75rem;">
        <div class="progress-bar-fill" style="width: ${progressPercent}%; background: linear-gradient(to right, var(--neon-green), var(--neon-cyan)); box-shadow:0 0 10px var(--neon-green-glow);"></div>
      </div>
      
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;">
        <span>Guardado: <strong>${formatCurrency(goal.current)}</strong></span>
        <span>Alvo: ${formatCurrency(goal.target)}</span>
      </div>
      
      <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
        <button class="btn btn-success btn-sm" onclick="openSaveGoalModal('${goal.id}')">
          <i class="fa-solid fa-piggy-bank"></i> Aportar
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteGoal('${goal.id}')" title="Excluir">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

function openSaveGoalModal(goalId) {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;
  
  document.getElementById('saveGoalId').value = goal.id;
  document.getElementById('saveGoalPrompt').innerHTML = `Você está adicionando economias para a meta <strong>"${goal.name}"</strong>.<br>Saldo PF Disponível: <strong>${formatCurrency(state.profile.balancePF)}</strong>`;
  document.getElementById('saveGoalAmount').value = '';
  
  openModal('modal-save-goal');
}

function handleSaveGoal(event) {
  event.preventDefault();
  const goalId = document.getElementById('saveGoalId').value;
  const amount = parseFloat(document.getElementById('saveGoalAmount').value);
  
  if (isNaN(amount) || amount <= 0) return;
  
  if (amount > state.profile.balancePF) {
    alert("Saldo PF insuficiente para efetuar este aporte na meta!");
    return;
  }
  
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;
  
  // Deduz da PF e adiciona na meta
  state.profile.balancePF -= amount;
  goal.current += amount;
  
  // Lança despesa de investimento no extrato PF
  state.transactionsPF.push({
    id: 'pf_t_goal_' + Date.now(),
    description: `Aporte Meta: ${goal.name}`,
    amount: -amount,
    date: new Date().toISOString().split('T')[0],
    type: "expense",
    category: "Investimento/Metas"
  });
  
  saveState();
  closeModal('modal-save-goal');
  renderApp();
  alert(`Parabéns! R$ ${amount.toFixed(2)} guardados com sucesso na meta "${goal.name}". 🎯`);
}

function deleteGoal(goalId) {
  if (confirm("Deseja realmente remover esta meta?")) {
    state.goals = state.goals.filter(g => g.id !== goalId);
    saveState();
    renderApp();
  }
}

// ABA: EXTRATO COMPLETO PF
function renderTransactions() {
  const table = document.getElementById('pfTransactionsTable');
  table.innerHTML = '';
  
  // Ordenar por data decrescente
  const sorted = [...state.transactionsPF].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (sorted.length === 0) {
    table.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Nenhum lançamento no extrato da conta física.</td></tr>';
    return;
  }
  
  sorted.forEach(tx => {
    const isExpense = tx.amount < 0 || tx.type === 'expense';
    const colorClass = isExpense ? 'color-pink' : 'color-green';
    const typeText = isExpense ? 'Saída' : 'Entrada';
    const badgeClass = isExpense ? 'badge-pink' : 'badge-green';
    const absValue = Math.abs(tx.amount);
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${formatDateBr(tx.date)}</td>
      <td style="font-weight:600;">${tx.description}</td>
      <td><span class="badge badge-cyan">${tx.category}</span></td>
      <td><span class="badge ${badgeClass}">${typeText}</span></td>
      <td class="mono font-bold ${colorClass}">${isExpense ? '-' : '+'}&nbsp;${formatCurrency(absValue)}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteTransaction('${tx.id}')" title="Excluir lançamento"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    `;
    table.appendChild(tr);
  });
}

function deleteTransaction(txId) {
  if (confirm("Excluir esta transação? Isso irá desfazer o impacto no seu Saldo PF.")) {
    const tx = state.transactionsPF.find(t => t.id === txId);
    if (tx) {
      // Reverte o saldo PF
      state.profile.balancePF -= tx.amount; // Se era negativo, adiciona. Se positivo, subtrai.
      
      state.transactionsPF = state.transactionsPF.filter(t => t.id !== txId);
      saveState();
      renderApp();
    }
  }
}

// 5. ATUALIZAÇÃO E CONFIGURAÇÃO DE GRÁFICOS (CHART.JS NEON)
function updateCharts() {
  const ctxIE = document.getElementById('chartIncomesExpenses').getContext('2d');
  const ctxCat = document.getElementById('chartCategories').getContext('2d');
  
  // Destruir instâncias antigas para poder recriar com novos dados
  if (chartIncomesExpensesInstance) chartIncomesExpensesInstance.destroy();
  if (chartCategoriesInstance) chartCategoriesInstance.destroy();
  
  // Processamento de dados: Receitas vs Despesas PF por mês
  // Vamos agrupar os últimos 4 meses
  const monthlyData = {};
  state.transactionsPF.forEach(tx => {
    const monthKey = tx.date.substring(0, 7); // YYYY-MM
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expense: 0 };
    }
    if (tx.amount > 0 && tx.type === 'income') {
      monthlyData[monthKey].income += tx.amount;
    } else {
      monthlyData[monthKey].expense += Math.abs(tx.amount);
    }
  });
  
  // Ordenar chaves dos meses
  const sortedMonths = Object.keys(monthlyData).sort();
  const labelsMonths = sortedMonths.map(m => {
    const pts = m.split('-');
    const monthsNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${monthsNames[parseInt(pts[1]) - 1]}/${pts[0].substring(2)}`;
  });
  
  const incomesValues = sortedMonths.map(m => monthlyData[m].income);
  const expensesValues = sortedMonths.map(m => monthlyData[m].expense);

  // Gráfico 1: Receitas vs Despesas
  chartIncomesExpensesInstance = new Chart(ctxIE, {
    type: 'bar',
    data: {
      labels: labelsMonths.length > 0 ? labelsMonths : ["Sem dados"],
      datasets: [
        {
          label: 'Entradas (PF)',
          data: incomesValues.length > 0 ? incomesValues : [0],
          backgroundColor: 'rgba(57, 255, 20, 0.2)',
          borderColor: '#39ff14',
          borderWidth: 2,
          borderRadius: 6,
          boxShadow: '0 0 10px rgba(57, 255, 20, 0.4)'
        },
        {
          label: 'Saídas (PF)',
          data: expensesValues.length > 0 ? expensesValues : [0],
          backgroundColor: 'rgba(255, 0, 127, 0.2)',
          borderColor: '#ff007f',
          borderWidth: 2,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9ca3af', font: { family: 'Outfit' } } }
      },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Outfit' } } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Outfit' } } }
      }
    }
  });

  // Processamento de dados: Despesas por Categoria
  const catData = {};
  
  // Adiciona transações PF do tipo despesa
  state.transactionsPF.forEach(tx => {
    if (tx.amount < 0 || tx.type === 'expense') {
      const cat = tx.category || 'Outros';
      catData[cat] = (catData[cat] || 0) + Math.abs(tx.amount);
    }
  });
  
  // Adiciona compras ativas de todos os cartões (fatura corrente)
  state.creditCards.forEach(card => {
    card.transactions.forEach(t => {
      const cat = t.category || 'Cartão';
      catData[cat] = (catData[cat] || 0) + t.amount;
    });
    card.installments.forEach(inst => {
      catData['Cartão (Parcelado)'] = (catData['Cartão (Parcelado)'] || 0) + inst.monthlyAmount;
    });
  });

  const catLabels = Object.keys(catData);
  const catValues = Object.values(catData);
  
  // Paleta de cores neon para categorias
  const neonPalette = [
    '#ff007f', // Pink
    '#00f0ff', // Cyan
    '#ff9e00', // Orange
    '#9d4edd', // Purple
    '#39ff14', // Green
    '#ffef00', // Yellow
    '#ff5500', // Red-Orange
    '#0055ff'  // Blue
  ];

  // Gráfico 2: Despesas por Categoria (Doughnut)
  chartCategoriesInstance = new Chart(ctxCat, {
    type: 'doughnut',
    data: {
      labels: catLabels.length > 0 ? catLabels : ["Sem despesas"],
      datasets: [{
        data: catValues.length > 0 ? catValues : [0],
        backgroundColor: catLabels.length > 0 ? neonPalette.slice(0, catLabels.length) : ['rgba(255, 255, 255, 0.05)'],
        borderColor: '#12141d',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#9ca3af', font: { family: 'Outfit', size: 11 } }
        }
      }
    }
  });
}

// 6. AUXILIARES DE SUBMISSÃO DE FORMULÁRIOS (LIGAÇÕES DE MODAIS)
function setupFormListeners() {
  // Lançamento PF
  document.getElementById('formAddTransaction').addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('txDesc').value;
    const amountVal = parseFloat(document.getElementById('txAmount').value);
    const type = document.getElementById('txType').value;
    const cat = document.getElementById('txCategory').value;
    const date = document.getElementById('txDate').value;
    
    const amount = type === 'expense' ? -Math.abs(amountVal) : Math.abs(amountVal);
    
    // Adiciona transação
    state.transactionsPF.push({
      id: 'pf_t_' + Date.now(),
      description: desc,
      amount: amount,
      date: date,
      type: type,
      category: cat
    });
    
    // Atualiza saldo PF
    state.profile.balancePF += amount;
    
    saveState();
    closeModal('modal-add-transaction');
    renderApp();
    
    // Limpar formulário
    document.getElementById('formAddTransaction').reset();
  });

  // Novo Faturamento PJ
  document.getElementById('formAddInvoice').addEventListener('submit', (e) => {
    e.preventDefault();
    const client = document.getElementById('invClient').value;
    const amount = parseFloat(document.getElementById('invAmount').value);
    const date = document.getElementById('invDate').value;
    
    state.pj.monthlyInvoices.push({
      id: 'inv_' + Date.now(),
      client: client,
      amount: amount,
      date: date,
      status: 'received' // Já assume recebido para facilitar fluxo PJ
    });
    
    // Incrementa saldo PJ
    state.pj.balance += amount;
    
    saveState();
    closeModal('modal-add-invoice');
    renderApp();
    document.getElementById('formAddInvoice').reset();
  });

  // Ajustes Tributários PJ
  document.getElementById('formEditTaxes').addEventListener('submit', (e) => {
    e.preventDefault();
    const das = parseFloat(document.getElementById('taxDasRate').value);
    const acc = parseFloat(document.getElementById('taxAccounting').value);
    const bank = parseFloat(document.getElementById('taxBank').value);
    
    state.pj.taxesConfig.dasRate = das;
    state.pj.taxesConfig.accountingFee = acc;
    state.pj.taxesConfig.bankFee = bank;
    
    saveState();
    closeModal('modal-edit-taxes');
    renderApp();
  });

  // Configuração Dia do Pagamento
  document.getElementById('formConfigPayday').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('paydayTypeSelect').value;
    const percent = parseInt(document.getElementById('paydayGoalPercentInput').value) || 0;
    
    state.profile.paydayType = type;
    state.profile.paydayGoalPercent = percent;
    
    saveState();
    closeModal('modal-config-payday');
    renderApp();
  });

  // Nova Conta a Pagar
  document.getElementById('formAddBill').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('billName').value;
    const amount = parseFloat(document.getElementById('billAmount').value);
    const dueDate = document.getElementById('billDueDate').value.toString().padStart(2, '0');
    const category = document.getElementById('billCategory').value;
    
    state.bills.push({
      id: 'bill_' + Date.now(),
      name: name,
      amount: amount,
      dueDate: dueDate,
      category: category,
      status: 'pending'
    });
    
    saveState();
    closeModal('modal-add-bill');
    renderApp();
    document.getElementById('formAddBill').reset();
  });

  // Adicionar Cartão
  document.getElementById('formAddCard').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('cardName').value;
    const limit = parseFloat(document.getElementById('cardLimit').value);
    const close = parseInt(document.getElementById('cardCloseDay').value);
    const due = parseInt(document.getElementById('cardDueDay').value);
    const color = document.getElementById('cardColor').value;
    
    const newCard = {
      id: 'card_' + Date.now(),
      name: name,
      color: color,
      limit: limit,
      closeDay: close,
      dueDay: due,
      transactions: [],
      installments: []
    };
    
    state.creditCards.push(newCard);
    selectedCardId = newCard.id; // Foca no cartão criado
    
    saveState();
    closeModal('modal-add-card');
    renderApp();
    document.getElementById('formAddCard').reset();
  });

  // Lançar no Cartão
  document.getElementById('formAddCardTransaction').addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('cardTxDesc').value;
    const amount = parseFloat(document.getElementById('cardTxAmount').value);
    const date = document.getElementById('cardTxDate').value;
    const cat = document.getElementById('cardTxCategory').value;
    
    const card = state.creditCards.find(c => c.id === selectedCardId);
    if (!card) return;
    
    card.transactions.push({
      id: 'card_tx_' + Date.now(),
      description: desc,
      amount: amount,
      date: date,
      category: cat
    });
    
    saveState();
    closeModal('modal-add-card-transaction');
    renderApp();
    document.getElementById('formAddCardTransaction').reset();
  });

  // Nova Compra Parcelada
  document.getElementById('formAddInstallment').addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('instDesc').value;
    const total = parseFloat(document.getElementById('instTotalAmount').value);
    const count = parseInt(document.getElementById('instCount').value);
    const date = document.getElementById('instDate').value;
    
    const card = state.creditCards.find(c => c.id === selectedCardId);
    if (!card) return;
    
    const monthly = total / count;
    
    card.installments.push({
      id: 'inst_' + Date.now(),
      description: desc,
      totalAmount: total,
      monthlyAmount: monthly,
      currentInstallment: 1, // Começa na parcela 1
      totalInstallments: count,
      date: date
    });
    
    saveState();
    closeModal('modal-add-installment');
    renderApp();
    document.getElementById('formAddInstallment').reset();
  });

  // Nova Dívida
  document.getElementById('formAddDebt').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('debtName').value;
    const balance = parseFloat(document.getElementById('debtBalance').value);
    const rate = parseFloat(document.getElementById('debtRate').value);
    const monthly = parseFloat(document.getElementById('debtMonthly').value);
    const priority = document.getElementById('debtPriority').value;
    const remaining = parseInt(document.getElementById('debtRemaining').value);
    const totalInst = parseInt(document.getElementById('debtTotalInst').value);
    
    state.debts.push({
      id: 'debt_' + Date.now(),
      name: name,
      balance: balance,
      monthlyPayment: monthly,
      interestRate: rate,
      remainingInstallments: remaining,
      totalInstallments: totalInst,
      priority: priority
    });
    
    saveState();
    closeModal('modal-add-debt');
    renderApp();
    document.getElementById('formAddDebt').reset();
  });

  // Nova Meta
  document.getElementById('formAddGoal').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('goalName').value;
    const target = parseFloat(document.getElementById('goalTarget').value);
    const current = parseFloat(document.getElementById('goalCurrent').value) || 0;
    const category = document.getElementById('goalCategory').value;
    
    state.goals.push({
      id: 'goal_' + Date.now(),
      name: name,
      target: target,
      current: current,
      category: category
    });
    
    saveState();
    closeModal('modal-add-goal');
    renderApp();
    document.getElementById('formAddGoal').reset();
  });
}

// 7. LÓGICA DE GERENCIAMENTO DE MODAIS (ABRIR / FECHAR)
function openModal(modalId) {
  // Preenche valores padrão se aplicável
  if (modalId === 'modal-add-transaction') {
    document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
  } else if (modalId === 'modal-add-invoice') {
    document.getElementById('invDate').value = new Date().toISOString().split('T')[0];
  } else if (modalId === 'modal-edit-taxes') {
    document.getElementById('taxDasRate').value = state.pj.taxesConfig.dasRate;
    document.getElementById('taxAccounting').value = state.pj.taxesConfig.accountingFee;
    document.getElementById('taxBank').value = state.pj.taxesConfig.bankFee;
  } else if (modalId === 'modal-add-card-transaction') {
    document.getElementById('cardTxDate').value = new Date().toISOString().split('T')[0];
  } else if (modalId === 'modal-add-installment') {
    document.getElementById('instDate').value = new Date().toISOString().split('T')[0];
  }

  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

// 8. REDEFINIÇÃO DE DADOS (Zerar / Demonstrativo)
function clearAllData() {
  if (confirm("Tem certeza que deseja zerar TODAS as informações do seu painel? Isso apagará tudo e abrirá o Assistente de Configuração Inicial.")) {
    localStorage.setItem('neonfi_onboarded', 'false');
    state = JSON.parse(JSON.stringify(window.EMPTY_TEMPLATE));
    saveState();
    location.reload(); // Recarrega para iniciar o Onboarding
  }
}

function resetToMockData() {
  if (confirm("Deseja restaurar os dados fictícios de demonstração? Seus lançamentos atuais serão substituídos.")) {
    localStorage.setItem('neonfi_onboarded', 'true');
    state = JSON.parse(JSON.stringify(window.INITIAL_DATA));
    saveState();
    location.reload(); // Recarrega para desenhar o dashboard com a demo
  }
}

// 9. LÓGICA DO ASSISTENTE DE CONFIGURAÇÃO (ONBOARDING WIZARD)
function updateWizardUI() {
  // Oculta todas as etapas
  document.querySelectorAll('.wizard-step').forEach(step => {
    step.style.display = 'none';
  });
  
  // Mostra a etapa atual
  const activeStep = document.querySelector(`.wizard-step[data-step="${currentWizardStep}"]`);
  if (activeStep) activeStep.style.display = 'block';
  
  // Atualiza barra de progresso
  const totalSteps = 7;
  const progressPercent = (currentWizardStep / totalSteps) * 100;
  document.getElementById('wizardProgressBar').style.width = `${progressPercent}%`;
  
  const stepLabels = [
    "Identificação e Perfil",
    "Estrutura da sua PJ",
    "Cartões de Crédito",
    "Contas Fixas Mensais",
    "Empréstimos e Dívidas",
    "Reserva e Metas",
    "Revisão de Cadastro"
  ];
  document.getElementById('wizardStepIndicator').innerText = `Passo ${currentWizardStep} de ${totalSteps}: ${stepLabels[currentWizardStep - 1]}`;
  
  // Configura botões de navegação
  const btnPrev = document.getElementById('wizardBtnPrev');
  const btnNext = document.getElementById('wizardBtnNext');
  const btnDemo = document.getElementById('wizardBtnDemo');
  
  if (currentWizardStep === 1) {
    btnPrev.style.visibility = 'hidden';
    btnDemo.style.display = 'inline-flex';
  } else {
    btnPrev.style.visibility = 'visible';
    btnDemo.style.display = 'none';
  }
  
  if (currentWizardStep === totalSteps) {
    btnNext.innerHTML = 'Finalizar Setup <i class="fa-solid fa-circle-check"></i>';
    btnNext.className = 'btn btn-success';
  } else {
    btnNext.innerHTML = 'Avançar <i class="fa-solid fa-chevron-right"></i>';
    btnNext.className = 'btn btn-primary';
  }
  
  // Lógicas de renderização interna de cada passo
  if (currentWizardStep === 3) renderSetupCardsList();
  if (currentWizardStep === 4) renderSetupBillsList();
  if (currentWizardStep === 5) renderSetupDebtsList();
  if (currentWizardStep === 6) renderSetupGoalsList();
  if (currentWizardStep === 7) populateWizardSummary();
}

function prevWizardStep() {
  if (currentWizardStep > 1) {
    currentWizardStep--;
    updateWizardUI();
  }
}

function nextWizardStep() {
  // Validações antes de avançar
  if (currentWizardStep === 1) {
    const nameVal = document.getElementById('setupName').value.trim();
    const balancePFVal = parseFloat(document.getElementById('setupBalancePF').value);
    
    if (!nameVal) {
      alert("Por favor, insira o seu nome para continuar.");
      return;
    }
    if (isNaN(balancePFVal)) {
      alert("Por favor, insira um valor válido para o saldo físico.");
      return;
    }
    
    state.profile.name = nameVal;
    state.profile.balancePF = balancePFVal;
    state.profile.paydayType = document.getElementById('setupPaydayType').value;
  }
  
  if (currentWizardStep === 2) {
    const balancePJVal = parseFloat(document.getElementById('setupBalancePJ').value);
    const dasVal = parseFloat(document.getElementById('setupDasRate').value);
    const accVal = parseFloat(document.getElementById('setupAccounting').value);
    const bankVal = parseFloat(document.getElementById('setupBankFee').value);
    
    if (isNaN(balancePJVal) || isNaN(dasVal) || isNaN(accVal) || isNaN(bankVal)) {
      alert("Por favor, preencha todos os valores PJ com números válidos.");
      return;
    }
    
    state.pj.balance = balancePJVal;
    state.pj.taxesConfig.dasRate = dasVal;
    state.pj.taxesConfig.accountingFee = accVal;
    state.pj.taxesConfig.bankFee = bankVal;
  }
  
  if (currentWizardStep === 7) {
    // Finalizar setup
    localStorage.setItem('neonfi_onboarded', 'true');
    saveState();
    
    // Transiciona UI e reinicializa
    location.reload();
    return;
  }
  
  currentWizardStep++;
  updateWizardUI();
}

// Suporte a digitação e cliques

function skipWizardWithDemo() {
  if (confirm("Deseja pular a configuração inicial e carregar os dados de demonstração fictícios?")) {
    localStorage.setItem('neonfi_onboarded', 'true');
    state = JSON.parse(JSON.stringify(window.INITIAL_DATA));
    saveState();
    location.reload();
  }
}

// Cartões no Wizard
function renderSetupCardsList() {
  const tbody = document.getElementById('setupCardsList');
  tbody.innerHTML = '';
  if (state.creditCards.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); font-size:0.75rem;">Nenhum cartão cadastrado.</td></tr>';
    return;
  }
  state.creditCards.forEach(card => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:${card.color}; font-weight:600;">${card.name}</td>
      <td class="mono">${formatCurrency(card.limit)}</td>
      <td>Dia ${card.dueDay}</td>
      <td><button type="button" class="btn btn-danger btn-sm" onclick="removeCardInSetup('${card.id}')" style="padding:0.2rem 0.5rem;"><i class="fa-solid fa-trash-can"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
}

function addCardInSetup() {
  const name = document.getElementById('scName').value.trim();
  const limit = parseFloat(document.getElementById('scLimit').value);
  const close = parseInt(document.getElementById('scClose').value);
  const due = parseInt(document.getElementById('scDue').value);
  const color = document.getElementById('scColor').value;
  
  if (!name || isNaN(limit) || isNaN(close) || isNaN(due)) {
    alert("Preencha todos os campos do cartão antes de adicionar!");
    return;
  }
  
  state.creditCards.push({
    id: 'card_' + Date.now(),
    name: name,
    color: color,
    limit: limit,
    closeDay: close,
    dueDay: due,
    transactions: [],
    installments: []
  });
  
  document.getElementById('scName').value = '';
  document.getElementById('scLimit').value = '';
  document.getElementById('scClose').value = '';
  document.getElementById('scDue').value = '';
  
  renderSetupCardsList();
}

function removeCardInSetup(id) {
  state.creditCards = state.creditCards.filter(c => c.id !== id);
  renderSetupCardsList();
}

// Contas no Wizard
function renderSetupBillsList() {
  const tbody = document.getElementById('setupBillsList');
  tbody.innerHTML = '';
  if (state.bills.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); font-size:0.75rem;">Nenhuma conta cadastrada.</td></tr>';
    return;
  }
  state.bills.forEach(bill => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${bill.name}</td>
      <td class="mono">${formatCurrency(bill.amount)}</td>
      <td>Dia ${bill.dueDate}</td>
      <td><button type="button" class="btn btn-danger btn-sm" onclick="removeBillInSetup('${bill.id}')" style="padding:0.2rem 0.5rem;"><i class="fa-solid fa-trash-can"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
}

function addBillInSetup() {
  const name = document.getElementById('sbName').value.trim();
  const amount = parseFloat(document.getElementById('sbAmount').value);
  const due = parseInt(document.getElementById('sbDue').value);
  const category = document.getElementById('sbCategory').value;
  
  if (!name || isNaN(amount) || isNaN(due)) {
    alert("Preencha todos os campos da conta antes de adicionar!");
    return;
  }
  
  state.bills.push({
    id: 'bill_' + Date.now(),
    name: name,
    amount: amount,
    dueDate: due.toString().padStart(2, '0'),
    category: category,
    status: 'pending'
  });
  
  document.getElementById('sbName').value = '';
  document.getElementById('sbAmount').value = '';
  document.getElementById('sbDue').value = '';
  
  renderSetupBillsList();
}

function removeBillInSetup(id) {
  state.bills = state.bills.filter(b => b.id !== id);
  renderSetupBillsList();
}

// Dívidas no Wizard
function renderSetupDebtsList() {
  const tbody = document.getElementById('setupDebtsList');
  tbody.innerHTML = '';
  if (state.debts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); font-size:0.75rem;">Nenhuma dívida cadastrada.</td></tr>';
    return;
  }
  state.debts.forEach(debt => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${debt.name}</td>
      <td class="mono color-pink">${formatCurrency(debt.balance)}</td>
      <td class="mono">${debt.interestRate}% a.m.</td>
      <td><button type="button" class="btn btn-danger btn-sm" onclick="removeDebtInSetup('${debt.id}')" style="padding:0.2rem 0.5rem;"><i class="fa-solid fa-trash-can"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
}

function addDebtInSetup() {
  const name = document.getElementById('sdName').value.trim();
  const balance = parseFloat(document.getElementById('sdBalance').value);
  const rate = parseFloat(document.getElementById('sdRate').value);
  const monthly = parseFloat(document.getElementById('sdMonthly').value);
  const priority = document.getElementById('sdPriority').value;
  
  if (!name || isNaN(balance) || isNaN(rate) || isNaN(monthly)) {
    alert("Preencha todos os campos da dívida!");
    return;
  }
  
  state.debts.push({
    id: 'debt_' + Date.now(),
    name: name,
    balance: balance,
    monthlyPayment: monthly,
    interestRate: rate,
    remainingInstallments: 0,
    totalInstallments: 0,
    priority: priority
  });
  
  document.getElementById('sdName').value = '';
  document.getElementById('sdBalance').value = '';
  document.getElementById('sdRate').value = '';
  document.getElementById('sdMonthly').value = '';
  
  renderSetupDebtsList();
}

function removeDebtInSetup(id) {
  state.debts = state.debts.filter(d => d.id !== id);
  renderSetupDebtsList();
}

// Metas no Wizard
function renderSetupGoalsList() {
  const tbody = document.getElementById('setupGoalsList');
  tbody.innerHTML = '';
  if (state.goals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); font-size:0.75rem;">Nenhuma meta cadastrada.</td></tr>';
    return;
  }
  state.goals.forEach(goal => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${goal.name}</td>
      <td class="mono">${formatCurrency(goal.target)}</td>
      <td class="mono color-green">${formatCurrency(goal.current)}</td>
      <td><button type="button" class="btn btn-danger btn-sm" onclick="removeGoalInSetup('${goal.id}')" style="padding:0.2rem 0.5rem;"><i class="fa-solid fa-trash-can"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
}

function addGoalInSetup() {
  const name = document.getElementById('sgName').value.trim();
  const target = parseFloat(document.getElementById('sgTarget').value);
  const current = parseFloat(document.getElementById('sgCurrent').value) || 0;
  
  if (!name || isNaN(target)) {
    alert("Digite o nome e o valor alvo da meta!");
    return;
  }
  
  state.goals.push({
    id: 'goal_' + Date.now(),
    name: name,
    target: target,
    current: current,
    category: "Segurança"
  });
  
  document.getElementById('sgName').value = '';
  document.getElementById('sgTarget').value = '';
  document.getElementById('sgCurrent').value = '0.00';
  
  renderSetupGoalsList();
}

function removeGoalInSetup(id) {
  state.goals = state.goals.filter(g => g.id !== id);
  renderSetupGoalsList();
}

// Sumário
function populateWizardSummary() {
  document.getElementById('swName').innerText = state.profile.name;
  document.getElementById('swBalancePF').innerText = formatCurrency(state.profile.balancePF);
  document.getElementById('swBalancePJ').innerText = formatCurrency(state.pj.balance);
  document.getElementById('swCardsCount').innerText = state.creditCards.length;
  document.getElementById('swBillsCount').innerText = state.bills.length;
  document.getElementById('swDebtsCount').innerText = state.debts.length;
}

// ==========================================================================
// 10. MOTOR DO CONSELHEIRO FINANCEIRO AI (SIMULADOR DE CENÁRIOS)
// ==========================================================================

function renderAiAdvisor() {
  // Inicializa o chat se estiver vazio
  if (chatHistory.length === 0) {
    const userFirstName = state.profile.name ? state.profile.name.split(" ")[0] : "Rafael";
    
    // Calcula a fatura do cartão
    let totalCardInvoice = 0;
    state.creditCards.forEach(c => {
      const txSum = c.transactions.reduce((acc, t) => acc + t.amount, 0);
      const instSum = c.installments.reduce((acc, inst) => acc + inst.monthlyAmount, 0);
      totalCardInvoice += (txSum + instSum);
    });
    if (totalCardInvoice === 0) totalCardInvoice = 4500;

    // Busca o salário PF aproximado
    let salary = 4000;
    const lastProLabore = state.transactionsPF.find(t => t.type === 'income' && t.category === 'Pró-Labore');
    if (lastProLabore) salary = Math.abs(lastProLabore.amount);

    chatHistory.push({
      sender: 'assistant',
      text: `Olá, <strong>${userFirstName}</strong>! Eu sou o seu <strong>Conselheiro AI</strong> de finanças.<br><br>Fiz um diagnóstico rápido na sua carteira:<br>• Saldo PF disponível: <strong>${formatCurrency(state.profile.balancePF)}</strong><br>• Saldo PJ disponível: <strong>${formatCurrency(state.pj.balance)}</strong><br>• Faturas acumuladas em cartões: <strong class="color-pink">${formatCurrency(totalCardInvoice)}</strong><br>• Seu salário PF estimado: <strong>${formatCurrency(salary)}/mês</strong>.<br><br>Percebi que você tem <strong>${formatCurrency(totalCardInvoice)}</strong> de fatura e sua renda é de <strong>${formatCurrency(salary)}</strong>. Essa é uma situação crítica clássica! Como posso te ajudar a planejar sua manobra de sobrevivência hoje?`
    });
  }
  
  renderChatMessages();
  renderSuggestions();
  updateImpactPanel();
}

function renderChatMessages() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  
  chatHistory.forEach(msg => {
    const div = document.createElement('div');
    div.className = `chat-message msg-${msg.sender}`;
    
    const initials = msg.sender === 'assistant' ? 'AI' : 'PF';
    
    div.innerHTML = `
      <div class="chat-avatar">${initials}</div>
      <div class="chat-bubble">${msg.text}</div>
    `;
    container.appendChild(div);
  });
  
  // Auto-scroll
  container.scrollTop = container.scrollHeight;
}

function renderSuggestions() {
  const container = document.getElementById('chatSuggestions');
  container.innerHTML = '';
  
  // Calcula valores contextuais
  let invoiceVal = 4500;
  if (state.creditCards && state.creditCards.length > 0) {
    let sum = 0;
    state.creditCards.forEach(c => {
      sum += c.transactions.reduce((acc, t) => acc + t.amount, 0);
      sum += c.installments.reduce((acc, inst) => acc + inst.monthlyAmount, 0);
    });
    if (sum > 0) invoiceVal = sum;
  }
  
  let incomeVal = 4000;
  const lastProLabore = state.transactionsPF.find(t => t.type === 'income' && t.category === 'Pró-Labore');
  if (lastProLabore) incomeVal = Math.abs(lastProLabore.amount);

  // Propostas de perguntas rápidas baseadas no cenário
  const suggestions = [
    { label: `🔴 Fatura de ${formatCurrency(invoiceVal)} vs Renda de ${formatCurrency(incomeVal)}. O que fazer?`, text: `Minha fatura de ${formatCurrency(invoiceVal)} é maior que meu salário de ${formatCurrency(incomeVal)}. Quais opções eu tenho?` },
    { label: `💳 Vale a pena parcelar a fatura do cartão?`, text: `Se eu decidir parcelar a fatura do cartão, quais são os impactos reais a longo prazo?` },
    { label: `🏛️ Empréstimo Pessoal para quitar o cartão vale a pena?`, text: `Pegar um empréstimo pessoal com taxa menor para pagar a fatura inteira do cartão é uma boa estratégia?` },
    { label: `💼 Renda Extra PJ + Corte Radical de gastos`, text: `Como funciona a estratégia de renda extra corporativa combinada com corte extremo de custos para pagar o cartão?` }
  ];
  
  suggestions.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suggestion-btn';
    btn.innerText = s.label;
    btn.onclick = () => {
      document.getElementById('chatInput').value = s.text;
      handleChatSubmit(null);
    };
    container.appendChild(btn);
  });
}

function handleChatSubmit(event) {
  if (event) event.preventDefault();
  
  const input = document.getElementById('chatInput');
  const userText = input.value.trim();
  if (!userText) return;
  
  // 1. Adiciona a mensagem do usuário
  chatHistory.push({
    sender: 'user',
    text: userText
  });
  
  renderChatMessages();
  input.value = '';
  
  // Mostra um "digitando..." temporário
  const container = document.getElementById('chatMessages');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'chat-message msg-assistant';
  typingDiv.id = 'chatTypingIndicator';
  typingDiv.innerHTML = `
    <div class="chat-avatar">AI</div>
    <div class="chat-bubble" style="opacity: 0.5;">Analisando dados e calculando juros... <i class="fa-solid fa-spinner fa-spin"></i></div>
  `;
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;
  
  // 2. Processa resposta do conselheiro com pequeno delay
  setTimeout(() => {
    const indicator = document.getElementById('chatTypingIndicator');
    if (indicator) indicator.remove();
    
    const responseText = getAdvisorResponse(userText);
    chatHistory.push({
      sender: 'assistant',
      text: responseText
    });
    
    renderChatMessages();
    updateImpactPanel();
  }, 1000);
}

function getAdvisorResponse(text) {
  const query = text.toLowerCase();
  
  // Calcula valores do estado do usuário
  let invoiceVal = 4500;
  if (state.creditCards && state.creditCards.length > 0) {
    let sum = 0;
    state.creditCards.forEach(c => {
      sum += c.transactions.reduce((acc, t) => acc + t.amount, 0);
      sum += c.installments.reduce((acc, inst) => acc + inst.monthlyAmount, 0);
    });
    if (sum > 0) invoiceVal = sum;
  }
  
  let incomeVal = 4000;
  const lastProLabore = state.transactionsPF.find(t => t.type === 'income' && t.category === 'Pró-Labore');
  if (lastProLabore) incomeVal = Math.abs(lastProLabore.amount);

  // 1. Cenário Geral de R$ 4500 de fatura vs R$ 4000 de salário
  if (query.includes('o que fazer') || query.includes('fatura de') || query.includes('maior que meu salário') || query.includes('aperto') || query.includes('lascado')) {
    activeSimulationOption = null;
    return `Essa é uma das armadilhas mais comuns de endividamento rápido. Como sua fatura de **${formatCurrency(invoiceVal)}** supera sua renda mensal líquida de **${formatCurrency(incomeVal)}**, você está com um **déficit de -${formatCurrency(invoiceVal - incomeVal)}** para este mês.<br><br>Você tem **3 manobras estratégicas principais** para passar por isso de forma consciente:<br><br>
    1️⃣ <strong>Opção 1: Parcelar a Fatura do Cartão</strong> (Conveniente, mas com juros rotativos abusivos).<br>
    2️⃣ <strong>Opção 2: Empréstimo de Juros Baixos</strong> (Troca de dívida cara por uma mais barata).<br>
    3️⃣ <strong>Opção 3: Renda Extra PJ + Corte Extremo</strong> (Aceleração e sacrifício temporário para pagar à vista).<br><br>
    Selecione um dos botões rápidos ou me diga qual opção quer simular para eu te mostrar as consequências matemáticas de <strong>curto, médio e longo prazo</strong> na barra ao lado!`;
  }
  
  // 2. Opção 1: Parcelar
  if (query.includes('parcelar a fatura') || query.includes('opção 1') || query.includes('impactos reais a longo prazo')) {
    activeSimulationOption = 1;
    // Cálculo juros Nubank parcelamento padrão de 9.5% a.m. em 12x
    const i = 0.095;
    const n = 12;
    const pmt = invoiceVal * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    const total = pmt * n;
    const interest = total - invoiceVal;
    
    return `<strong>Simulação da Opção 1: Parcelamento da Fatura no Cartão (taxa de 9.5% a.m.)</strong><br><br>
    Se você parcelar sua fatura de ${formatCurrency(invoiceVal)} em <strong>12 parcelas fixas</strong>:<br>
    • Parcela Mensal: <strong class="color-pink">${formatCurrency(pmt)}/mês</strong>.<br>
    • Total Pago no final: <strong>${formatCurrency(total)}</strong>.<br>
    • Juros jogados no lixo: <strong class="color-pink">${formatCurrency(interest)}</strong>.<br><br>
    ⚠️ <strong>Aviso Crítico:</strong> O limite do seu cartão ficará bloqueado e você comprometerá <strong>${((pmt / incomeVal) * 100).toFixed(0)}%</strong> da sua renda mensal de ${formatCurrency(incomeVal)} apenas pagando essa parcela pelo próximo ano! Veja a projeção temporal na barra lateral.`;
  }
  
  // 3. Opção 2: Empréstimo
  if (query.includes('empréstimo pessoal') || query.includes('opção 2') || query.includes('taxa menor')) {
    activeSimulationOption = 2;
    // Empréstimo pessoal com taxa de 3.5% a.m. em 12x
    const i = 0.035;
    const n = 12;
    const pmt = invoiceVal * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    const total = pmt * n;
    const interest = total - invoiceVal;
    
    // Compara com parcelamento
    const iCard = 0.095;
    const pmtCard = invoiceVal * (iCard * Math.pow(1 + iCard, n)) / (Math.pow(1 + iCard, n) - 1);
    const totalCard = pmtCard * n;
    const saved = totalCard - total;
    
    return `<strong>Simulação da Opção 2: Empréstimo Pessoal para pagar à vista (taxa de 3.5% a.m.)</strong><br><br>
    Pegando um empréstimo pessoal de ${formatCurrency(invoiceVal)} para liquidar o cartão à vista em <strong>12 parcelas</strong>:<br>
    • Parcela Mensal: <strong class="color-orange">${formatCurrency(pmt)}/mês</strong>.<br>
    • Total Pago: <strong>${formatCurrency(total)}</strong>.<br>
    • Juros Totais: <strong>${formatCurrency(interest)}</strong>.<br><br>
    🎉 <strong>Economia Real:</strong> Ao trocar a dívida cara do cartão pela dívida barata do empréstimo, você economiza <strong>${formatCurrency(saved)}</strong> em juros que iriam para o banco! Além disso, seu limite de cartão é liberado de imediato. Veja o impacto lateral detalhado.`;
  }
  
  // 4. Opção 3: Renda Extra + Corte
  if (query.includes('renda extra') || query.includes('corte radical') || query.includes('opção 3') || query.includes('corte extremo')) {
    activeSimulationOption = 3;
    const deficit = invoiceVal - incomeVal;
    
    return `<strong>Simulação da Opção 3: Renda Extra PJ + Corte Extremo (taxa 0%)</strong><br><br>
    Esta é a rota do guerreiro e a mais recomendada se você quer sair do aperto rápido sem dar dinheiro a bancos:<br>
    1. **Corte Radical**: Você suspende serviços não essenciais (lazer, ifood, assinaturas) gerando uma economia imediata de **R$ 500,00** no mês.<br>
    2. **Foco PJ**: Você prospecta serviços extras ou freelas pela PJ para levantar **R$ 1.500,00** adicionais neste mês.<br><br>
    Isso fecha o rombo de ${formatCurrency(deficit)}, permitindo que você liquide a fatura inteira à vista sem parcelamento e sem empréstimo!<br>
    • Juros acumulados pagos: <strong>R$ 0,00</strong>.<br>
    • Economia de juros frente ao cartão rotativo: <strong class="color-green">${formatCurrency(invoiceVal * 0.5)}</strong>.<br>
    • Impacto temporal detalhado exibido ao lado!`;
  }
  
  // 5. Reserva de Emergência
  if (query.includes('reserva') || query.includes('poupar') || query.includes('juntar')) {
    activeSimulationOption = null;
    return `Para começar a juntar dinheiro mesmo estando lascado financeiramente, a regra de ouro é:<br><br>
    1. **Eliminar juros primeiro**: Nenhuma aplicação financeira rende mais do que os juros que você paga em cartões e empréstimos (ex: sua dívida do cheque especial roda a 8.5% a.m., enquanto investimentos rendem 1% a.m.).<br>
    2. **Reserva de Emergência**: Seu alvo é construir um fundo de **6 vezes seu custo de vida mensal** (cadastrada em Metas). Guarde pelo menos 10% a 20% de cada recebimento do 5º dia útil para esse pote antes de gastar com supérfluos.`;
  }

  // Resposta Padrão
  activeSimulationOption = null;
  return `Olá! Analisei sua pergunta. Eu consigo simular os impactos de **três manobras financeiras principais** para resolver a fatura do cartão:<br>
  1. Digite <strong>"Opção 1"</strong> para simular o **Parcelamento da Fatura** no cartão.<br>
  2. Digite <strong>"Opção 2"</strong> para simular a tomada de um **Empréstimo Pessoal** com juros menores.<br>
  3. Digite <strong>"Opção 3"</strong> para simular a estratégia de **Renda Extra PJ + Corte de Gastos**.<br><br>
  Qual delas você gostaria de analisar agora?`;
}

function updateImpactPanel() {
  const pShort = document.getElementById('impactShortTerm');
  const pMedium = document.getElementById('impactMediumTerm');
  const pLong = document.getElementById('impactLongTerm');
  
  let invoiceVal = 4500;
  if (state.creditCards && state.creditCards.length > 0) {
    let sum = 0;
    state.creditCards.forEach(c => {
      sum += c.transactions.reduce((acc, t) => acc + t.amount, 0);
      sum += c.installments.reduce((acc, inst) => acc + inst.monthlyAmount, 0);
    });
    if (sum > 0) invoiceVal = sum;
  }

  let incomeVal = 4000;
  const lastProLabore = state.transactionsPF.find(t => t.type === 'income' && t.category === 'Pró-Labore');
  if (lastProLabore) incomeVal = Math.abs(lastProLabore.amount);

  if (activeSimulationOption === 1) {
    // Parcelar cartão
    const i = 0.095;
    const n = 12;
    const pmt = invoiceVal * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    const total = pmt * n;
    
    pShort.innerHTML = `🚨 <strong>Alívio imediato ilusório:</strong> Você paga a primeira parcela de **${formatCurrency(pmt)}** e não fica inadimplente, mas seu cartão de crédito fica bloqueado sem limite disponível.`;
    pMedium.innerHTML = `⚠️ <strong>Orçamento sufocado:</strong> Ao fim de 6 meses, você já terá pago **${formatCurrency(pmt * 6)}** e continuará com a parcela fixa consumindo **${((pmt/incomeVal)*100).toFixed(0)}%** do seu ganho mensal de ${formatCurrency(incomeVal)}.`;
    pLong.innerHTML = `❌ <strong>Prejuízo enorme:</strong> No fim do ano, você pagou **${formatCurrency(total)}** por uma dívida original de ${formatCurrency(invoiceVal)}. Você deu **${formatCurrency(total - invoiceVal)}** de juros puros ao banco!`;
  } 
  else if (activeSimulationOption === 2) {
    // Empréstimo
    const i = 0.035;
    const n = 12;
    const pmt = invoiceVal * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    const total = pmt * n;

    pShort.innerHTML = `⚡ <strong>Limpeza de nome:</strong> Cartão pago integralmente à vista, limite do crédito liberado de imediato. A primeira parcela do empréstimo de **${formatCurrency(pmt)}** vence em 30 dias.`;
    pMedium.innerHTML = `⚖️ <strong>Dívida sob controle:</strong> Pagamentos mensais fixos menores de **${formatCurrency(pmt)}**. O custo mensal de sobrevivência é reduzido se comparado ao parcelamento direto do cartão.`;
    pLong.innerHTML = `✅ <strong>Quitação barata:</strong> Dívida encerrada em 1 ano com custo total de **${formatCurrency(total)}**. Economia de **${formatCurrency((invoiceVal * (0.095 * Math.pow(1.095, 12)) / (Math.pow(1.095, 12) - 1) * 12) - total)}** em relação ao parcelamento do cartão!`;
  }
  else if (activeSimulationOption === 3) {
    // Renda Extra + Corte
    pShort.innerHTML = `🔥 <strong>Foco e aperto total:</strong> Sacrifício extremo de lazer e assinaturas. Com o dinheiro extra prospectado na PJ de freelas (+R$ 1.500) e corte PF, você paga a fatura integral à vista.`;
    pMedium.innerHTML = `💪 <strong>Liberdade e Limite livre:</strong> Sem parcelas fixas te assombrando no 5º dia útil. Em 6 meses, você já tem estabilidade e orçamento limpo para criar sua Reserva.`;
    pLong.innerHTML = `🚀 <strong>Riqueza acumulada:</strong> R$ 0,00 de juros pagos a bancos. Com o hábito do corte e ganhos PJ ativos, você acumula mais de **R$ 6.000,00** guardados na sua Reserva ao final de 12 meses!`;
  }
  else {
    pShort.innerText = "Selecione uma opção de manobra no chat para gerar a análise de fluxo de caixa imediata de 1 a 3 meses.";
    pMedium.innerText = "Observe o acúmulo de juros ou consumo de renda que ocorrerá no prazo médio de 6 meses.";
    pLong.innerText = "Compare o custo de quitação acumulado total e o valor economizado ao final de 12 meses.";
  }
}



