const currencies = {
  ILS: { symbol: "₪", name: "שקל", budget: 2400 },
  THB: { symbol: "฿", name: "באט", budget: 24000 },
  USD: { symbol: "$", name: "דולר", budget: 900 },
  EUR: { symbol: "€", name: "יורו", budget: 850 },
};

const storageKey = "moda-budget-state";
const appVersion = "v9";
const photoDbName = "moda-receipt-photos";
const photoStoreName = "photos";
const twoYearsMs = 730 * 24 * 60 * 60 * 1000;
const gmailScope = "https://www.googleapis.com/auth/gmail.readonly";

const state = loadState();
let calcMode = "expense";
let calcValue = "";
let gmailTokenClient = null;
let gmailAccessToken = "";
let photoDbPromise = null;

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
  gmailStatus: document.querySelector("#gmailStatus"),
  googleClientId: document.querySelector("#googleClientId"),
  senderInput: document.querySelector("#senderInput"),
  scanBtn: document.querySelector("#scanBtn"),
  connectBtn: document.querySelector("#connectBtn"),
  photoPickBtn: document.querySelector("#photoPickBtn"),
  receiptPhotoInput: document.querySelector("#receiptPhotoInput"),
  receiptPhotoName: document.querySelector("#receiptPhotoName"),
  receiptSearch: document.querySelector("#receiptSearch"),
  photoList: document.querySelector("#photoList"),
  photoDialog: document.querySelector("#photoDialog"),
  photoTitle: document.querySelector("#photoTitle"),
  photoPreview: document.querySelector("#photoPreview"),
  photoCloseBtn: document.querySelector("#photoCloseBtn"),
  reportOverlay: document.querySelector("#reportOverlay"),
  reportTitle: document.querySelector("#reportTitle"),
  reportGrid: document.querySelector("#reportGrid"),
  reportSources: document.querySelector("#reportSources"),
  reportAcknowledgeBtn: document.querySelector("#reportAcknowledgeBtn"),
};

function setGmailEngineState(status, text) {
  const box = els.gmailStatus.closest(".gmail-connect");
  box.classList.remove("engine-idle", "engine-running", "engine-done", "engine-error");
  box.classList.add(`engine-${status}`);
  els.gmailStatus.textContent = text;
  if (status === "done") {
    window.setTimeout(() => box.classList.remove("engine-done"), 2600);
  }
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (saved) return JSON.parse(saved);
  return {
    currency: "ILS",
    budget: currencies.ILS.budget,
    connected: false,
    googleClientId: "",
    receiptSenders: "receipt@shopee.co.th\nno-reply@lazada.co.th\ntherapy@example.com",
    transactions: [],
    receipts: [],
    processedGmailIds: [],
    receiptPhotos: [],
    duplicateBlocks: [],
    lastReportAcknowledgedPeriod: "",
    firstUse: new Date().toISOString(),
  };
}

