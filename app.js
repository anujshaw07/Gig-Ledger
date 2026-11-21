
/* ==========================================================
   GIGLEDGER — COMPLETE APPLICATION
   Authentication + Demo + Income + Expenses + Analytics
========================================================== */

"use strict";

/* =========================
   CONFIGURATION
========================= */

const USERS_KEY = "gigledger_users_v2";
const SESSION_KEY = "gigledger_session_v2";
const DATA_PREFIX = "gigledger_data_v2_";

const INCOME_SOURCES = [
  "Swiggy",
  "Zomato",
  "Uber",
  "Rapido",
  "Ola",
  "Private rides",
  "Freelance work",
  "Part-time job",
  "Other income"
];

const EXPENSE_SOURCES = [
  "Fuel",
  "Food",
  "Vehicle maintenance",
  "Mobile recharge",
  "Internet",
  "Equipment",
  "Travel",
  "Other expense"
];

const DEMO_USER = {
  id: "gigledger_demo",
  name: "Demo Worker",
  city: "Kolkata",
  isDemo: true
};

let currentUser = null;
let entries = [];
let editingEntryId = null;
let toastTimer = null;

/* =========================
   HELPERS
========================= */

const $ = id => document.getElementById(id);

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(safeNumber(value));
}

function todayString() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "entry_" + Date.now() + "_" + Math.random().toString(16).slice(2);
}

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function dataKey(userId) {
  return DATA_PREFIX + userId;
}

function saveEntries() {
  if (!currentUser) return;

  localStorage.setItem(
    dataKey(currentUser.id),
    JSON.stringify(entries)
  );
}

function loadEntries(userId) {
  try {
    const saved = JSON.parse(
      localStorage.getItem(dataKey(userId)) || "[]"
    );

    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function formatDate(dateString) {
  if (!dateString) return "—";

  const date = new Date(dateString + "T00:00:00");

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getCurrentMonthEntries() {
  const month = todayString().slice(0, 7);

  return entries.filter(entry =>
    String(entry.date || "").startsWith(month)
  );
}

function getTotals(list = entries) {
  const income = list
    .filter(entry => entry.type === "income")
    .reduce((sum, entry) => sum + safeNumber(entry.amount), 0);

  const expenses = list
    .filter(entry => entry.type === "expense")
    .reduce((sum, entry) => sum + safeNumber(entry.amount), 0);

  return {
    income,
    expenses,
    net: income - expenses,
    count: list.length
  };
}

/* =========================
   PASSWORD SECURITY
========================= */

async function hashPassword(password, salt) {
  if (!window.crypto || !crypto.subtle) {
    throw new Error(
      "Secure password storage is unavailable. Open GigLedger through localhost or HTTPS."
    );
  }

  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 150000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );

  return Array.from(new Uint8Array(bits))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function makeSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

/* =========================
   DEMO ACCOUNT
========================= */

function seedDemoData() {
  const key = dataKey(DEMO_USER.id);

  if (localStorage.getItem(key)) return;

  const demoEntries = [
    {
      id: makeId(),
      type: "income",
      description: "Morning delivery shift",
      source: "Swiggy",
      amount: 850,
      date: todayString(),
      notes: "Demo transaction"
    },
    {
      id: makeId(),
      type: "income",
      description: "Lunch delivery shift",
      source: "Zomato",
      amount: 650,
      date: todayString(),
      notes: "Demo transaction"
    },
    {
      id: makeId(),
      type: "income",
      description: "Bike ride earnings",
      source: "Rapido",
      amount: 500,
      date: todayString(),
      notes: "Demo transaction"
    },
    {
      id: makeId(),
      type: "income",
      description: "Freelance project",
      source: "Freelance work",
      amount: 1800,
      date: todayString(),
      notes: "Demo transaction"
    },
    {
      id: makeId(),
      type: "expense",
      description: "Petrol",
      source: "Fuel",
      amount: 250,
      date: todayString(),
      notes: "Demo transaction"
    },
    {
      id: makeId(),
      type: "expense",
      description: "Lunch",
      source: "Food",
      amount: 120,
      date: todayString(),
      notes: "Demo transaction"
    }
  ];

  localStorage.setItem(key, JSON.stringify(demoEntries));
}

/* =========================
   AUTHENTICATION SCREEN
========================= */

function showAuth() {
  if ($("authScreen")) $("authScreen").hidden = false;
  if ($("appScreen")) $("appScreen").hidden = true;
}

function showApplication() {
  if ($("authScreen")) $("authScreen").hidden = true;
  if ($("appScreen")) $("appScreen").hidden = false;
}

function switchAuthTab(tab) {
  const loginForm = $("loginForm");
  const registerForm = $("registerForm");
  const loginTab = $("showLogin");
  const registerTab = $("showRegister");

  if (!loginForm || !registerForm) return;

  const loginMode = tab === "login";

  loginForm.hidden = !loginMode;
  registerForm.hidden = loginMode;

  loginTab?.classList.toggle("active", loginMode);
  registerTab?.classList.toggle("active", !loginMode);

  $("loginError").textContent = "";
  $("registerError").textContent = "";
}

function activateUser(user) {
  currentUser = user;
  entries = loadEntries(user.id);

  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      id: user.id,
      name: user.name,
      city: user.city,
      isDemo: Boolean(user.isDemo)
    })
  );

  showApplication();
  renderDashboard();
  navigateTo("overview");
}

function logout() {
  currentUser = null;
  entries = [];

  sessionStorage.removeItem(SESSION_KEY);

  showAuth();
  switchAuthTab("login");

  if ($("loginForm")) $("loginForm").reset();

  showToast("You have logged out.");
}

/* =========================
   REGISTER
========================= */

