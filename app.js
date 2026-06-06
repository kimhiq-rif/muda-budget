const currencies = {
  ILS: { symbol: "₪", name: "שקל", budget: 2400 },
  THB: { symbol: "฿", name: "באט", budget: 24000 },
  USD: { symbol: "$", name: "דולר", budget: 900 },
  EUR: { symbol: "€", name: "יורו", budget: 850 },
};

const seedReceipts = [
  { id: "r1", source: "Shopee", sender: "receipt@shopee.co.th", amount: 640, currency: "THB", date: "2026-06-03" },
  { id: "r2", source: "Lazada", sender: "no-reply@lazada.co.th", amount: 1180, currency: "THB", date: "2026-06-05" },
  { id: "r3", source: "טיפול רגשי", sender: "therapy@example.com", amount: 320, currency: "ILS", date: "2026-06-01" },
];

const state = loadState();
let calcMode = "expense";
let calcValue = "";

const els = {
  periodTotal: document.querySelector("#periodTotal"),
  currencySelect: document.querySelector("#currencySelect"),
  ringFill: document.querySelector("#ringFill"),
  progressPercent: document.querySelector("#progressPercent"),
  insightText: document.querySelector("#insightText"),
  remainingText: document.querySelector("#remainingText"),
  transactionList: document.querySelector("#transactionList"),
  receiptList: document.querySelector("#receiptList"),
  calcDialog: document.querySelector("#calcDialog"),
  calcTitle: document.querySelector("#calcTitle"),
  calcDisplay: document.querySelector("#calcDisplay"),
  calcGrid: document.querySelector("#calcGrid"),
  saveCalc: document.querySelector("#saveCalc"),
  budgetText: document.querySelector("#budgetText"),
  daysText: document.querySelector("#daysText"),
  challengeTitle: document.querySelector("#challengeTitle"),
  challengeText: document.querySelector("#challengeText"),
  pushOverlay: document.querySelector("#pushOverlay"),
  dismissSlider: document.querySelector("#dismissSlider"),
  pushText: document.querySelector("#pushText"),
};

function loadState() {
  const saved = localStorage.getItem("moda-budget-state");
  if (saved) return JSON.parse(saved);
  return {
    currency: "ILS",
    budget: currencies.ILS.budget,
    connected: false,
    transactions: [
      { id: crypto.randomUUID(), type: "expense", amount: 126, currency: "ILS", label: "קפה וסידורים", date: new Date().toISOString() },
      { id: crypto.randomUUID(), type: "income", amount: 500, currency: "ILS", label: "הכנסה", date: new Date().toISOString() },
    ],
    receipts: [],
    firstUse: new Date().toISOString(),
  };
}

function saveState() {
  localStorage.setItem("moda-budget-state", JSON.stringify(state));
}

function formatMoney(amount, currency = state.currency) {
  const symbol = currencies[currency].symbol;
  return `${Number(amount).toLocaleString("he-IL")} ${symbol}`;
}

function currentHalfMonth() {
  const now = new Date();
  const day = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const startDay = day <= 15 ? 1 : 16;
  const endDay = day <= 15 ? 15 : lastDay;
  const daysLeft = Math.max(0, endDay - day + 1);
  return { day, startDay, endDay, daysLeft };
}