function saveState() {
  state.processedGmailIds = state.processedGmailIds || [];
  state.receiptPhotos = state.receiptPhotos || [];
  state.duplicateBlocks = state.duplicateBlocks || [];
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function formatMoney(amount, currency = state.currency) {
  return `${Number(amount).toLocaleString("he-IL")} ${currencies[currency].symbol}`;
}

function currentHalfMonth() {
  const now = new Date();
  const day = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const startDay = day <= 15 ? 1 : 16;
  const endDay = day <= 15 ? 15 : lastDay;
  return {
    day,
    startDay,
    endDay,
    daysLeft: Math.max(0, endDay - day + 1),
  };
}

function halfPeriodFor(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const half = day <= 15 ? 1 : 2;
  const startDay = half === 1 ? 1 : 16;
  const endDay = half === 1 ? 15 : new Date(year, month + 1, 0).getDate();
  const start = new Date(year, month, startDay, 0, 0, 0, 0);
  const end = new Date(year, month, endDay, 23, 59, 59, 999);
  return {
    id: `${year}-${String(month + 1).padStart(2, "0")}-H${half}`,
    label: `${start.toLocaleDateString("he-IL")} - ${end.toLocaleDateString("he-IL")}`,
    start,
    end,
    half,
  };
}

function previousHalfPeriod(period = halfPeriodFor(new Date())) {
  const base = new Date(period.start);
  base.setDate(base.getDate() - 1);
  return halfPeriodFor(base);
}

function isInPeriod(dateValue, period) {
  const time = new Date(dateValue).getTime();
  return time >= period.start.getTime() && time <= period.end.getTime();
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
  const halfStart = day <= 15 ? 1 : 16;
  const dailyPace = Math.round(budget / Math.max(1, endDay - halfStart + 1));
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

  const recommendedToday = Math.round(remaining / Math.max(1, daysLeft));
  els.remainingText.textContent = `נשארו ${formatMoney(remaining)} ל-${daysLeft} ימים. ${remaining > 0 ? `אם תוציא פחות מ-${formatMoney(recommendedToday)} היום, אתה נשאר במסלול.` : "הגיע הזמן לעצור רגע ולבחור רק מה שחיוני."}`;

  renderTransactions();
  renderReceipts();
  renderPhotos();
  renderChallenge();
  renderGmailSettings();
  saveState();
}

function openPhotoDb() {
  if (photoDbPromise) return photoDbPromise;
  photoDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(photoDbName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(photoStoreName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return photoDbPromise;
}

async function savePhotoBlob(id, file) {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(photoStoreName, "readwrite");
    tx.objectStore(photoStoreName).put(file, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getPhotoBlob(id) {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(photoStoreName, "readonly");
    const request = tx.objectStore(photoStoreName).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deletePhotoBlob(id) {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(photoStoreName, "readwrite");
    tx.objectStore(photoStoreName).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function renderGmailSettings() {
  els.googleClientId.value = state.googleClientId || "";
  els.senderInput.value = state.receiptSenders || "";
  if (gmailAccessToken) {
    setGmailEngineState("idle", "Gmail מחובר. אפשר לעדכן את החודש.");
  } else if (state.googleClientId) {
    setGmailEngineState("idle", "Client ID נשמר. לחץ חבר כדי לאשר גישה ל-Gmail.");
  } else {
    setGmailEngineState("idle", "הכנס Client ID של Google, חבר Gmail, ואז עדכן את החודש.");
  }
}

async function exportState() {
  const backup = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  try {
    await navigator.clipboard.writeText(backup);
    alert("הגיבוי הועתק. פתח את מודע ממסך הבית, לחץ ייבוא והדבק אותו.");
  } catch {
    prompt("העתק את הגיבוי הזה:", backup);
  }
}

function importState() {
  const backup = prompt("הדבק כאן את הגיבוי:");
  if (!backup) return;
  try {
    const imported = JSON.parse(decodeURIComponent(escape(atob(backup.trim()))));
    Object.assign(state, imported);
    saveState();
    render();
    alert("הייבוא הושלם.");
  } catch {
    alert("הגיבוי לא תקין. נסה להעתיק אותו שוב.");
  }
}

function renderTransactions() {
  const today = [];
  const older = [];
  state.transactions.slice(0, 24).forEach((tx) => {
    const bucket = new Date(tx.date).toDateString() === new Date().toDateString() ? today : older;
    bucket.push(tx);
  });

  const renderItem = (tx) => `
      <li>
        <div class="transaction-meta">
          <strong>${tx.label}</strong>
          <span>${new Date(tx.date).toLocaleDateString("he-IL")}${tx.source === "gmail" ? " · Gmail" : ""}</span>
        </div>
        <strong class="amount ${tx.type === "expense" ? "expense-text" : "income-text"}">
          ${tx.type === "expense" ? "-" : "+"}${formatMoney(tx.amount, tx.currency)}
        </strong>
      </li>
    `;

  const sections = [];
  if (today.length) sections.push(`<li class="transaction-divider">היום</li>${today.map(renderItem).join("")}`);
  if (older.length) sections.push(`<li class="transaction-divider">לפני היום</li>${older.map(renderItem).join("")}`);

  els.transactionList.innerHTML = sections.length
    ? sections.join("")
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
    : `<li><div class="receipt-meta"><strong>מנוע Gmail שקט</strong><span>לחץ "עדכן חודש" כדי לעדכן הוצאות. כפילויות מסוננות אוטומטית.</span></div></li>`;
}

function renderPhotos() {
  cleanupOldPhotos();
  const query = normalizeText(els.receiptSearch?.value || "");
  const photos = (state.receiptPhotos || [])
    .filter((photo) => !query || normalizeText(photo.name).includes(query))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  els.photoList.innerHTML = photos.length
    ? photos.map((photo) => `
      <li>
        <div class="photo-meta">
          <strong>${photo.name}</strong>
          <span>${new Date(photo.createdAt).toLocaleDateString("he-IL")}</span>
        </div>
        <button type="button" data-photo="${photo.id}">פתח</button>
      </li>
    `).join("")
    : `<li><div class="photo-meta"><strong>אין חשבוניות בארכיון</strong><span>צלם חשבונית ותן לה שם לחיפוש.</span></div></li>`;
}

function transactionsForPeriod(period) {
  return state.transactions.filter((tx) => tx.type === "expense" && isInPeriod(tx.date, period));
}

function duplicateBlocksForPeriod(period) {
  return (state.duplicateBlocks || []).filter((item) => isInPeriod(item.blockedAt, period));
}

function totalsByCurrency(transactions) {
  return transactions.reduce((totals, tx) => {
    totals[tx.currency] = (totals[tx.currency] || 0) + Number(tx.amount || 0);
    return totals;
  }, {});
}

function formatTotals(totals) {
  const entries = Object.entries(totals);
  if (!entries.length) return formatMoney(0);
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ");
}

function reportForPeriod(period) {
  const txs = transactionsForPeriod(period);
  const previous = transactionsForPeriod(previousHalfPeriod(period));
  const totals = totalsByCurrency(txs);
  const previousTotal = previous
    .filter((tx) => tx.currency === state.currency)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const currentMainTotal = totals[state.currency] || 0;
  const delta = currentMainTotal - previousTotal;
  const bySource = new Map();

  txs.forEach((tx) => {
    const key = `${tx.label}|${tx.currency}`;
    const existing = bySource.get(key) || { label: tx.label, currency: tx.currency, amount: 0 };
    existing.amount += Number(tx.amount || 0);
    bySource.set(key, existing);
  });

  return {
    period,
    totals,
    mainTotal: currentMainTotal,
    delta,
    overBudget: currentMainTotal - state.budget,
    gmailCount: txs.filter((tx) => tx.source === "gmail").length,
    manualCount: txs.filter((tx) => tx.source !== "gmail").length,
    duplicateCount: duplicateBlocksForPeriod(period).length,
    sources: [...bySource.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
  };
}

function maybeShowDueReport() {
  const period = previousHalfPeriod();
  const firstUse = new Date(state.firstUse || Date.now());
  if (firstUse > period.end) return;
  if (state.lastReportAcknowledgedPeriod === period.id) return;
  showReport(period);
}

function showReport(period = previousHalfPeriod()) {
  const report = reportForPeriod(period);
  els.reportOverlay.dataset.period = period.id;
  els.reportTitle.textContent = period.label;
  const overLabel = report.overBudget >= 0 ? "חריגה" : "מתחת ליעד";
  const deltaLabel = report.delta >= 0 ? "לעומת החצי הקודם" : "לעומת החצי הקודם";
  els.reportGrid.innerHTML = `
    <div><span>הוצאות</span><strong>${formatTotals(report.totals)}</strong></div>
    <div><span>יעד</span><strong>${formatMoney(state.budget)}</strong></div>
    <div><span>${overLabel}</span><strong>${formatMoney(Math.abs(report.overBudget))}</strong></div>
    <div><span>${deltaLabel}</span><strong>${report.delta >= 0 ? "+" : "-"}${formatMoney(Math.abs(report.delta))}</strong></div>
    <div><span>נאספו מ-Gmail</span><strong>${report.gmailCount}</strong></div>
    <div><span>נוספו ידנית</span><strong>${report.manualCount}</strong></div>
    <div><span>כפילויות שנחסמו</span><strong>${report.duplicateCount}</strong></div>
  `;
  els.reportSources.innerHTML = report.sources.length
    ? report.sources.map((source) => `<li><span>${source.label}</span><strong>${formatMoney(source.amount, source.currency)}</strong></li>`).join("")
    : `<li><span>אין הוצאות בתקופה</span><strong>${formatMoney(0)}</strong></li>`;
  els.reportOverlay.classList.add("active");
  els.reportOverlay.setAttribute("aria-hidden", "false");
}

function acknowledgeReport() {
  state.lastReportAcknowledgedPeriod = els.reportOverlay.dataset.period || previousHalfPeriod().id;
  saveState();
  els.reportOverlay.classList.remove("active");
  els.reportOverlay.setAttribute("aria-hidden", "true");
}

async function addReceiptPhoto(file) {
  if (!file) return;
  const name = els.receiptPhotoName.value.trim() || `חשבונית ${new Date().toLocaleDateString("he-IL")}`;
  const id = crypto.randomUUID();
  await savePhotoBlob(id, file);
  state.receiptPhotos = state.receiptPhotos || [];
  state.receiptPhotos.unshift({
    id,
    name,
    createdAt: new Date().toISOString(),
    type: file.type || "image/jpeg",
  });
  els.receiptPhotoName.value = "";
  saveState();
  renderPhotos();
}

async function openReceiptPhoto(id) {
  const meta = (state.receiptPhotos || []).find((photo) => photo.id === id);
  const blob = await getPhotoBlob(id);
  if (!meta || !blob) {
    alert("התמונה לא נמצאה במכשיר הזה.");
    return;
  }
  if (els.photoPreview.src) URL.revokeObjectURL(els.photoPreview.src);
  els.photoTitle.textContent = meta.name;
  els.photoPreview.src = URL.createObjectURL(blob);
  els.photoDialog.showModal();
}

function cleanupOldPhotos() {
  const cutoff = Date.now() - twoYearsMs;
  const expired = (state.receiptPhotos || []).filter((photo) => new Date(photo.createdAt).getTime() < cutoff);
  if (!expired.length) return;
  state.receiptPhotos = state.receiptPhotos.filter((photo) => new Date(photo.createdAt).getTime() >= cutoff);
  expired.forEach((photo) => deletePhotoBlob(photo.id));
  saveState();
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

function addTransaction(type, amount, label = type === "expense" ? "הזנה מהירה" : "הכנסה", options = {}) {
  state.transactions.unshift({
    id: crypto.randomUUID(),
    type,
    amount,
    currency: options.currency || state.currency,
    label,
    date: options.date || new Date().toISOString(),
    source: options.source || "manual",
    gmailMessageId: options.gmailMessageId || null,
    fingerprint: options.fingerprint || null,
  });
  render();
}

function parseSenders() {
  return (state.receiptSenders || "")
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function monthRangeQuery() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const format = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("/");
  return `after:${format(start)} before:${format(end)}`;
}

function initGmailTokenClient() {
  if (!state.googleClientId) {
    setGmailEngineState("error", "חסר Google OAuth Client ID.");
    return null;
  }
  if (state.googleClientId.includes("@") || !state.googleClientId.endsWith(".apps.googleusercontent.com")) {
    setGmailEngineState("error", "בשדה Client ID צריך להדביק OAuth Client ID מ-Google Cloud, לא כתובת Gmail.");
    return null;
  }
  if (!window.google?.accounts?.oauth2) {
    setGmailEngineState("error", "ספריית Google עדיין נטענת. נסה שוב בעוד רגע.");
    return null;
  }
  gmailTokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: state.googleClientId,
    scope: gmailScope,
    callback: (response) => {
      if (response.error) {
        setGmailEngineState("error", `החיבור נכשל: ${response.error}`);
        return;
      }
      gmailAccessToken = response.access_token;
      state.connected = true;
      saveState();
      setGmailEngineState("done", "Gmail מחובר. המנוע מתחיל לעדכן.");
      scanGmailReal();
    },
  });
  return gmailTokenClient;
}

function connectGmail() {
  state.googleClientId = els.googleClientId.value.trim();
  state.receiptSenders = els.senderInput.value.trim();
  saveState();
  const tokenClient = initGmailTokenClient();
  if (!tokenClient) return;
  tokenClient.requestAccessToken({ prompt: "consent" });
}

async function scanGmailReal() {
  state.googleClientId = els.googleClientId.value.trim();
  state.receiptSenders = els.senderInput.value.trim();
  saveState();

  if (!gmailAccessToken) {
    const tokenClient = initGmailTokenClient();
    if (!tokenClient) return;
    setGmailEngineState("error", "צריך להתחבר ל-Gmail לפני עדכון.");
    tokenClient.requestAccessToken({ prompt: "consent" });
    return;
  }

  const senders = parseSenders();
  if (!senders.length) {
    setGmailEngineState("error", "צריך להזין לפחות כתובת מייל אחת של קבלות.");
    return;
  }

  setGmailEngineState("running", "המנוע עובד. סורק Gmail ומעדכן הוצאות...");
  els.scanBtn.disabled = true;
  els.scanBtn.textContent = "עובד...";

  try {
    const messages = await listReceiptMessages(senders);
    const imported = [];
    for (const message of messages.slice(0, 25)) {
      if (isGmailMessageProcessed(message.id)) continue;
      const full = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`);
      const candidate = receiptFromMessage(full);
      markGmailMessageProcessed(message.id);
      if (candidate) {
        if (isDuplicateTransaction(candidate)) {
          recordDuplicateBlock(candidate);
        } else {
          addGmailTransaction(candidate);
          imported.push(candidate);
        }
      }
    }
    state.receipts = [];
    setGmailEngineState("done", imported.length
      ? `נוספו ${imported.length} הוצאות מ-Gmail.`
      : "הסריקה הסתיימה. אין הוצאות חדשות.");
    render();
  } catch (error) {
    setGmailEngineState("error", `סריקת Gmail נכשלה: ${friendlyGmailError(error)}`);
  } finally {
    els.scanBtn.disabled = false;
    els.scanBtn.textContent = "עדכן חודש";
  }
}

async function listReceiptMessages(senders) {
  const seen = new Map();
  for (const sender of senders) {
    const q = `${monthRangeQuery()} from:${sender}`;
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${encodeURIComponent(q)}`;
    const result = await gmailFetch(url);
    (result.messages || []).forEach((message) => seen.set(message.id, message));
  }
  const keywordQuery = `${monthRangeQuery()} (${[
    "receipt",
    "invoice",
    "payment",
    "paid",
    "order",
    "total",
    "קבלה",
    "חשבונית",
    "תשלום",
    "הזמנה",
  ].map((word) => `"${word}"`).join(" OR ")})`;
  const keywordUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(keywordQuery)}`;
  const keywordResult = await gmailFetch(keywordUrl);
  (keywordResult.messages || []).forEach((message) => seen.set(message.id, message));
  return [...seen.values()];
}

async function gmailFetch(url) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${gmailAccessToken}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }
  return response.json();
}

function receiptFromMessage(message) {
  const headers = Object.fromEntries((message.payload?.headers || []).map((header) => [header.name.toLowerCase(), header.value]));
  const sender = headers.from || "Gmail";
  const subject = headers.subject || "קבלה";
  const date = headers.date ? new Date(headers.date) : new Date(Number(message.internalDate || Date.now()));
  const body = `${subject}\n${extractMessageText(message.payload)}`;
  const parsed = parseReceiptAmount(body);
  if (!parsed) return null;
  return {
    id: crypto.randomUUID(),
    source: merchantName(sender, subject),
    sender,
    amount: parsed.amount,
    currency: parsed.currency,
    date: date.toISOString(),
    gmailMessageId: message.id,
    fingerprint: receiptFingerprint(sender, parsed.amount, parsed.currency, date, subject),
  };
}

function addGmailTransaction(candidate) {
  addTransaction("expense", candidate.amount, candidate.source, {
    currency: candidate.currency,
    date: candidate.date,
    source: "gmail",
    gmailMessageId: candidate.gmailMessageId,
    fingerprint: candidate.fingerprint,
  });
}

function isGmailMessageProcessed(messageId) {
  return (state.processedGmailIds || []).includes(messageId) ||
    state.transactions.some((tx) => tx.gmailMessageId === messageId);
}

function markGmailMessageProcessed(messageId) {
  state.processedGmailIds = state.processedGmailIds || [];
  if (!state.processedGmailIds.includes(messageId)) state.processedGmailIds.push(messageId);
}

function recordDuplicateBlock(candidate) {
  state.duplicateBlocks = state.duplicateBlocks || [];
  const key = candidate.gmailMessageId || candidate.fingerprint;
  if (state.duplicateBlocks.some((item) => item.key === key)) return;
  state.duplicateBlocks.push({
    key,
    blockedAt: new Date().toISOString(),
    amount: candidate.amount,
    currency: candidate.currency,
    source: candidate.source,
  });
  saveState();
}

function isDuplicateTransaction(candidate) {
  return state.transactions.some((tx) =>
    tx.gmailMessageId === candidate.gmailMessageId ||
    tx.fingerprint === candidate.fingerprint ||
    (
      tx.source === "gmail" &&
      tx.currency === candidate.currency &&
      Math.abs(Number(tx.amount) - Number(candidate.amount)) < 0.01 &&
      Math.abs(new Date(tx.date).getTime() - new Date(candidate.date).getTime()) < 36 * 60 * 60 * 1000 &&
      normalizeText(tx.label) === normalizeText(candidate.source)
    )
  );
}

function receiptFingerprint(sender, amount, currency, date, subject) {
  const day = new Date(date).toISOString().slice(0, 10);
  return [normalizeText(sender), normalizeText(subject).slice(0, 40), currency, Number(amount).toFixed(2), day].join("|");
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function extractMessageText(part) {
  if (!part) return "";
  const chunks = [];
  if (part.body?.data) chunks.push(decodeBase64Url(part.body.data));
  (part.parts || []).forEach((child) => chunks.push(extractMessageText(child)));
  return chunks.join("\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function decodeBase64Url(value) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function parseReceiptAmount(text) {
  const currency = detectCurrency(text);
  const patterns = [
    /(?:total|amount|paid|payment|order total|grand total|סה"כ|סכום|שולם)[^\d]{0,36}([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /(?:₪|฿|\$|€)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/,
    /([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:₪|฿|USD|EUR|THB|ILS)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const amount = Number(match[1].replace(/,/g, ""));
    if (amount > 0) return { amount, currency };
  }
  return null;
}

function detectCurrency(text) {
  if (/฿|THB|baht/i.test(text)) return "THB";
  if (/€|EUR/i.test(text)) return "EUR";
  if (/\$|USD/i.test(text)) return "USD";
  return "ILS";
}

function merchantName(sender, subject) {
  const value = `${sender} ${subject}`;
  if (/shopee/i.test(value)) return "Shopee";
  if (/lazada/i.test(value)) return "Lazada";
  if (/therapy|טיפול|מטפל|מטפלת/i.test(value)) return "טיפול רגשי";
  return sender.split("<")[0].trim() || "קבלה";
}

function friendlyGmailError(error) {
  const message = error.message || "";
  if (message.includes("insufficientPermissions")) return "ההרשאה לא כוללת קריאת Gmail. התחבר שוב ואשר gmail.readonly.";
  if (message.includes("access_denied")) return "ההרשאה נדחתה בחלון Google.";
  if (message.includes("invalid_client")) return "ה-Client ID לא תקין או שלא הוגדר לכתובת האתר הזו.";
  if (message.includes("origin_mismatch")) return "צריך להוסיף את כתובת GitHub Pages ל-Authorized JavaScript origins.";
  return message.slice(0, 220);
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
els.scanBtn.addEventListener("click", scanGmailReal);
els.connectBtn.addEventListener("click", connectGmail);
document.querySelector("#notifyBtn").addEventListener("click", () => showReport(previousHalfPeriod()));
els.reportAcknowledgeBtn.addEventListener("click", acknowledgeReport);
document.querySelector("#resetBtn").addEventListener("click", () => {
  localStorage.removeItem(storageKey);
  location.reload();
});
document.querySelector("#exportBtn").addEventListener("click", exportState);
document.querySelector("#importBtn").addEventListener("click", importState);
els.photoPickBtn.addEventListener("click", () => els.receiptPhotoInput.click());
els.receiptPhotoInput.addEventListener("change", () => {
  addReceiptPhoto(els.receiptPhotoInput.files?.[0]);
  els.receiptPhotoInput.value = "";
});
els.receiptSearch.addEventListener("input", renderPhotos);
els.photoList.addEventListener("click", (event) => {
  const id = event.target.dataset.photo;
  if (id) openReceiptPhoto(id);
});
els.photoCloseBtn.addEventListener("click", () => els.photoDialog.close());
els.photoDialog.addEventListener("close", () => {
  if (els.photoPreview.src) URL.revokeObjectURL(els.photoPreview.src);
  els.photoPreview.removeAttribute("src");
});

els.currencySelect.addEventListener("change", (event) => {
  state.currency = event.target.value;
  state.budget = currencies[state.currency].budget;
  render();
});

els.googleClientId.addEventListener("change", () => {
  state.googleClientId = els.googleClientId.value.trim();
  saveState();
});

els.senderInput.addEventListener("change", () => {
  state.receiptSenders = els.senderInput.value.trim();
  saveState();
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
setTimeout(maybeShowDueReport, 350);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