async function registerAccount(event) {
  event.preventDefault();

  const errorBox = $("registerError");
  const submitButton = $("registerForm").querySelector(
    'button[type="submit"]'
  );

  errorBox.textContent = "";

  const name = $("registerName").value.trim();
  const id = $("registerId").value.trim().toLowerCase();
  const city = $("registerCity").value.trim();
  const password = $("registerPassword").value;
  const confirm = $("confirmPassword").value;

  if (name.length < 2) {
    errorBox.textContent = "Please enter your full name.";
    return;
  }

  if (!/^[a-zA-Z0-9_]{4,24}$/.test(id)) {
    errorBox.textContent =
      "ID must contain 4–24 letters, numbers or underscores.";
    return;
  }

  if (password.length < 8) {
    errorBox.textContent = "Password must contain at least 8 characters.";
    return;
  }

  if (password !== confirm) {
    errorBox.textContent = "Passwords do not match.";
    return;
  }

  const users = getUsers();

  if (users.some(user => user.id.toLowerCase() === id)) {
    errorBox.textContent = "This GigLedger ID is already registered.";
    return;
  }

  try {
    submitButton.disabled = true;
    submitButton.textContent = "Creating account...";

    const salt = makeSalt();
    const passwordHash = await hashPassword(password, salt);

    const newUser = {
      id,
      name,
      city,
      salt,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    localStorage.setItem(dataKey(id), JSON.stringify([]));

    activateUser({
      id,
      name,
      city,
      isDemo: false
    });

    showToast("Your GigLedger account is ready!");

  } catch (error) {
    errorBox.textContent = error.message || "Registration failed.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create my GigLedger ID →";
  }
}

/* =========================
   LOGIN
========================= */

async function loginAccount(event) {
  event.preventDefault();

  const errorBox = $("loginError");
  const submitButton = $("loginForm").querySelector(
    'button[type="submit"]'
  );

  errorBox.textContent = "";

  const id = $("loginId").value.trim().toLowerCase();
  const password = $("loginPassword").value;

  if (!id || !password) {
    errorBox.textContent = "Enter your GigLedger ID and password.";
    return;
  }

  const user = getUsers().find(
    item => item.id.toLowerCase() === id
  );

  if (!user) {
    errorBox.textContent =
      "GigLedger ID not found. Create an account first or use Try Demo.";
    return;
  }

  try {
    submitButton.disabled = true;
    submitButton.textContent = "Verifying...";

    const enteredHash = await hashPassword(password, user.salt);

    if (enteredHash !== user.passwordHash) {
      errorBox.textContent = "Incorrect GigLedger ID or password.";
      return;
    }

    activateUser({
      id: user.id,
      name: user.name,
      city: user.city,
      isDemo: false
    });

    showToast("Welcome back, " + user.name + "!");

  } catch (error) {
    errorBox.textContent = error.message || "Login failed.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Login to GigLedger →";
  }
}

/* =========================
   QUICK DEMO LOGIN
========================= */

function loginDemo() {
  seedDemoData();

  activateUser(DEMO_USER);

  showToast("Welcome to the GigLedger demo!");
}

/* =========================
   PASSWORD VISIBILITY
========================= */

function setupPasswordButtons() {
  document.querySelectorAll("[data-toggle-password]").forEach(button => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.togglePassword);
      if (!input) return;

      const showing = input.type === "password";

      input.type = showing ? "text" : "password";

      button.setAttribute(
        "aria-label",
        showing ? "Hide password" : "Show password"
      );

      button.title = showing ? "Hide password" : "Show password";
    });
  });
}

/* =========================
   NAVIGATION
========================= */

function navigateTo(page) {
  const pages = [
    "overview",
    "transactions",
    "insights",
    "statement"
  ];

  if (!pages.includes(page)) page = "overview";

  document.querySelectorAll(".page").forEach(element => {
    element.classList.remove("active");
  });

  $(page + "Page")?.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  if (page === "transactions") renderTransactions();
  if (page === "insights") renderInsights();
  if (page === "statement") renderStatement();
}

/* =========================
   DASHBOARD
========================= */

function renderDashboard() {
  if (!currentUser) return;

  const monthly = getCurrentMonthEntries();
  const totals = getTotals(monthly);

  $("workerName").textContent = currentUser.name;
  $("headerUser").textContent = currentUser.name;
  $("userInitial").textContent =
    currentUser.name.charAt(0).toUpperCase();

  $("monthLabel").textContent =
    new Date().toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });

  $("totalIncome").textContent = money(totals.income);
  $("totalExpenses").textContent = money(totals.expenses);
  $("netEarnings").textContent = money(totals.net);
  $("entryCount").textContent = totals.count;

  $("heroNet").textContent = money(totals.net);

  renderPlatformTotals(monthly);
  renderIncomeBars(monthly, $("sourceBars"));
  renderExpenseBars(monthly, $("expenseBars"));
  renderRecentTransactions();
  renderInsights();
  renderStatement();
}

function renderPlatformTotals(list) {
  const totals = {};

  INCOME_SOURCES.forEach(source => {
    totals[source] = 0;
  });

  list
    .filter(entry => entry.type === "income")
    .forEach(entry => {
      totals[entry.source] =
        (totals[entry.source] || 0) + safeNumber(entry.amount);
    });

  const mapping = {
    "Swiggy": "srcSwiggy",
    "Zomato": "srcZomato",
    "Uber": "srcUber",
    "Rapido": "srcRapido",
    "Ola": "srcOla",
    "Private rides": "srcPrivate",
    "Freelance work": "srcFreelance",
    "Part-time job": "srcParttime",
    "Other income": "srcOther"
  };

  Object.entries(mapping).forEach(([source, elementId]) => {
    const element = $(elementId);
    if (element) element.textContent = money(totals[source] || 0);
  });
}

/* =========================
   ANALYTICS
========================= */

function renderBarList(container, totals, emptyMessage) {
  if (!container) return;

  const items = Object.entries(totals)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!items.length) {
    container.innerHTML =
      `<div class="empty-state">${escapeHTML(emptyMessage)}</div>`;
    return;
  }

  const max = Math.max(...items.map(item => item[1]));

  container.innerHTML = items.map(([label, amount]) => {
    const percent = Math.max(3, (amount / max) * 100);

    return `
      <div class="bar-row">
        <span class="bar-label">${escapeHTML(label)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${percent}%"></div>
        </div>
        <span class="bar-value">${money(amount)}</span>
      </div>
    `;
  }).join("");
}

