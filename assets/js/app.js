// State Management
let state = {
  accounts: [],
  transactions: [],
  budgets: [],
  goals: []
};

// Edit Tracking
let editingTransactionId = null;
let editingAccountId = null;
let editingBudgetId = null;
let editingGoalId = null;

// Chart Instances
let cashflowChart = null;
let categoryChart = null;

// Default Demo Data structure (empty starter)
const demoData = {
  accounts: [
    { id: 'acc-1', name: 'SBI Savings', type: 'Savings', balance: 0 },
    { id: 'acc-2', name: 'HDFC Bank', type: 'Salary', balance: 0 },
    { id: 'acc-3', name: 'Cash Wallet', type: 'Cash', balance: 0 }
  ],
  transactions: [],
  budgets: [],
  goals: []
};

let enteredPin = '';

// Helper to get current date string in Indian Standard Time (IST)
function getISTDateString() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const istDate = new Date(utc + (3600000 * 5.5)); // UTC + 5.5 hours
  return istDate.toISOString().split('T')[0];
}

const todayIST = getISTDateString();
let currentSelectedMonth = parseInt(todayIST.split('-')[1]) - 1; // 0-indexed
let currentSelectedYear = parseInt(todayIST.split('-')[0]);

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  // Check Authentication Status
  if (sessionStorage.getItem('finance_pro_authenticated') === 'true') {
    document.getElementById('login-overlay').style.display = 'none';
  }
  await loadState();
  initEventHandlers();
  renderApp();
});

// Load state from API server or fallback to localStorage
async function loadState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error('Backend HTTP error code ' + res.status);
    state = await res.json();
    console.log('Loaded financial state from server successfully.');
  } catch (err) {
    console.warn('Could not connect to backend server. Falling back to local storage:', err.message);
    const localData = localStorage.getItem('finance_pro_state');
    if (localData) {
      try {
        state = JSON.parse(localData);
      } catch (e) {
        state = { ...demoData };
      }
    } else {
      state = { ...demoData };
      saveState();
    }
  }
}

// Save state to API server and localStorage as redundancy
async function saveState() {
  // Sync to localStorage first
  localStorage.setItem('finance_pro_state', JSON.stringify(state));

  try {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(state)
    });
    if (!res.ok) {
      throw new Error('Server returned error code ' + res.status);
    }
  } catch (err) {
    console.error('Failed to persist state changes on backend server:', err.message);
  }
}

// Reset state to Demo Data


// Format Currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// Initialize event handlers
function initEventHandlers() {
  // Set initial month & year selects dropdowns
  document.getElementById('dash-month').value = currentSelectedMonth;
  document.getElementById('dash-year').value = currentSelectedYear;

  // Listen for month/year selects changes
  document.getElementById('dash-month').addEventListener('change', (e) => {
    currentSelectedMonth = parseInt(e.target.value);
    renderApp();
  });
  document.getElementById('dash-year').addEventListener('change', (e) => {
    currentSelectedYear = parseInt(e.target.value);
    renderApp();
  });

  // Bind Export PDF button
  document.getElementById('print-summary-btn').addEventListener('click', generatePDF);

  // Modal toggles
  document.getElementById('add-transaction-btn').addEventListener('click', () => openTransactionModal());
  document.getElementById('add-account-btn').addEventListener('click', () => openAccountModal());
  document.getElementById('add-budget-btn').addEventListener('click', () => openBudgetModal());
  document.getElementById('add-goal-btn').addEventListener('click', () => openGoalModal());

  // Close modals
  document.querySelectorAll('.modal-close, .btn-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      closeModal(modal.id);
    });
  });

  // Modal forms submissions
  document.getElementById('transaction-form').addEventListener('submit', handleTransactionSubmit);
  document.getElementById('account-form').addEventListener('submit', handleAccountSubmit);
  document.getElementById('budget-form').addEventListener('submit', handleBudgetSubmit);
  document.getElementById('goal-form').addEventListener('submit', handleGoalSubmit);

  // Table transaction filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderTransactions();
    });
  });

  // Search input filter
  document.getElementById('search-transactions').addEventListener('input', () => {
    renderTransactions();
  });
}

