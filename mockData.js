// Dados simulados iniciais para o painel financeiro (Modo de Demonstração)
window.INITIAL_DATA = {
  profile: {
    name: "Rafael Omori",
    balancePF: 450.00, // Saldo em conta PF (está apertado!)
    paydayType: "monthly_5th_business", // 'monthly_5th_business' ou 'weekly_friday'
    paydayGoalPercent: 20 // Porcentagem do pagamento que gostaria de poupar
  },
  pj: {
    balance: 5200.00, // Saldo atual na conta PJ
    monthlyInvoices: [
      { id: "inv_1", client: "Cliente Alpha", amount: 12000.00, date: "2026-05-28", status: "received" }
    ],
    taxesConfig: {
      dasRate: 6.0, // 6% de Simples Nacional
      accountingFee: 350.00,
      bankFee: 50.00
    },
    transfers: [
      { id: "tr_1", amount: 8000.00, date: "2026-05-07", status: "completed" }
    ]
  },
  bills: [
    { id: "bill_1", name: "Aluguel", amount: 1800.00, dueDate: "10", category: "Moradia", status: "pending" },
    { id: "bill_2", name: "Energia (Light)", amount: 220.00, dueDate: "15", category: "Moradia", status: "pending" },
    { id: "bill_3", name: "Internet Fibra", amount: 120.00, dueDate: "08", category: "Tecnologia", status: "paid" },
    { id: "bill_4", name: "Condomínio", amount: 450.00, dueDate: "10", category: "Moradia", status: "pending" },
    { id: "bill_5", name: "Academia", amount: 110.00, dueDate: "20", category: "Saúde", status: "pending" },
    { id: "bill_6", name: "Plano de Saúde", amount: 480.00, dueDate: "05", category: "Saúde", status: "paid" }
  ],
  creditCards: [
    {
      id: "card_nubank",
      name: "Nubank",
      color: "#a020f0", // Roxo neon
      limit: 4000.00,
      closeDay: 28,
      dueDay: 5,
      transactions: [
        { id: "c1_t1", description: "Supermercado Pão de Açúcar", amount: 350.00, date: "2026-05-12", category: "Alimentação" },
        { id: "c1_t2", description: "Posto Shell", amount: 180.00, date: "2026-05-18", category: "Transporte" },
        { id: "c1_t3", description: "Restaurante Sushi", amount: 150.00, date: "2026-05-24", category: "Lazer" },
        { id: "c1_t4", description: "Netflix & Spotify", amount: 65.00, date: "2026-05-25", category: "Assinaturas" }
      ],
      installments: [
        { id: "c1_inst1", description: "Smartphone Xiaomi", totalAmount: 1800.00, monthlyAmount: 300.00, currentInstallment: 3, totalInstallments: 6, date: "2026-03-10" }
      ]
    },
    {
      id: "card_inter",
      name: "Banco Inter",
      color: "#ff8c00", // Laranja neon
      limit: 2500.00,
      closeDay: 2,
      dueDay: 10,
      transactions: [
        { id: "c2_t1", description: "Uber viagem", amount: 45.00, date: "2026-05-15", category: "Transporte" },
        { id: "c2_t2", description: "iFood Jantar", amount: 120.00, date: "2026-05-20", category: "Alimentação" }
      ],
      installments: []
    }
  ],
  debts: [
    {
      id: "debt_1",
      name: "Empréstimo Caixa Econômica",
      balance: 18500.00,
      monthlyPayment: 850.00,
      interestRate: 3.8, // % ao mês
      remainingInstallments: 15,
      totalInstallments: 24,
      priority: "medium"
    },
    {
      id: "debt_2",
      name: "Cheque Especial Itaú (Atrasado)",
      balance: 3200.00,
      monthlyPayment: 200.00, // Pagamento mínimo ou intenção
      interestRate: 8.5, // % ao mês (Juros altíssimos!)
      remainingInstallments: 0, // Dívida aberta
      totalInstallments: 0,
      priority: "high"
    }
  ],
  goals: [
    { id: "goal_1", name: "Reserva de Emergência", target: 15000.00, current: 500.00, category: "Segurança" },
    { id: "goal_2", name: "Quitar Cheque Especial", target: 3200.00, current: 0.00, category: "Quitação" }
  ],
  transactionsPF: [
    { id: "pf_t1", description: "Transferência Recebida PJ", amount: 8000.00, date: "2026-05-07", type: "income", category: "Pró-Labore" },
    { id: "pf_t2", description: "Plano de Saúde", amount: -480.00, date: "2026-05-05", type: "expense", category: "Saúde" },
    { id: "pf_t3", description: "Internet Fibra", amount: -120.00, date: "2026-05-08", type: "expense", category: "Tecnologia" }
  ]
};

// Modelo 100% Zerado para Configuração Inicial (Onboarding)
window.EMPTY_TEMPLATE = {
  profile: {
    name: "",
    balancePF: 0.00,
    paydayType: "monthly_5th_business",
    paydayGoalPercent: 0
  },
  pj: {
    balance: 0.00,
    monthlyInvoices: [],
    taxesConfig: {
      dasRate: 6.0,
      accountingFee: 0.00,
      bankFee: 0.00
    },
    transfers: []
  },
  bills: [],
  creditCards: [],
  debts: [],
  goals: [],
  transactionsPF: []
};