function groupTotals(list, type) {
  const totals = {};

  list
    .filter(entry => entry.type === type)
    .forEach(entry => {
      const source = entry.source || "Other";
      totals[source] = (totals[source] || 0) + safeNumber(entry.amount);
    });

  return totals;
}

function renderIncomeBars(list, container) {
  renderBarList(
    container,
    groupTotals(list, "income"),
    "Add income to see your breakdown."
  );
}

function renderExpenseBars(list, container) {
  renderBarList(
    container,
    groupTotals(list, "expense"),
    "Add expenses to see your spending."
  );
}

function renderInsights() {
  if (!currentUser) return;

  const monthly = getCurrentMonthEntries();
  const totals = getTotals(monthly);

  $("insIncome").textContent = money(totals.income);
  $("insExpenses").textContent = money(totals.expenses);
  $("insNet").textContent = money(totals.net);
  $("insCount").textContent = totals.count;

  renderIncomeBars(monthly, $("insightSources"));
  renderExpenseBars(monthly, $("insightExpenses"));
}

/* =========================
   TRANSACTION TABLES
========================= */

function transactionRow(entry, showAction = false) {
  const amount = safeNumber(entry.amount);
  const income = entry.type === "income";

  return `
    <tr>
      <td>${escapeHTML(entry.description)}</td>
      <td>${escapeHTML(entry.source)}</td>
      <td>${formatDate(entry.date)}</td>
      <td>
        <span class="type-pill ${income ? "income" : "expense"}">
          ${income ? "INCOME" : "EXPENSE"}
        </span>
      </td>
      <td class="right ${income ? "positive" : "negative"}">
        ${income ? "+" : "−"}${money(amount)}
      </td>
      ${showAction ? `
        <td>
          <button class="delete-btn" data-delete="${escapeHTML(entry.id)}"
            title="Delete transaction" aria-label="Delete transaction">×</button>
        </td>
      ` : ""}
    </tr>
  `;
}

function renderRecentTransactions() {
  const body = $("recentRows");
  if (!body) return;

  const recent = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  body.innerHTML = recent.length
    ? recent.map(entry => transactionRow(entry)).join("")
    : `<tr><td colspan="5" class="empty-state">No transactions yet. Add your first earning.</td></tr>`;
}

function renderTransactions() {
  const body = $("allRows");
  if (!body) return;

  const search = ($("searchInput")?.value || "").toLowerCase();
  const type = $("typeFilter")?.value || "all";
  const source = $("sourceFilter")?.value || "all";

  const filtered = [...entries]
    .filter(entry => {
      const matchesSearch =
        `${entry.description} ${entry.source} ${entry.notes || ""}`
          .toLowerCase()
          .includes(search);

      const matchesType =
        type === "all" || entry.type === type;

      const matchesSource =
        source === "all" || entry.source === source;

      return matchesSearch && matchesType && matchesSource;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  body.innerHTML = filtered.length
    ? filtered.map(entry => transactionRow(entry, true)).join("")
    : "";

  $("emptyState").hidden = filtered.length > 0;

  populateSourceFilter();
}

function populateSourceFilter() {
  const select = $("sourceFilter");
  if (!select) return;

  const selected = select.value || "all";

  const sources = [...new Set(entries.map(entry => entry.source))]
    .filter(Boolean)
    .sort();

  select.innerHTML =
    `<option value="all">All sources</option>` +
    sources.map(source =>
      `<option value="${escapeHTML(source)}">${escapeHTML(source)}</option>`
    ).join("");

  select.value = sources.includes(selected) ? selected : "all";
}

/* =========================
   ADD TRANSACTION
========================= */

function populateEntrySources(type, selectedSource = "") {
  const select = $("entrySource");
  if (!select) return;

  const options =
    type === "income" ? INCOME_SOURCES : EXPENSE_SOURCES;

  select.innerHTML = options.map(source =>
    `<option value="${escapeHTML(source)}">${escapeHTML(source)}</option>`
  ).join("");

  if (selectedSource && options.includes(selectedSource)) {
    select.value = selectedSource;
  }
}

function updateEntryType() {
  const type = $("entryType").value;

  $("dialogTitle").textContent =
    type === "income" ? "Add income" : "Add expense";

  populateEntrySources(type);
}

function openEntryDialog(source = "", entry = null) {
  if (!currentUser) return;

  editingEntryId = entry ? entry.id : null;

  $("entryForm").reset();

  $("entryType").value = entry?.type || "income";
  $("entryDate").value = entry?.date || todayString();
  $("description").value = entry?.description || "";
  $("amount").value = entry?.amount || "";
  $("notes").value = entry?.notes || "";

  populateEntrySources(
    $("entryType").value,
    entry?.source || source
  );

  $("dialogTitle").textContent = entry
    ? "Edit transaction"
    : $("entryType").value === "income"
      ? "Add income"
      : "Add expense";

  $("entryDialog").showModal();
}

function closeEntryDialog() {
  $("entryDialog").close();
  editingEntryId = null;
}

function saveTransaction(event) {
  event.preventDefault();

  if (!currentUser) return;

  const type = $("entryType").value;
  const amount = safeNumber($("amount").value);
  const description = $("description").value.trim();
  const source = $("entrySource").value;
  const date = $("entryDate").value;
  const notes = $("notes").value.trim();

  if (!description || !source || !date || amount <= 0) {
    showToast("Please complete all required fields.");
    return;
  }

  if (editingEntryId) {
    entries = entries.map(entry =>
      entry.id === editingEntryId
        ? {
            ...entry,
            type,
            amount,
            description,
            source,
            date,
            notes
          }
        : entry
    );
  } else {
    entries.push({
      id: makeId(),
      type,
      amount,
      description,
      source,
      date,
      notes,
      createdAt: new Date().toISOString()
    });
  }

  saveEntries();
  closeEntryDialog();
  renderDashboard();
  renderTransactions();

  showToast(editingEntryId
    ? "Transaction updated."
    : "Transaction saved successfully.");
}

function deleteTransaction(id) {
  const entry = entries.find(item => item.id === id);
  if (!entry) return;

  const confirmed = confirm(
    `Delete "${entry.description}" from your ledger?`
  );

  if (!confirmed) return;

  entries = entries.filter(item => item.id !== id);

  saveEntries();
  renderDashboard();
  renderTransactions();

  showToast("Transaction deleted.");
}

/* =========================
   CSV EXPORT
========================= */

function exportCSV() {
  if (!entries.length) {
    showToast("There are no transactions to export.");
    return;
  }

  const columns = [
    "date",
    "type",
    "description",
    "source",
    "amount",
    "notes"
  ];

  const escapeCSV = value =>
    '"' + String(value ?? "").replace(/"/g, '""') + '"';

  const rows = [
    columns.join(","),
    ...entries.map(entry =>
      columns.map(column => escapeCSV(entry[column])).join(",")
    )
  ];

  const blob = new Blob(
    ["\uFEFF" + rows.join("\r\n")],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "gigledger_transactions.csv";
  link.click();

  URL.revokeObjectURL(url);

  showToast("CSV exported successfully.");
}

/* =========================
   CSV IMPORT
========================= */

function parseCSVLine(line) {
  const result = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"' && line[i + 1] === '"' && insideQuotes) {
      value += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  result.push(value);
  return result;
}

async function importCSV(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!currentUser) {
    showToast("Please log in first.");
    return;
  }

  try {
    const text = await file.text();

    const lines = text.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
      showToast("CSV file has no transaction rows.");
      return;
    }

    const headers = parseCSVLine(lines[0]).map(header =>
      header.trim().toLowerCase().replace(/^\uFEFF/, "")
    );

    const required = ["date", "type", "description", "source", "amount"];

    if (!required.every(header => headers.includes(header))) {
      showToast("CSV needs date, type, description, source and amount columns.");
      return;
    }

    const imported = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });

      const type = row.type.trim().toLowerCase();
      const amount = safeNumber(row.amount);

      if (
        !["income", "expense"].includes(type) ||
        amount <= 0 ||
        !row.description.trim() ||
        !row.source.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.date.trim())
      ) {
        continue;
      }

      imported.push({
        id: makeId(),
        type,
        amount,
        date: row.date.trim(),
        description: row.description.trim(),
        source: row.source.trim(),
        notes: row.notes || ""
      });
    }

    if (!imported.length) {
      showToast("No valid transactions found in the CSV.");
      return;
    }

    entries.push(...imported);

    saveEntries();
    renderDashboard();
    renderTransactions();

    showToast(imported.length + " transactions imported.");

  } catch (error) {
    showToast("Could not import this CSV file.");
  } finally {
    event.target.value = "";
  }
}