// Render the application components
function renderApp() {
  populateAccountSelects();
  renderMetrics();
  renderAccounts();
  renderTransactions();
  renderBudgets();
  renderGoals();
  renderCharts();
}

// Populate Account dropdown selection lists
function populateAccountSelects() {
  const select = document.getElementById('tx-account');
  select.innerHTML = '<option value="" disabled selected>Select Account</option>';
  state.accounts.forEach(acc => {
    const option = document.createElement('option');
    option.value = acc.id;
    option.textContent = `${acc.name} (${formatCurrency(acc.balance)})`;
    select.appendChild(option);
  });
}

// Render Balance, Income, Expense, and Savings cards
function renderMetrics() {
  // Net balance
  const totalBalance = state.accounts.reduce((sum, acc) => sum + acc.balance, 0);
  document.getElementById('metric-balance').textContent = formatCurrency(totalBalance);

  // Income & Expenses (sums from the transactions table)
  let totalIncome = 0;
  let totalExpense = 0;
  
  state.transactions.forEach(tx => {
    const txYear = parseInt(tx.date.split('-')[0]);
    const txMonth = parseInt(tx.date.split('-')[1]) - 1;
    if (txYear === currentSelectedYear && txMonth === currentSelectedMonth) {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
      }
    }
  });

  // Savings (Sum of balances of all accounts of type 'Savings')
  const totalSavings = state.accounts
    .filter(acc => acc.type.toLowerCase() === 'savings')
    .reduce((sum, acc) => sum + acc.balance, 0);

  document.getElementById('metric-income').textContent = formatCurrency(totalIncome);
  document.getElementById('metric-expense').textContent = formatCurrency(totalExpense);
  document.getElementById('metric-savings').textContent = formatCurrency(totalSavings);
}

