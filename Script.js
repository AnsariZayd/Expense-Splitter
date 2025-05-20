const users = ["Zayd", "Ishraque", "Simra"];
let currentUser = null;

const userSelectDiv = document.getElementById("userSelect");
const appDiv = document.getElementById("app");
const currentUserSpan = document.getElementById("currentUser");
const balancesList = document.getElementById("balancesList");
const expenseList = document.getElementById("expenseList");
const monthlySummaryList = document.getElementById("monthlySummaryList");

const descInput = document.getElementById("desc");
const amountInput = document.getElementById("amount");
const addExpenseBtn = document.getElementById("addExpenseBtn");

const expensesRef = db.ref("expenses");

// Start app after user selects their name
document.getElementById("btnStart").onclick = () => {
  const selUser = document.getElementById("user").value;
  if (!users.includes(selUser)) {
    alert("Please select a valid user");
    return;
  }
  currentUser = selUser;
  userSelectDiv.classList.add("hidden");
  appDiv.classList.remove("hidden");
  currentUserSpan.textContent = currentUser;
  loadExpensesAndBalances();
};

// Add expense (only for current user)
addExpenseBtn.onclick = () => {
  const desc = descInput.value.trim();
  const amount = parseFloat(amountInput.value);
  if (!desc || isNaN(amount) || amount <= 0) {
    alert("Please enter valid description and positive amount");
    return;
  }
  const newExpense = {
    desc,
    amount,
    paidBy: currentUser,
    date: new Date().toISOString(),
    settled: false
  };
  expensesRef.push(newExpense);
  descInput.value = "";
  amountInput.value = "";
};

// Load all expenses and calculate balances + monthly summary
function loadExpensesAndBalances() {
  expensesRef.on("value", snapshot => {
    const data = snapshot.val() || {};
    const expenses = Object.entries(data).map(([id, exp]) => ({
      id,
      ...exp
    }));

    // Calculate balances
    const balances = { Zayd: 0, Ishraque: 0, Simra: 0 };

    // Total amount paid by each person
    expenses.forEach(exp => {
      if (!exp.settled) {
        balances[exp.paidBy] += exp.amount;
      }
    });

    // Total expenses (only unsettled)
    const totalUnsettled = expenses.filter(e => !e.settled)
      .reduce((sum, e) => sum + e.amount, 0);

    // Split equally
    const perPersonShare = totalUnsettled / users.length;

    // Net balance = amount paid - share
    users.forEach(u => {
      balances[u] = balances[u] - perPersonShare;
    });

    // Display balances
    balancesList.innerHTML = "";
    users.forEach(u => {
      const bal = balances[u];
      const li = document.createElement("li");
      li.textContent = `${u}: `;

      const span = document.createElement("span");
      if (bal > 0) {
        span.textContent = `You are owed ₹${bal.toFixed(2)}`;
        span.className = "balance-positive";
      } else if (bal < 0) {
        span.textContent = `You owe ₹${(-bal).toFixed(2)}`;
        span.className = "balance-negative";
      } else {
        span.textContent = "Settled up";
      }
      if (u === currentUser) {
        li.style.fontWeight = "bold";
      }
      li.appendChild(span);
      balancesList.appendChild(li);
    });

    // Display expenses with settle button
    expenseList.innerHTML = "";
    expenses.forEach(exp => {
      const li = document.createElement("li");
      li.className = "expense-item";
      if (exp.settled) li.classList.add("settled");

      li.innerHTML = `
        <div>
          <strong>${exp.desc}</strong> - ₹${exp.amount.toFixed(2)} paid by <em>${exp.paidBy}</em><br/>
          <small>${new Date(exp.date).toLocaleString()}</small>
        </div>
      `;

      if (!exp.settled) {
        const btn = document.createElement("button");
        btn.textContent = "Mark Settled";
        btn.className = "settle-btn";
        btn.onclick = () => {
          expensesRef.child(exp.id).update({ settled: true });
        };
        li.appendChild(btn);
      } else {
        const span = document.createElement("span");
        span.textContent = "✓ Settled";
        span.style.color = "green";
        li.appendChild(span);
      }

      expenseList.appendChild(li);
    });

    // Monthly summary
    // Group expenses by month-year, only unsettled counted
    const monthlyMap = {};
    expenses.forEach(exp => {
      if (exp.settled) return;
      const dt = new Date(exp.date);
      const key = dt.getFullYear() + "-" + (dt.getMonth() + 1);
      monthlyMap[key] = (monthlyMap[key] || 0) + exp.amount;
    });

    monthlySummaryList.innerHTML = "";
    Object.entries(monthlyMap).forEach(([key, total]) => {
      const [year, month] = key.split("-");
      const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
      const li = document.createElement("li");
      li.textContent = `${monthName} ${year}: ₹${total.toFixed(2)}`;
      monthlySummaryList.appendChild(li);
    });
    
  });
  
}
function downloadMonthlyCSV() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const monthKey = `${year}-${month}`;
  
  // Fetch data again just for safety (you could reuse if stored)
  expensesRef.once("value", snapshot => {
    const data = snapshot.val() || {};
    const expenses = Object.values(data);

    const monthlyExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.date);
      const expMonth = expDate.getMonth() + 1;
      const expYear = expDate.getFullYear();
      return expYear === year && expMonth === month && !exp.settled;
    });

    if (monthlyExpenses.length === 0) {
      alert("No unsettled expenses found for this month.");
      return;
    }

    let csv = "Date,Amount,Description,Paid By\n";
    monthlyExpenses.forEach(exp => {
      const row = [
        new Date(exp.date).toLocaleDateString(),
        exp.amount,
        `"${exp.desc.replace(/"/g, '""')}"`,
        exp.paidBy
      ].join(",");
      csv += row + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `Expenses_${monthKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  });
}
function deleteAllExpenses() {
  if (confirm("Are you sure you want to delete all expenses? This cannot be undone.")) {
    expensesRef.remove()
      .then(() => alert("All expenses deleted successfully."))
      .catch(error => alert("Error deleting expenses: " + error));
  }
}