/* =========================
   FINANCIAL STATEMENT
========================= */

function renderStatement() {
  if (!currentUser) return;

  const monthly = getCurrentMonthEntries();
  const totals = getTotals(monthly);

  $("statementWorkerName").textContent = currentUser.name;
  $("statementLocation").textContent = currentUser.city || "India";
  $("statementId").textContent = "GigLedger ID: " + currentUser.id;

  $("statementPeriod").textContent =
    new Date().toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });

  $("generatedDate").textContent =
    "Generated on " + formatDate(todayString());

  $("stIncome").textContent = money(totals.income);
  $("stExpenses").textContent = money(totals.expenses);
  $("stNet").textContent = money(totals.net);

  const sourceTotals = groupTotals(monthly, "income");
  const expenseTotals = groupTotals(monthly, "expense");

  function statementLines(totalsMap) {
    const rows = Object.entries(totalsMap)
      .sort((a, b) => b[1] - a[1]);

    if (!rows.length) {
      return `<div class="statement-line"><span>No records</span><b>₹0</b></div>`;
    }

    return rows.map(([source, amount]) => `
      <div class="statement-line">
        <span>${escapeHTML(source)}</span>
        <b>${money(amount)}</b>
      </div>
    `).join("");
  }

  $("statementSources").innerHTML = statementLines(sourceTotals);
  $("statementExpenses").innerHTML = statementLines(expenseTotals);
}

/* =========================
   PRINT STATEMENT
========================= */

function printStatement() {
  renderStatement();
  window.print();
}

/* =========================
   EVENT LISTENERS
========================= */

function setupEventListeners() {
  $("showLogin")?.addEventListener("click", () => {
    switchAuthTab("login");
  });

  $("showRegister")?.addEventListener("click", () => {
    switchAuthTab("register");
  });

  $("loginForm")?.addEventListener("submit", loginAccount);
  $("registerForm")?.addEventListener("submit", registerAccount);

  $("demoLogin")?.addEventListener("click", loginDemo);
  $("logoutBtn")?.addEventListener("click", logout);

  setupPasswordButtons();

  document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.page);
    });
  });

  document.querySelectorAll("[data-goto]").forEach(button => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.goto);
    });
  });

  document.querySelectorAll("[data-source]").forEach(button => {
    button.addEventListener("click", () => {
      openEntryDialog(button.dataset.source);
    });
  });

  $("heroAdd")?.addEventListener("click", () => openEntryDialog());
  $("addIncome")?.addEventListener("click", () => openEntryDialog());
  $("newEntry")?.addEventListener("click", () => openEntryDialog());

  $("closeDialog")?.addEventListener("click", closeEntryDialog);
  $("cancelDialog")?.addEventListener("click", closeEntryDialog);

  $("entryType")?.addEventListener("change", updateEntryType);
  $("entryForm")?.addEventListener("submit", saveTransaction);

  $("searchInput")?.addEventListener("input", renderTransactions);
  $("typeFilter")?.addEventListener("change", renderTransactions);
  $("sourceFilter")?.addEventListener("change", renderTransactions);

  $("exportCsv")?.addEventListener("click", exportCSV);
  $("importCsv")?.addEventListener("change", importCSV);

  $("printStatement")?.addEventListener("click", printStatement);

  $("allRows")?.addEventListener("click", event => {
    const button = event.target.closest("[data-delete]");
    if (button) deleteTransaction(button.dataset.delete);
  });

  $("entryDialog")?.addEventListener("click", event => {
    if (event.target === $("entryDialog")) {
      closeEntryDialog();
    }
  });
}