// Render Accounts UI grid
function renderAccounts() {
  const container = document.getElementById('accounts-container');
  container.innerHTML = '';

  if (state.accounts.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1/-1;">No accounts found. Create one to begin.</div>';
    return;
  }

  state.accounts.forEach(acc => {
    const card = document.createElement('div');
    card.className = 'account-mini-card';
    card.innerHTML = `
      <div class="account-info">
        <div class="account-name-container">
          <span class="account-name">${acc.name}</span>
          <span class="account-type">${acc.type}</span>
        </div>
        <span class="account-balance">${formatCurrency(acc.balance)}</span>
      </div>
      <div class="account-actions">
        <button class="icon-btn edit" onclick="openAccountModal('${acc.id}')" title="Edit Account">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="icon-btn delete" onclick="deleteAccount('${acc.id}')" title="Delete Account">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

// Render Transactions UI table list
function renderTransactions() {
  const tbody = document.getElementById('transactions-tbody');
  tbody.innerHTML = '';

  // Get active type filter
  const activeFilterBtn = document.querySelector('.filter-btn.active');
  const typeFilter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'all';
  
  // Get search query
  const searchQuery = document.getElementById('search-transactions').value.toLowerCase();

  // Filter items
  const filtered = state.transactions.filter(tx => {
    const txYear = parseInt(tx.date.split('-')[0]);
    const txMonth = parseInt(tx.date.split('-')[1]) - 1;
    const matchesTime = txYear === currentSelectedYear && txMonth === currentSelectedMonth;
    
    const matchesType = typeFilter === 'all' || tx.type === typeFilter;
    const account = state.accounts.find(a => a.id === tx.accountId);
    const accountName = account ? account.name.toLowerCase() : '';
    const category = tx.category.toLowerCase();
    const notes = tx.notes ? tx.notes.toLowerCase() : '';
    const matchesSearch = category.includes(searchQuery) || notes.includes(searchQuery) || accountName.includes(searchQuery);
    return matchesTime && matchesType && matchesSearch;
  });

  // Sort by date descending
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">No transactions match your filters.</td></tr>';
    return;
  }

  filtered.forEach(tx => {
    const account = state.accounts.find(a => a.id === tx.accountId);
    const accountName = account ? account.name : 'Unknown';
    const dateFormatted = new Date(tx.date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="badge badge-${tx.type}">
          ${tx.type === 'income' ? '▲ Income' : '▼ Expense'}
        </span>
      </td>
      <td style="font-weight: 700; color: ${tx.type === 'income' ? 'var(--success-light)' : 'var(--danger-light)'}">
        ${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}
      </td>
      <td>
        <div style="font-weight: 600;">${tx.category}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${tx.notes || ''}</div>
      </td>
      <td>
        <div>${accountName}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${dateFormatted}</div>
      </td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="icon-btn edit" onclick="openTransactionModal('${tx.id}')" title="Edit Transaction">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="icon-btn delete" onclick="deleteTransaction('${tx.id}')" title="Delete Transaction">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Budgets progress tracks (restricting calculations to the current calendar month)
function renderBudgets() {
  const container = document.getElementById('budgets-container');
  container.innerHTML = '';

  if (state.budgets.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No budgets configured. Click "Add Budget" to start.</div>';
    return;
  }

  state.budgets.forEach(b => {
    // Calculate total spent for this category dynamically RESTRICTED to selected month/year
    const spent = state.transactions
      .filter(tx => {
        if (tx.type !== 'expense') return false;
        if (tx.category.toLowerCase() !== b.category.toLowerCase()) return false;
        const txYear = parseInt(tx.date.split('-')[0]);
        const txMonth = parseInt(tx.date.split('-')[1]) - 1;
        return txYear === currentSelectedYear && txMonth === currentSelectedMonth;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    const percentage = Math.min((spent / b.limit) * 100, 100);
    let colorClass = 'success';
    if (percentage > 90) colorClass = 'danger';
    else if (percentage > 70) colorClass = 'warning';

    const item = document.createElement('div');
    item.className = 'budget-item';
    item.innerHTML = `
      <div class="item-info-row">
        <div>
          <span class="item-title">${b.category} Budget</span>
          <div class="item-subtitle">${formatCurrency(spent)} of ${formatCurrency(b.limit)} spent this month</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="item-value item-value-main">${Math.round(percentage)}%</span>
          <button class="icon-btn edit btn-sm" onclick="openBudgetModal('${b.id}')" title="Edit Budget">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="icon-btn delete btn-sm" onclick="deleteBudget('${b.id}')" title="Delete Budget">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
      <div class="progress-track">
        <div class="progress-bar ${colorClass}" style="width: ${percentage}%"></div>
      </div>
    `;
    container.appendChild(item);
  });
}

// Render Goals progress tracks
function renderGoals() {
  const container = document.getElementById('goals-container');
  container.innerHTML = '';

  if (state.goals.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No savings goals set. Click "Add Goal" to set one.</div>';
    return;
  }

  state.goals.forEach(g => {
    const percentage = Math.min((g.current / g.target) * 100, 100);
    let colorClass = 'primary';
    if (percentage >= 100) colorClass = 'success';

    const item = document.createElement('div');
    item.className = 'goal-item';
    item.innerHTML = `
      <div class="item-info-row">
        <div>
          <span class="item-title">${g.name}</span>
          <div class="item-subtitle">${formatCurrency(g.current)} saved of ${formatCurrency(g.target)}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="item-value item-value-main">${Math.round(percentage)}%</span>
          <button class="icon-btn edit btn-sm" onclick="openGoalModal('${g.id}')" title="Edit Goal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="icon-btn delete btn-sm" onclick="deleteGoal('${g.id}')" title="Delete Goal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
      <div class="progress-track">
        <div class="progress-bar ${colorClass}" style="width: ${percentage}%"></div>
      </div>
    `;
    container.appendChild(item);
  });
}

// Render dynamic visual charts via Chart.js
function renderCharts() {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded yet. Retrying shortly...');
    setTimeout(renderCharts, 1000);
    return;
  }

  if (cashflowChart) cashflowChart.destroy();
  if (categoryChart) categoryChart.destroy();

  // Chart 1: Cashflow (Income vs Expense Compare)
  const cashflowCtx = document.getElementById('cashflowChart').getContext('2d');
  
  let incomeSum = 0;
  let expenseSum = 0;

  state.transactions.forEach(t => {
    const txYear = parseInt(t.date.split('-')[0]);
    const txMonth = parseInt(t.date.split('-')[1]) - 1;
    if (txYear === currentSelectedYear && txMonth === currentSelectedMonth) {
      if (t.type === 'income') incomeSum += t.amount;
      else expenseSum += t.amount;
    }
  });

  cashflowChart = new Chart(cashflowCtx, {
    type: 'bar',
    data: {
      labels: ['Income', 'Expense'],
      datasets: [{
        label: 'Cash Flow Comparison',
        data: [incomeSum, expenseSum],
        backgroundColor: [
          'rgba(6, 182, 212, 0.45)', // Cyan glow
          'rgba(244, 63, 94, 0.45)'  // Rose glow
        ],
        borderColor: [
          '#06b6d4',
          '#f43f5e'
        ],
        borderWidth: 2,
        borderRadius: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f0e24',
          titleColor: '#fff',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });

  // Chart 2: Category Breakdown (Doughnut Chart of expenses)
  const categoryCtx = document.getElementById('categoryChart').getContext('2d');
  
  const categoryExpenses = {};
  state.transactions.forEach(tx => {
    const txYear = parseInt(tx.date.split('-')[0]);
    const txMonth = parseInt(tx.date.split('-')[1]) - 1;
    if (txYear === currentSelectedYear && txMonth === currentSelectedMonth) {
      if (tx.type === 'expense') {
        const cat = tx.category;
        categoryExpenses[cat] = (categoryExpenses[cat] || 0) + tx.amount;
      }
    }
  });

  const categories = Object.keys(categoryExpenses);
  const amounts = Object.values(categoryExpenses);

  const colors = [
    '#6366f1', // Indigo
    '#f43f5e', // Rose
    '#06b6d4', // Cyan
    '#f59e0b', // Amber
    '#a855f7', // Purple
    '#10b981', // Emerald
    '#ec4899', // Pink
    '#64748b'  // Slate
  ];

  categoryChart = new Chart(categoryCtx, {
    type: 'doughnut',
    data: {
      labels: categories.length ? categories : ['No Expenses'],
      datasets: [{
        data: amounts.length ? amounts : [1],
        backgroundColor: amounts.length ? colors.slice(0, categories.length).map(c => c + '55') : ['rgba(255,255,255,0.05)'],
        borderColor: amounts.length ? colors.slice(0, categories.length) : ['rgba(255,255,255,0.1)'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#94a3b8',
            font: { family: 'Outfit', size: 11 },
            boxWidth: 10
          }
        },
        tooltip: {
          backgroundColor: '#0f0e24',
          titleColor: '#fff',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              if (!amounts.length) return ' No expense data';
              return ` ${context.label}: ${formatCurrency(context.parsed)}`;
            }
          }
        }
      }
    }
  });
}

// Modal open/close actions
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  
  // Reset forms and edit IDs
  if (modalId === 'modal-transaction') {
    document.getElementById('transaction-form').reset();
    editingTransactionId = null;
    document.getElementById('modal-tx-title').textContent = 'Add Transaction';
  } else if (modalId === 'modal-account') {
    document.getElementById('account-form').reset();
    editingAccountId = null;
    document.getElementById('modal-acc-title').textContent = 'Add Account';
  } else if (modalId === 'modal-budget') {
    document.getElementById('budget-form').reset();
    editingBudgetId = null;
    document.getElementById('modal-budget-title').textContent = 'Configure Budget';
  } else if (modalId === 'modal-goal') {
    document.getElementById('goal-form').reset();
    editingGoalId = null;
    document.getElementById('modal-goal-title').textContent = 'Create Savings Goal';
  }
}

// Transaction Modal Control
window.openTransactionModal = function(id = null) {
  openModal('modal-transaction');
  if (id) {
    editingTransactionId = id;
    document.getElementById('modal-tx-title').textContent = 'Edit Transaction';
    
    const tx = state.transactions.find(t => t.id === id);
    if (tx) {
      document.getElementById('tx-type').value = tx.type;
      document.getElementById('tx-amount').value = tx.amount;
      document.getElementById('tx-category').value = tx.category;
      document.getElementById('tx-date').value = tx.date;
      document.getElementById('tx-account').value = tx.accountId;
      document.getElementById('tx-notes').value = tx.notes || '';
    }
  } else {
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
  }
};

// Account Modal Control
window.openAccountModal = function(id = null) {
  openModal('modal-account');
  if (id) {
    editingAccountId = id;
    document.getElementById('modal-acc-title').textContent = 'Edit Account';
    
    const acc = state.accounts.find(a => a.id === id);
    if (acc) {
      document.getElementById('acc-name').value = acc.name;
      document.getElementById('acc-type').value = acc.type;
      document.getElementById('acc-balance').value = acc.balance;
    }
  }
};

// Budget Modal Control
window.openBudgetModal = function(id = null) {
  openModal('modal-budget');
  if (id) {
    editingBudgetId = id;
    document.getElementById('modal-budget-title').textContent = 'Edit Budget';
    
    const b = state.budgets.find(item => item.id === id);
    if (b) {
      document.getElementById('b-category').value = b.category;
      document.getElementById('b-limit').value = b.limit;
    }
  }
};

// Goal Modal Control
window.openGoalModal = function(id = null) {
  openModal('modal-goal');
  if (id) {
    editingGoalId = id;
    document.getElementById('modal-goal-title').textContent = 'Edit Savings Goal';
    
    const g = state.goals.find(item => item.id === id);
    if (g) {
      document.getElementById('g-name').value = g.name;
      document.getElementById('g-target').value = g.target;
      document.getElementById('g-current').value = g.current;
    }
  }
};

// Form submissions handlers
async function handleTransactionSubmit(e) {
  e.preventDefault();
  
  const type = document.getElementById('tx-type').value;
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const category = document.getElementById('tx-category').value;
  const date = document.getElementById('tx-date').value;
  const accountId = document.getElementById('tx-account').value;
  const notes = document.getElementById('tx-notes').value;

  if (!type || isNaN(amount) || !category || !date || !accountId) {
    alert('Please fill in all required fields.');
    return;
  }

  const selectedAccount = state.accounts.find(a => a.id === accountId);
  if (!selectedAccount) {
    alert('Invalid Account selected.');
    return;
  }

  if (editingTransactionId) {
    // Revert old transaction impact on account balance
    const oldTx = state.transactions.find(t => t.id === editingTransactionId);
    if (oldTx) {
      const oldAccount = state.accounts.find(a => a.id === oldTx.accountId);
      if (oldAccount) {
        if (oldTx.type === 'income') {
          oldAccount.balance -= oldTx.amount;
        } else {
          oldAccount.balance += oldTx.amount;
        }
      }
    }

    // Apply updated transaction impact to selected account balance
    if (type === 'income') {
      selectedAccount.balance += amount;
    } else {
      selectedAccount.balance -= amount;
    }

    // Update state
    state.transactions = state.transactions.map(tx => {
      if (tx.id === editingTransactionId) {
        return { id: tx.id, type, amount, category, date, accountId, notes };
      }
      return tx;
    });

  } else {
    // Add new transaction
    const newTx = {
      id: 'tx-' + Date.now(),
      type,
      amount,
      category,
      date,
      accountId,
      notes
    };

    // Apply impact to selected account balance
    if (type === 'income') {
      selectedAccount.balance += amount;
    } else {
      selectedAccount.balance -= amount;
    }

    state.transactions.push(newTx);
  }

  await saveState();
  closeModal('modal-transaction');
  renderApp();
}

async function handleAccountSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('acc-name').value;
  const type = document.getElementById('acc-type').value;
  const balance = parseFloat(document.getElementById('acc-balance').value);

  if (!name || !type || isNaN(balance)) {
    alert('Please fill in all required fields.');
    return;
  }

  if (editingAccountId) {
    state.accounts = state.accounts.map(acc => {
      if (acc.id === editingAccountId) {
        return { id: acc.id, name, type, balance };
      }
      return acc;
    });
  } else {
    const newAcc = {
      id: 'acc-' + Date.now(),
      name,
      type,
      balance
    };
    state.accounts.push(newAcc);
  }

  await saveState();
  closeModal('modal-account');
  renderApp();
}

async function handleBudgetSubmit(e) {
  e.preventDefault();
  
  const category = document.getElementById('b-category').value;
  const limit = parseFloat(document.getElementById('b-limit').value);

  if (!category || isNaN(limit)) {
    alert('Please fill in all required fields.');
    return;
  }

  if (editingBudgetId) {
    state.budgets = state.budgets.map(b => {
      if (b.id === editingBudgetId) {
        return { id: b.id, category, limit };
      }
      return b;
    });
  } else {
    const newBudget = {
      id: 'b-' + Date.now(),
      category,
      limit
    };
    state.budgets.push(newBudget);
  }

  await saveState();
  closeModal('modal-budget');
  renderApp();
}

async function handleGoalSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('g-name').value;
  const target = parseFloat(document.getElementById('g-target').value);
  const current = parseFloat(document.getElementById('g-current').value);

  if (!name || isNaN(target) || isNaN(current)) {
    alert('Please fill in all required fields.');
    return;
  }

  if (editingGoalId) {
    state.goals = state.goals.map(g => {
      if (g.id === editingGoalId) {
        return { id: g.id, name, target, current };
      }
      return g;
    });
  } else {
    const newGoal = {
      id: 'g-' + Date.now(),
      name,
      target,
      current
    };
    state.goals.push(newGoal);
  }

  await saveState();
  closeModal('modal-goal');
  renderApp();
}

// Delete functions
window.deleteTransaction = async function(id) {
  if (!confirm('Are you sure you want to delete this transaction?')) return;
  
  const tx = state.transactions.find(t => t.id === id);
  if (tx) {
    const account = state.accounts.find(a => a.id === tx.accountId);
    if (account) {
      if (tx.type === 'income') {
        account.balance -= tx.amount;
      } else {
        account.balance += tx.amount;
      }
    }
  }

  state.transactions = state.transactions.filter(t => t.id !== id);
  await saveState();
  renderApp();
};

window.deleteAccount = async function(id) {
  if (!confirm('Are you sure you want to delete this account? This will also delete all transactions associated with this account.')) return;
  
  state.accounts = state.accounts.filter(a => a.id !== id);
  state.transactions = state.transactions.filter(t => t.accountId !== id);
  
  await saveState();
  renderApp();
};

window.deleteBudget = async function(id) {
  if (!confirm('Are you sure you want to delete this budget?')) return;
  state.budgets = state.budgets.filter(b => b.id !== id);
  await saveState();
  renderApp();
};

window.deleteGoal = async function(id) {
  if (!confirm('Are you sure you want to delete this goal?')) return;
  state.goals = state.goals.filter(g => g.id !== id);
  await saveState();
  renderApp();
};

// PIN Keypad Keypress handling
window.pressKey = function(key) {
  const errorMsg = document.getElementById('login-error');
  errorMsg.classList.remove('show');
  
  if (key === 'clear') {
    enteredPin = '';
  } else if (key === 'delete') {
    enteredPin = enteredPin.slice(0, -1);
  } else {
    if (enteredPin.length < 6) {
      enteredPin += key;
    }
  }
  
  // Update UI dots
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, idx) => {
    if (idx < enteredPin.length) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
  
  // Validate PIN
  if (enteredPin.length === 6) {
    if (enteredPin === '241106') {
      sessionStorage.setItem('finance_pro_authenticated', 'true');
      const overlay = document.getElementById('login-overlay');
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 400);
    } else {
      const card = document.getElementById('login-card');
      card.classList.add('shake');
      errorMsg.textContent = 'Incorrect PIN. Please try again.';
      errorMsg.classList.add('show');
      
      setTimeout(() => {
        card.classList.remove('shake');
        enteredPin = '';
        dots.forEach(dot => dot.classList.remove('active'));
      }, 500);
    }
  }
};

// Keyboard entry support for PIN login
window.addEventListener('keydown', (e) => {
  const overlay = document.getElementById('login-overlay');
  if (overlay && overlay.style.display !== 'none' && !overlay.classList.contains('fade-out') && sessionStorage.getItem('finance_pro_authenticated') !== 'true') {
    if (e.key >= '0' && e.key <= '9') {
      pressKey(e.key);
    } else if (e.key === 'Backspace') {
      pressKey('delete');
    } else if (e.key.toLowerCase() === 'c' || e.key === 'Escape') {
      pressKey('clear');
    }
  }
});

// PDF Exporter Engine for Monthly Analytics Report
async function generatePDF() {
  // Check if html2pdf is loaded
  if (typeof html2pdf === 'undefined') {
    alert('PDF Exporter is loading. Please try again in a few seconds.');
    return;
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const selectedMonthName = monthNames[currentSelectedMonth];
  const reportFilename = `FinancePro_Statement_${selectedMonthName}_${currentSelectedYear}.pdf`;

  // Create an off-screen print-formatted container
  const reportDiv = document.createElement('div');
  reportDiv.style.cssText = `
    padding: 35px;
    color: #f8fafc;
    background: #0b0a1a;
    background-image: radial-gradient(circle at 50% 50%, #15132d 0%, #07060e 100%);
    font-family: 'Outfit', 'Inter', sans-serif;
    width: 800px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 20px;
  `;

  // Filter transactions for selected Month/Year
  let monthlyTxs = [];
  let totalIncome = 0;
  let totalExpense = 0;

  state.transactions.forEach(t => {
    const txYear = parseInt(t.date.split('-')[0]);
    const txMonth = parseInt(t.date.split('-')[1]) - 1;
    if (txYear === currentSelectedYear && txMonth === currentSelectedMonth) {
      monthlyTxs.push(t);
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
      }
    }
  });

  // Calculate Net Savings and Total Balance
  const totalBalance = state.accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const netSavings = state.accounts
    .filter(acc => acc.type.toLowerCase() === 'savings')
    .reduce((sum, acc) => sum + acc.balance, 0);

  // Group expenses by category
  const categoryExpenses = {};
  monthlyTxs.forEach(t => {
    if (t.type === 'expense') {
      categoryExpenses[t.category] = (categoryExpenses[t.category] || 0) + t.amount;
    }
  });

  // Build Accounts rows
  let accountsHtml = '';
  state.accounts.forEach(acc => {
    accountsHtml += `
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
        <td style="padding: 10px 12px; font-weight: 500;">${acc.name}</td>
        <td style="padding: 10px 12px; color: #94a3b8;">${acc.type}</td>
        <td style="padding: 10px 12px; text-align: right; font-weight: 700;">${formatCurrency(acc.balance)}</td>
      </tr>
    `;
  });

  // Build Category Expense rows
  let categoriesHtml = '';
  Object.keys(categoryExpenses).forEach(cat => {
    categoriesHtml += `
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
        <td style="padding: 10px 12px; font-weight: 500;">${cat}</td>
        <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #fb7185;">${formatCurrency(categoryExpenses[cat])}</td>
      </tr>
    `;
  });
  if (categoriesHtml === '') {
    categoriesHtml = '<tr><td colspan="2" style="padding: 15px; text-align: center; color: #94a3b8;">No expenses logged this month.</td></tr>';
  }

  // Build Transactions ledger rows
  let txsHtml = '';
  monthlyTxs.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
    const account = state.accounts.find(a => a.id === t.accountId);
    txsHtml += `
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
        <td style="padding: 8px 10px; color: ${t.type === 'income' ? '#22d3ee' : '#fb7185'}; font-weight: 700; font-size: 0.75rem;">
          ${t.type === 'income' ? '▲ Income' : '▼ Expense'}
        </td>
        <td style="padding: 8px 10px; font-weight: 700;">${formatCurrency(t.amount)}</td>
        <td style="padding: 8px 10px;">
          <div style="font-weight: 600; font-size: 0.85rem;">${t.category}</div>
          <div style="font-size: 0.7rem; color: #94a3b8;">${t.notes || ''}</div>
        </td>
        <td style="padding: 8px 10px; color: #94a3b8; font-size: 0.8rem;">${account ? account.name : 'Unknown'}</td>
        <td style="padding: 8px 10px; color: #94a3b8; text-align: right; font-size: 0.8rem;">${t.date}</td>
      </tr>
    `;
  });
  if (txsHtml === '') {
    txsHtml = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #94a3b8;">No transactions recorded this month.</td></tr>';
  }

  // Set report layout
  reportDiv.innerHTML = `
    <div style="border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; padding: 25px; background: rgba(255, 255, 255, 0.01);">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(255, 255, 255, 0.08); padding-bottom: 15px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; font-size: 1.6rem; font-weight: 800; background: linear-gradient(to right, #ffffff, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">FinancePro Statement</h1>
          <p style="margin: 3px 0 0 0; color: #94a3b8; font-size: 0.8rem;">Monthly Analysis & Cashflow Ledger</p>
        </div>
        <div style="text-align: right;">
          <h3 style="margin: 0; color: #22d3ee; font-weight: 700; font-size: 1.15rem;">${selectedMonthName} ${currentSelectedYear}</h3>
          <p style="margin: 3px 0 0 0; color: #94a3b8; font-size: 0.75rem;">Generated: ${new Date().toLocaleDateString('en-IN')}</p>
        </div>
      </div>
      
      <!-- Key metrics row -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px;">
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; border-left: 4px solid #6366f1;">
          <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.3px;">Total Balance</div>
          <div style="font-size: 1.1rem; font-weight: 800; margin-top: 4px;">${formatCurrency(totalBalance)}</div>
        </div>
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; border-left: 4px solid #f59e0b;">
          <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.3px;">Net Savings</div>
          <div style="font-size: 1.1rem; font-weight: 800; margin-top: 4px;">${formatCurrency(netSavings)}</div>
        </div>
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; border-left: 4px solid #06b6d4;">
          <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.3px;">Month Income</div>
          <div style="font-size: 1.1rem; font-weight: 800; margin-top: 4px; color: #22d3ee;">${formatCurrency(totalIncome)}</div>
        </div>
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; border-left: 4px solid #f43f5e;">
          <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.3px;">Month Expense</div>
          <div style="font-size: 1.1rem; font-weight: 800; margin-top: 4px; color: #fb7185;">${formatCurrency(totalExpense)}</div>
        </div>
      </div>
      
      <!-- Content columns -->
      <div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 20px; margin-bottom: 25px;">
        <!-- Bank Accounts Status -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 16px;">
          <h4 style="margin: 0 0 12px 0; color: #fff; font-size: 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">Accounts Status</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
            <thead>
              <tr style="text-align: left; color: #94a3b8;">
                <th style="padding: 6px 12px;">Account</th>
                <th style="padding: 6px 12px;">Type</th>
                <th style="padding: 6px 12px; text-align: right;">Current Balance</th>
              </tr>
            </thead>
            <tbody>
              ${accountsHtml}
            </tbody>
          </table>
        </div>
        
        <!-- Category Breakdown -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 16px;">
          <h4 style="margin: 0 0 12px 0; color: #fff; font-size: 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">Expenses by Category</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
            <thead>
              <tr style="text-align: left; color: #94a3b8;">
                <th style="padding: 6px 12px;">Category</th>
                <th style="padding: 6px 12px; text-align: right;">Spent Amount</th>
              </tr>
            </thead>
            <tbody>
              ${categoriesHtml}
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Detailed ledger list -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 16px;">
        <h4 style="margin: 0 0 12px 0; color: #fff; font-size: 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">Transactions Log</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
          <thead>
            <tr style="text-align: left; color: #94a3b8;">
              <th style="padding: 6px 8px;">Type</th>
              <th style="padding: 6px 8px;">Amount</th>
              <th style="padding: 6px 8px;">Category / Description</th>
              <th style="padding: 6px 8px;">Account</th>
              <th style="padding: 6px 8px; text-align: right;">Date</th>
            </tr>
          </thead>
          <tbody>
            ${txsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // html2pdf print configurations
  const printOptions = {
    margin:       [0.3, 0.3],
    filename:     reportFilename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2.2, useCORS: true, backgroundColor: '#0b0a1a' },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  try {
    // Exporter triggers
    await html2pdf().from(reportDiv).set(printOptions).save();
    console.log(`Report generated successfully: ${reportFilename}`);
  } catch (err) {
    console.error('Error generating PDF report:', err);
    alert('Failed to generate PDF. Please try again.');
  }
}