function periodExpenses() {
  const { startDay, endDay } = currentHalfMonth();
  const now = new Date();
  return state.transactions
    .filter((tx) => {
      const date = new Date(tx.date);
      return tx.type === "expense" &&
        tx.currency === state.currency &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear() &&
        date.getDate() >= startDay &&
        date.getDate() <= endDay;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function todayExpenses() {
  const now = new Date();
  return state.transactions
    .filter((tx) => {
      const date = new Date(tx.date);
      return tx.type === "expense" &&
        tx.currency === state.currency &&
        date.toDateString() === now.toDateString();
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function render() {
  const spent = periodExpenses();
  const today = todayExpenses();
  const { daysLeft, endDay, day } = currentHalfMonth();
  const budget = state.budget;
  const percent = Math.min(100, Math.round((spent / budget) * 100));
  const dailyPace = Math.round(budget / Math.max(1, endDay - (day <= 15 ? 1 : 16) + 1));
  const todayDelta = today - dailyPace;
  const remaining = Math.max(0, budget - spent);
  const circumference = 314;

  els.currencySelect.value = state.currency;
  els.periodTotal.textContent = formatMoney(spent);
  els.progressPercent.textContent = `${percent}%`;
  els.ringFill.style.strokeDashoffset = `${circumference - (circumference * percent) / 100}`;
  els.ringFill.style.stroke = percent > 90 ? "var(--coral)" : percent > 72 ? "#f2ad4e" : "var(--mint-strong)";
  els.budgetText.textContent = formatMoney(budget);
  els.daysText.textContent = daysLeft.toString();

  if (spent === 0) {
    els.insightText.textContent = "עדיין אין הוצאות בחצי הזה. נקודת פתיחה נקייה.";
  } else if (todayDelta > 0) {
    els.insightText.textContent = `היום הוצאת ${formatMoney(today)}, שזה ${formatMoney(todayDelta)} מעל הקצב היומי.`;
  } else {
    els.insightText.textContent = `היום הוצאת ${formatMoney(today)}. אתה בתוך הקצב.`;
  }
  els.remainingText.textContent = `נשארו ${formatMoney(remaining)} ל-${daysLeft} ימים. ${remaining > 0 ? `אם תוציא פחות מ-${formatMoney(Math.round(remaining / Math.max(1, daysLeft)))} היום, אתה נשאר במסלול.` : "הגיע הזמן לעצור רגע ולבחור רק מה שחיוני."}`;

  renderTransactions();
  renderReceipts();
  renderChallenge();
  saveState();
}

function renderTransactions() {
  const items = state.transactions.slice(0, 7);
  els.transactionList.innerHTML = items.length
    ? items.map((tx) => `
      <li>
        <div class="transaction-meta">
          <strong>${tx.label}</strong>
          <span>${new Date(tx.date).toLocaleDateString("he-IL")}</span>
        </div>
        <strong class="amount ${tx.type === "expense" ? "expense-text" : "income-text"}">
          ${tx.type === "expense" ? "-" : "+"}${formatMoney(tx.amount, tx.currency)}
        </strong>
      </li>
    `).join("")
    : `<li><div class="transaction-meta"><strong>אין פעולות עדיין</strong><span>לחץ על + או - כדי להתחיל.</span></div></li>`;
}

function renderReceipts() {
  els.receiptList.innerHTML = state.receipts.length
    ? state.receipts.map((receipt) => `
      <li>
        <div class="receipt-meta">
          <strong>${receipt.source}</strong>
          <span>${receipt.sender} · ${new Date(receipt.date).toLocaleDateString("he-IL")} · ${formatMoney(receipt.amount, receipt.currency)}</span>
        </div>
        <div class="receipt-actions">
          <button class="approve" type="button" data-approve="${receipt.id}">כן</button>
          <button class="reject" type="button" data-reject="${receipt.id}">לא</button>
        </div>
      </li>
    `).join("")
    : `<li><div class="receipt-meta"><strong>אין קבלות שמחכות לאישור</strong><span>לחץ על "סרוק חודש" כדי לראות דמו של מנגנון Gmail.</span></div></li>`;
}

function renderChallenge() {
  const daysSinceStart = Math.floor((Date.now() - new Date(state.firstUse).getTime()) / 86400000);
  if (daysSinceStart < 30) {
    els.challengeTitle.textContent = "חודש ראשון: רק מודעות";
    els.challengeText.textContent = "המערכת לומדת את דפוסי ההוצאות שלך בלי להעניש ובלי לייצר רעש. אחרי חודש היא תחשב יעד חיתוך של 30%.";
    return;
  }
  const monthIndex = Math.floor(daysSinceStart / 30);
  const cut = Math.min(40, 30 + Math.max(0, monthIndex - 1) * 5);
  els.challengeTitle.textContent = `אתגר פעיל: חיתוך ${cut}%`;
  els.challengeText.textContent = "היעד מחושב לפי חודש הבסיס שלך. המטרה היא צמצום הדרגתי שמרגיש אפשרי, לא מרדף מתיש.";
}

function openCalc(type) {
  calcMode = type;
  calcValue = "";
  els.calcTitle.textContent = type === "expense" ? "הוצאה חדשה" : "הכנסה חדשה";
  els.calcDisplay.textContent = "0";
  els.calcDialog.showModal();
}

function buildCalculator() {
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].forEach((key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = key;
    button.addEventListener("click", () => pressCalc(key));
    els.calcGrid.appendChild(button);
  });
}

function pressCalc(key) {
  if (key === "⌫") calcValue = calcValue.slice(0, -1);
  else if (key === "." && calcValue.includes(".")) return;
  else calcValue = `${calcValue}${key}`;
  els.calcDisplay.textContent = calcValue || "0";
}

function addTransaction(type, amount, label = type === "expense" ? "הזנה מהירה" : "הכנסה") {
  state.transactions.unshift({
    id: crypto.randomUUID(),
    type,
    amount,
    currency: state.currency,
    label,
    date: new Date().toISOString(),
  });
  render();
}

function scanGmailDemo() {
  state.connected = true;
  const currentCurrencyReceipts = seedReceipts.filter((receipt) => receipt.currency === state.currency || receipt.currency === "ILS");
  state.receipts = currentCurrencyReceipts.map((receipt) => ({ ...receipt, id: crypto.randomUUID() }));
  render();
}

function approveReceipt(id) {
  const receipt = state.receipts.find((item) => item.id === id);
  if (!receipt) return;
  state.currency = receipt.currency;
  state.budget = currencies[state.currency].budget;
  addTransaction("expense", receipt.amount, receipt.source);
  state.receipts = state.receipts.filter((item) => item.id !== id);
  render();
}

function rejectReceipt(id) {
  state.receipts = state.receipts.filter((item) => item.id !== id);
  render();
}

function playReminderTone() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  [660, 880, 740].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = ctx.currentTime + index * 0.18;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.start(start);
    osc.stop(start + 0.17);
  });
}

function showPushDemo() {
  const spent = periodExpenses();
  const { daysLeft } = currentHalfMonth();
  els.pushText.textContent = `הוצאת ${formatMoney(spent)} בחצי הנוכחי. נשארו ${formatMoney(Math.max(0, state.budget - spent))} ל-${daysLeft} ימים.`;
  els.dismissSlider.value = 0;
  els.pushOverlay.classList.add("active");
  els.pushOverlay.setAttribute("aria-hidden", "false");
  playReminderTone();
}

document.querySelector("#incomeBtn").addEventListener("click", () => openCalc("income"));
document.querySelector("#expenseBtn").addEventListener("click", () => openCalc("expense"));
document.querySelector("#scanBtn").addEventListener("click", scanGmailDemo);
document.querySelector("#connectBtn").addEventListener("click", scanGmailDemo);
document.querySelector("#notifyBtn").addEventListener("click", showPushDemo);
document.querySelector("#resetBtn").addEventListener("click", () => {
  localStorage.removeItem("moda-budget-state");
  location.reload();
});

els.currencySelect.addEventListener("change", (event) => {
  state.currency = event.target.value;
  state.budget = currencies[state.currency].budget;
  render();
});

els.saveCalc.addEventListener("click", () => {
  const amount = Number(calcValue);
  if (amount > 0) addTransaction(calcMode, amount);
});

els.calcDialog.addEventListener("close", () => {
  calcValue = "";
});

els.receiptList.addEventListener("click", (event) => {
  const approveId = event.target.dataset.approve;
  const rejectId = event.target.dataset.reject;
  if (approveId) approveReceipt(approveId);
  if (rejectId) rejectReceipt(rejectId);
});

els.dismissSlider.addEventListener("input", () => {
  if (Number(els.dismissSlider.value) > 92) {
    els.pushOverlay.classList.remove("active");
    els.pushOverlay.setAttribute("aria-hidden", "true");
  }
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.tab}Panel`).classList.add("active");
  });
});

document.addEventListener("keydown", (event) => {
  if (!els.calcDialog.open) return;
  if (/^\d$/.test(event.key) || event.key === ".") pressCalc(event.key);
  if (event.key === "Backspace") pressCalc("⌫");
  if (event.key === "Enter") {
    event.preventDefault();
    const amount = Number(calcValue);
    if (amount > 0) {
      addTransaction(calcMode, amount);
      els.calcDialog.close();
    }
  }
});

buildCalculator();
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