/* =========================
   SESSION RESTORE
========================= */

function restoreSession() {
  const saved = sessionStorage.getItem(SESSION_KEY);

  if (!saved) {
    showAuth();
    return;
  }

  try {
    const session = JSON.parse(saved);

    if (session.isDemo) {
      currentUser = DEMO_USER;
    } else {
      const user = getUsers().find(item => item.id === session.id);

      if (!user) {
        sessionStorage.removeItem(SESSION_KEY);
        showAuth();
        return;
      }

      currentUser = {
        id: user.id,
        name: user.name,
        city: user.city,
        isDemo: false
      };
    }

    entries = loadEntries(currentUser.id);

    showApplication();
    renderDashboard();
    navigateTo("overview");

  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    showAuth();
  }
}

/* =========================
   START APPLICATION
========================= */

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  restoreSession();
});

/* =========================================================
   GIGLEDGER SMART IMPORT ENGINE
   CSV + PDF TEXT EXTRACTION + SCREENSHOT OCR
========================================================= */

const SmartImport = (() => {
  let extracted = [];
  let processing = false;

  const sourceNames = [
    ...INCOME_SOURCES,
    ...EXPENSE_SOURCES
  ];

  function status(message) {
    const el = $("smartImportStatus");
    if (el) el.textContent = message;
  }

  function progress(value) {
    const bar = $("smartProgressBar");
    const wrapper = $("smartImportProgress");

    if (wrapper) wrapper.hidden = false;
    if (bar) bar.style.width = Math.max(0, Math.min(100, value)) + "%";
  }

  function resetProgress() {
    $("smartImportProgress").hidden = true;
    $("smartProgressBar").style.width = "0%";
  }

  function normalizeAmount(value) {
    if (typeof value === "number") return value;

    const cleaned = String(value || "")
      .replace(/[₹,\s]/g, "")
      .replace(/[^\d.-]/g, "");

    return Number(cleaned);
  }

  function normalizeDate(value) {
    if (!value) return "";

    const input = String(value).trim();

    let match = input.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);

    if (match) {
      return [
        match[1],
        match[2].padStart(2, "0"),
        match[3].padStart(2, "0")
      ].join("-");
    }

    match = input.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);

    if (match) {
      let year = match[3];
      if (year.length === 2) year = "20" + year;

      const day = Number(match[1]);
      const month = Number(match[2]);

      if (day > 12) {
        return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      }

      // Ambiguous dates are treated as DD/MM/YYYY for Indian statements.
      return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    }

    return "";
  }

  function guessSource(description) {
    const text = String(description || "").toLowerCase();

    const patterns = [
      ["Swiggy", ["swiggy"]],
      ["Zomato", ["zomato"]],
      ["Uber", ["uber"]],
      ["Rapido", ["rapido"]],
      ["Ola", ["ola cabs", "ola money", "ola ride"]],
      ["Freelance work", ["freelance", "upwork", "fiverr"]],
      ["Private rides", ["private ride", "ride payment"]],
      ["Part-time job", ["salary", "payroll", "employer"]],
      ["Fuel", ["petrol", "fuel", "hpcl", "bpcl", "iocl"]],
      ["Food", ["restaurant", "food", "canteen"]],
      ["Vehicle maintenance", ["service center", "vehicle service", "repair"]],
      ["Mobile recharge", ["recharge", "mobile bill"]],
      ["Internet", ["broadband", "internet bill"]]
    ];

    for (const [source, keywords] of patterns) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return source;
      }
    }

    return "";
  }

  function guessType(description, credit, debit) {
    const text = String(description || "").toLowerCase();

    if (credit > 0) return "income";
    if (debit > 0) return "expense";

    if (/\b(cr|credit|received|salary|refund|cashback)\b/.test(text)) {
      return "income";
    }

    if (/\b(dr|debit|paid|purchase|withdrawal|payment)\b/.test(text)) {
      return "expense";
    }

    return "income";
  }

  function detectDuplicate(item) {
    return entries.some(existing =>
      existing.date === item.date &&
      existing.type === item.type &&
      Math.abs(Number(existing.amount) - item.amount) < 0.01 &&
      existing.description.toLowerCase() === item.description.toLowerCase()
    );
  }

  function makeTransaction(item) {
    const source = item.source || guessSource(item.description);

    return {
      id: makeId(),
      date: item.date || todayString(),
      description: item.description || "Imported transaction",
      source: source || (
        item.type === "income" ? "Other income" : "Other expense"
      ),
      type: item.type || "income",
      amount: normalizeAmount(item.amount),
      notes: "Imported using GigLedger Smart Import"
    };
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) return [];

    const parseLine = line => {
      const values = [];
      let current = "";
      let quoted = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && line[i + 1] === '"' && quoted) {
          current += '"';
          i++;
        } else if (char === '"') {
          quoted = !quoted;
        } else if (char === "," && !quoted) {
          values.push(current);
          current = "";
        } else {
          current += char;
        }
      }

      values.push(current);
      return values;
    };

    const headers = parseLine(lines[0]).map(value =>
      value.trim().toLowerCase().replace(/^\uFEFF/, "")
    );

    const findIndex = names => headers.findIndex(header =>
      names.includes(header.replace(/[\s_-]/g, ""))
    );

    const dateIndex = findIndex(["date", "transactiondate", "valuedate"]);
    const descriptionIndex = findIndex([
      "description", "narration", "remarks", "particulars", "details"
    ]);
    const amountIndex = findIndex(["amount", "transactionamount"]);
    const creditIndex = findIndex(["credit", "deposit", "paidin"]);
    const debitIndex = findIndex(["debit", "withdrawal", "paidout"]);
    const typeIndex = findIndex(["type", "transactiontype"]);
    const balanceIndex = findIndex(["balance", "closingbalance"]);

    if (dateIndex < 0 || descriptionIndex < 0) {
      throw new Error("CSV must contain date and description columns.");
    }

    if (amountIndex < 0 && creditIndex < 0 && debitIndex < 0) {
      throw new Error("CSV must contain amount, credit or debit columns.");
    }

    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);

      const date = normalizeDate(values[dateIndex]);
      const description = values[descriptionIndex]?.trim() || "";

      let amount = amountIndex >= 0
        ? normalizeAmount(values[amountIndex])
        : 0;

      const credit = creditIndex >= 0
        ? normalizeAmount(values[creditIndex])
        : 0;

      const debit = debitIndex >= 0
        ? normalizeAmount(values[debitIndex])
        : 0;

      if (credit > 0) amount = credit;
      if (debit > 0) amount = debit;

      if (!date || !description || !Number.isFinite(amount) || amount <= 0) {
        continue;
      }

      let type = guessType(description, credit, debit);

      if (typeIndex >= 0) {
        const typeText = String(values[typeIndex] || "").toLowerCase();

        if (/debit|withdraw|dr/.test(typeText)) type = "expense";
        if (/credit|deposit|cr/.test(typeText)) type = "income";
      }

      if (balanceIndex >= 0 && credit === 0 && debit === 0) {
        const balance = normalizeAmount(values[balanceIndex]);

        // Balance alone cannot reliably identify a transaction direction.
        // Keep the description-based suggestion for user review.
      }

      result.push(makeTransaction({
        date,
        description,
        amount,
        type,
        source: guessSource(description)
      }));
    }

    return result;
  }

  
async function readPDF(file) {
  if (!window.pdfjsLib) {
    throw new Error(
      "PDF reader library could not load. Check your internet connection."
    );
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let allText = "";
  let totalTextItems = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const items = content.items
      .filter(item => item.str && item.str.trim())
      .map(item => ({
        text: item.str.trim(),
        x: item.transform[4],
        y: item.transform[5]
      }))
      .sort((a, b) => {
        if (Math.abs(b.y - a.y) > 3) return b.y - a.y;
        return a.x - b.x;
      });

    totalTextItems += items.length;

    const rows = [];

    for (const item of items) {
      let row = rows.find(r => Math.abs(r.y - item.y) <= 3);

      if (!row) {
        row = { y: item.y, items: [] };
        rows.push(row);
      }

      row.items.push(item);
    }

    rows.sort((a, b) => b.y - a.y);

    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      allText += row.items.map(item => item.text).join(" ") + "\n";
    }

    progress(10 + pageNumber / pdf.numPages * 30);
  }

  // Scanned PDFs have no usable text layer.
  if (totalTextItems < 5) {
    if (!window.Tesseract) {
      throw new Error(
        "This appears to be a scanned PDF. OCR library could not load."
      );
    }

    allText = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext("2d");

      await page.render({
        canvasContext: context,
        viewport
      }).promise;

      const result = await Tesseract.recognize(canvas, "eng");

      allText += "\n" + (result.data.text || "") + "\n";

      progress(40 + pageNumber / pdf.numPages * 50);
    }
  }

  if (!allText.trim()) {
    throw new Error(
      "No readable text found. Try a clearer bank statement."
    );
  }

  return allText;
}


  
async function readImage(file, baseProgress, totalFiles, index) {
  if (!window.Tesseract) {
    throw new Error("OCR library could not load.");
  }

  const image = await createImageBitmap(file);

  const width = image.width;
  const height = image.height;

async function recognizeCrop(x, y, w, h, psm = 6, whitelist = "") {
        const canvas = document.createElement("canvas");
    const scale = 3;

    canvas.width = w * scale;
    canvas.height = h * scale;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true
    });

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
      image,
      x, y, w, h,
      0, 0, canvas.width, canvas.height
    );

    const result = await Tesseract.recognize(canvas, "eng", {
  logger: message => {
    if (message.status === "recognizing text") {
      const percent = (message.progress || 0) * 30;
      progress(10 + index / totalFiles * 30 + percent / totalFiles);
    }
  },
  config: {
    tessedit_pageseg_mode: String(psm),
    ...(whitelist ? {
      tessedit_char_whitelist: whitelist
    } : {})
  }
});
    return result.data.text || "";
  }

  try {
    // Read the complete screenshot.
    const fullText = await recognizeCrop(
      0, 0, width, height, 11
    );

    // Read the green header separately for the transaction date.
    const headerText = await recognizeCrop(
      0, 0, width, Math.floor(height * 0.14), 6
    );

    // Read the recipient and amount area separately.
    const paymentText = await recognizeCrop(
      0,
      Math.floor(height * 0.12),
      width,
      Math.floor(height * 0.23),
      6
    );
    // Read only the amount displayed on the right side.
    const amountText = await recognizeCrop(
    Math.floor(width * 0.72),
    Math.floor(height * 0.17),
    Math.floor(width * 0.25),
    Math.floor(height * 0.10),
    7,
    "0123456789,."
);

    return [
  headerText,
  paymentText,
  "PHONEPE_AMOUNT:" + amountText,
  fullText
].join("\n");
  } finally {
    image.close();
  }
}

  

function parseTextTransactions(text) {
  const result = [];

  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  // Convert dates such as "21 Nov 2026".
  function parseFlexibleDate(value) {
    const numericDate = normalizeDate(value);
    if (numericDate) return numericDate;

    const match = String(value).match(
      /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/
    );

    if (!match) return "";

    const months = [
      "jan", "feb", "mar", "apr", "may", "jun",
      "jul", "aug", "sep", "oct", "nov", "dec"
    ];

    const month = months.indexOf(match[2].slice(0, 3).toLowerCase());
    const day = Number(match[1]);
    const year = Number(match[3]);

    if (month < 0 || day < 1 || day > 31) return "";

    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // PHONEPE / PAYMENT SUCCESS SCREENSHOT DETECTION
  const fullText = lines.join("\n");

  if (
    /transaction successful|paid to/i.test(fullText) &&
    /debited from/i.test(fullText)
  ) {
    const dateMatch = fullText.match(
      /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/
    );

    const date = dateMatch
      ? parseFlexibleDate(dateMatch[0])
      : "";

    // Get the recipient section between "Paid to" and "Banking Name".
    const paidIndex = lines.findIndex(line => /paid to/i.test(line));
    const bankIndex = lines.findIndex(line => /banking name/i.test(line));

    const recipientLines = paidIndex >= 0
      ? lines.slice(
          paidIndex + 1,
          bankIndex > paidIndex ? bankIndex : paidIndex + 5
        )
      : [];

    // Extract the amount from the recipient section.
    const amountPattern =
      /(?:₹|INR|%|\s)(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/g;

    const amountCandidates = [];

    for (const line of recipientLines) {
      for (const match of line.matchAll(amountPattern)) {
        const value = normalizeAmount(match[1]);

        if (Number.isFinite(value) && value > 0) {
          amountCandidates.push(value);
        }
      }
    }

    // Prefer the first amount beside the recipient's name.
    // Prefer the separately OCR-read amount from the screenshot.
const dedicatedAmountMatch = text.match(
  /PHONEPE_AMOUNT:\s*([0-9,]+(?:\.\d{1,2})?)/i
);

const dedicatedAmount = dedicatedAmountMatch
  ? normalizeAmount(dedicatedAmountMatch[1])
  : 0;

const amount = dedicatedAmount > 0
  ? dedicatedAmount
  : amountCandidates[0];

    // Remove OCR-detected amounts from the recipient name.
    let recipient = recipientLines
      .join(" ")
      .replace(/(?:₹|INR|%|\s)\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?/gi, " ")
      .replace(/\s+/g, " ")
      .replace(/[^a-zA-Z\s.-]/g, "")
      .trim();

    if (!recipient || /banking name|transfer details/i.test(recipient)) {
      recipient = "Unknown recipient";
    }

    if (date && amount > 0) {
      result.push(makeTransaction({
        date,
        description: "PhonePe payment to " + recipient,
        amount,
        type: "expense",
        source: "Other expense"
      }));

      return result;
    }
  }

  // STANDARD BANK STATEMENT TRANSACTION PARSING
  const datePattern =
    /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/;

  for (const line of lines) {
    if (/opening balance|closing balance|available balance|statement summary/i.test(line)) {
      continue;
    }

    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const date = normalizeDate(dateMatch[1]);
    if (!date) continue;

    const remainder = line.replace(dateMatch[0], " ");

    const amounts = [
      ...remainder.matchAll(
        /(?:₹|INR\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi
      )
    ].map(match => ({
      value: normalizeAmount(match[1]),
      raw: match[0]
    })).filter(item =>
      Number.isFinite(item.value) && item.value > 0
    );

    if (!amounts.length) continue;

    const transactionAmount = amounts.length >= 2
      ? amounts[amounts.length - 2]
      : amounts[0];

    const description = remainder
      .replace(transactionAmount.raw, " ")
      .replace(/\b(cr|dr|credit|debit)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || "Bank transaction";

    const upper = line.toUpperCase();

    let type = "expense";

    if (/\b(CR|CREDIT|DEPOSIT)\b/.test(upper)) {
      type = "income";
    } else if (/\b(DR|DEBIT|WITHDRAWAL)\b/.test(upper)) {
      type = "expense";
    } else if (/received|credited|salary|refund/i.test(line)) {
      type = "income";
    } else if (/paid|debited|purchase|withdrawn/i.test(line)) {
      type = "expense";
    }

    result.push(makeTransaction({
      date,
      description,
      amount: transactionAmount.value,
      type,
      source: guessSource(description)
    }));
  }

  return result;
}



  function renderReview() {
    const tbody = $("smartImportRows");

    $("smartImportResults").hidden = false;
    $("smartResultCount").textContent =
      extracted.length + " records";

    tbody.innerHTML = extracted.map((item, index) => {
      const duplicate = detectDuplicate(item);

      return `
        <tr class="${duplicate ? "smart-duplicate" : ""}">
          <td>
            <input class="smart-checkbox" type="checkbox"
              data-field="selected" data-index="${index}"
              ${duplicate ? "" : "checked"}>
          </td>

          <td>
            <input type="date" data-field="date"
              data-index="${index}"
              value="${escapeHTML(item.date)}">
          </td>

          <td>
            <input class="smart-description" type="text"
              data-field="description" data-index="${index}"
              value="${escapeHTML(item.description)}">
            ${duplicate ? '<span class="smart-confidence">Possible duplicate</span>' : ""}
          </td>

          <td>
            <select data-field="source" data-index="${index}">
              ${sourceNames.map(source => `
                <option value="${escapeHTML(source)}"
                  ${source === item.source ? "selected" : ""}>
                  ${escapeHTML(source)}
                </option>
              `).join("")}
            </select>
          </td>

          <td>
            <select data-field="type" data-index="${index}">
              <option value="income" ${item.type === "income" ? "selected" : ""}>Income</option>
              <option value="expense" ${item.type === "expense" ? "selected" : ""}>Expense</option>
            </select>
          </td>

          <td>
            <input class="smart-amount" type="number" min="0.01" step="0.01"
              data-field="amount" data-index="${index}"
              value="${Number(item.amount)}">
          </td>
        </tr>
      `;
    }).join("");
  }

  function updateReviewValue(event) {
    const field = event.target.dataset.field;
    const index = Number(event.target.dataset.index);

    if (!field || !Number.isInteger(index) || !extracted[index]) return;

    if (field === "selected") {
      extracted[index].selected = event.target.checked;
      return;
    }

    extracted[index][field] = event.target.value;
  }

  function confirmImport() {
    if (!currentUser) {
      showToast("Please log in before importing transactions.");
      return;
    }

    const rows = $("smartImportRows").querySelectorAll("[data-field]");

    rows.forEach(input => {
      const field = input.dataset.field;
      const index = Number(input.dataset.index);

      if (!extracted[index]) return;

      if (field === "selected") {
        extracted[index].selected = input.checked;
      } else {
        extracted[index][field] = input.value;
      }
    });

    const selected = extracted.filter(item => item.selected !== false);

    if (!selected.length) {
      showToast("Select at least one transaction.");
      return;
    }

    const valid = selected.filter(item =>
      /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      item.description.trim() &&
      Number(item.amount) > 0 &&
      ["income", "expense"].includes(item.type)
    );

    if (!valid.length) {
      showToast("No valid transactions to import.");
      return;
    }

    const newEntries = valid
      .filter(item => !detectDuplicate(item))
      .map(item => ({
        ...makeTransaction(item),
        notes: "Imported using GigLedger Smart Import"
      }));

    if (!newEntries.length) {
      showToast("All selected transactions already appear to exist.");
      return;
    }

    entries.push(...newEntries);
    saveEntries();
    renderDashboard();
    renderTransactions();

    $("smartImportDialog").close();

    showToast(newEntries.length + " transactions added to your ledger.");

    extracted = [];
  }

  async function processFiles(files, mode) {
    if (processing) return;

    if (!currentUser) {
      showToast("Please log in first.");
      return;
    }

    processing = true;
    extracted = [];

    $("smartImportResults").hidden = true;
    status("Reading your uploaded files...");
    progress(5);

    try {
      const found = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        status(`Processing ${i + 1} of ${files.length}: ${file.name}`);

        let text = "";

        if (mode === "statement") {
          if (file.name.toLowerCase().endsWith(".csv")) {
            const csvText = await file.text();
            found.push(...parseCSV(csvText));
            continue;
          }

          if (file.type === "application/pdf" ||
              file.name.toLowerCase().endsWith(".pdf")) {
            text = await readPDF(file);
          } else {
            throw new Error("Unsupported statement format.");
          }
        } else {
          text = await readImage(file, 0, files.length, i);
        }

        found.push(...parseTextTransactions(text));
      }

      extracted = found.map(item => ({
        ...item,
        selected: !detectDuplicate(item)
      }));

      progress(100);

      if (!extracted.length) {
        status(
          "No transactions could be identified. Try a clearer screenshot or a CSV bank statement with date, description and amount columns."
        );
        return;
      }

      status(
        "Reading completed. Review the suggested transactions below and correct any details before importing."
      );

      renderReview();

    } catch (error) {
      status("Import error: " + (error.message || "Could not read this file."));
    } finally {
      processing = false;
      setTimeout(resetProgress, 800);
    }
  }

  function open() {
    if (!currentUser) {
      showToast("Please log in first.");
      return;
    }

    extracted = [];
    $("smartImportResults").hidden = true;
    $("statementUpload").value = "";
    $("screenshotUpload").value = "";
    status("Choose a bank statement or payment screenshot.");
    $("smartImportDialog").showModal();
  }

  function close() {
    $("smartImportDialog").close();
  }

  function setup() {
    $("openSmartImport")?.addEventListener("click", open);
    $("closeSmartImport")?.addEventListener("click", close);
    $("cancelSmartImport")?.addEventListener("click", close);

    $("statementUpload")?.addEventListener("change", event => {
      const files = [...(event.target.files || [])];
      if (files.length) processFiles(files, "statement");
    });

    $("screenshotUpload")?.addEventListener("change", event => {
      const files = [...(event.target.files || [])];
      if (files.length) processFiles(files, "screenshot");
    });

    $("smartImportRows")?.addEventListener("change", updateReviewValue);

    $("confirmSmartImport")?.addEventListener("click", confirmImport);

    $("smartImportDialog")?.addEventListener("click", event => {
      if (event.target === $("smartImportDialog")) close();
    });
  }

  return { setup, open };
})();

document.addEventListener("DOMContentLoaded", () => {
  SmartImport.setup();
});

/* GIGLEDGER — MOUSE FOLLOW GLOW + LIQUID WAVE */

document.addEventListener("DOMContentLoaded", () => {
  const hero = document.querySelector(".hero");
  if (!hero || hero.dataset.atmosphereReady) return;

  hero.dataset.atmosphereReady = "true";
  hero.classList.add("hero-atmosphere");

  const glow = document.createElement("div");
  glow.className = "hero-cursor-glow";
  glow.setAttribute("aria-hidden", "true");

  const wave = document.createElement("div");
  wave.className = "hero-liquid-wave";
  wave.setAttribute("aria-hidden", "true");

  hero.prepend(glow);
  hero.append(wave);

  function moveGlow(x, y) {
    const rect = hero.getBoundingClientRect();

    hero.style.setProperty(
      "--hero-pointer-x",
      `${x - rect.left}px`
    );

    hero.style.setProperty(
      "--hero-pointer-y",
      `${y - rect.top}px`
    );

    hero.classList.add("hero-pointer-active");
  }

  hero.addEventListener("pointermove", event => {
    if (event.pointerType === "touch") return;
    moveGlow(event.clientX, event.clientY);
  });

  hero.addEventListener("pointerleave", () => {
    hero.classList.remove("hero-pointer-active");
  });

  hero.addEventListener("touchstart", event => {
    const touch = event.touches[0];
    if (touch) moveGlow(touch.clientX, touch.clientY);
  }, { passive: true });

  hero.addEventListener("touchend", () => {
    hero.classList.remove("hero-pointer-active");
  });

  let ticking = false;

  function updateWave() {
    if (ticking) return;

    ticking = true;

    requestAnimationFrame(() => {
      const rect = hero.getBoundingClientRect();
      const progress = Math.max(
        -1,
        Math.min(
          1,
          (window.innerHeight * 0.5 - rect.top) /
          (window.innerHeight + rect.height)
        )
      );

      hero.style.setProperty(
        "--hero-scroll-shift",
        `${progress * 18}px`
      );

      ticking = false;
    });
  }

  window.addEventListener("scroll", updateWave, { passive: true });
  window.addEventListener("resize", updateWave);
  updateWave();
});

