
"use strict";

/* =====================================
   GIGLEDGER APPLICATION
   Browser-based demonstration version
===================================== */

const $ = id => document.getElementById(id);

const USERS_KEY = "gigledger_users_v2";
const SESSION_KEY = "gigledger_session_v2";

const today = new Date().toLocaleDateString("en-CA");

const currentMonth = today.slice(0,7);

const money = value => new Intl.NumberFormat("en-IN",{
  style:"currency",
  currency:"INR",
  maximumFractionDigits:0
}).format(value || 0);

const incomeSources = [
  "Swiggy","Zomato","Uber","Rapido","Ola",
  "Private rides","Freelance work","Part-time job",
  "Tips / Bonus","Other income"
];

const expenseSources = [
  "Fuel","Vehicle maintenance","Food & water",
  "Mobile / Internet","Parking / toll","Other expense"
];

let currentUser = null;
let entries = [];
let selectedMonth = currentMonth;

/* =====================================
   STORAGE
===================================== */

function getUsers(){
  return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
}

function setUsers(users){
  localStorage.setItem(USERS_KEY,JSON.stringify(users));
}

function dataKey(){
  if(!currentUser) throw new Error("No active account.");
  return "gigledger_data_" + currentUser.id;
}

function loadEntries(){
  const data = localStorage.getItem(dataKey());
  entries = data ? JSON.parse(data) : [];
}

function save(){
  if(!currentUser) return;
  localStorage.setItem(dataKey(),JSON.stringify(entries));
  render();
}

function esc(value){
  return String(value).replace(/[&<>"']/g,c=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

/* =====================================
   PASSWORD HASHING
===================================== */

function randomSalt(){
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}

function hexToBytes(hex){
  return new Uint8Array(
    hex.match(/.{2}/g).map(x=>parseInt(x,16))
  );
}

async function hashPassword(password,salt){
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits({
    name:"PBKDF2",
    salt:hexToBytes(salt),
    iterations:150000,
    hash:"SHA-256"
  },key,256);

  return Array.from(new Uint8Array(bits),
    b=>b.toString(16).padStart(2,"0")
  ).join("");
}

function secureContextAvailable(){
  return window.isSecureContext &&
    !!window.crypto?.subtle;
}

/* =====================================
   AUTH SCREEN
===================================== */

function showAuth(mode){
  const login = mode==="login";

  $("loginForm").hidden = !login;
  $("registerForm").hidden = login;

  $("showLogin").classList.toggle("active",login);
  $("showRegister").classList.toggle("active",!login);

  $("loginError").textContent="";
  $("registerError").textContent="";
}

$("showLogin").onclick=()=>showAuth("login");
$("showRegister").onclick=()=>showAuth("register");

/* =====================================
   REGISTRATION
===================================== */

$("registerForm").onsubmit=async e=>{
  e.preventDefault();

  const name=$("registerName").value.trim();
  const id=$("registerId").value.trim().toLowerCase();
  const city=$("registerCity").value.trim();
  const password=$("registerPassword").value;
  const confirm=$("confirmPassword").value;

  const error=$("registerError");
  error.textContent="";

  if(!secureContextAvailable()){
    error.textContent="Secure password hashing is unavailable. Open this application through localhost or HTTPS.";
    return;
  }

  if(!name||!city){
    error.textContent="Please complete all fields.";
    return;
  }

  if(!/^[a-z0-9_]{4,24}$/.test(id)){
    error.textContent="ID must contain 4–24 letters, numbers or underscores.";
    return;
  }

  if(password.length<8){
    error.textContent="Password must contain at least 8 characters.";
    return;
  }

  if(password!==confirm){
    error.textContent="Passwords do not match.";
    return;
  }

  const users=getUsers();

  if(users.some(user=>user.id===id)){
    error.textContent="This GigLedger ID is already taken.";
    return;
  }

  const button=$("registerForm").querySelector('button[type="submit"]');
  button.disabled=true;
  button.textContent="Creating account...";

  try{
    const salt=randomSalt();
    const passwordHash=await hashPassword(password,salt);

    const user={
      id,
      name,
      city,
      salt,
      passwordHash,
      createdAt:new Date().toISOString()
    };

    users.push(user);
    setUsers(users);

    activateUser(user);

    $("registerForm").reset();
  }catch(error){
    $("registerError").textContent="Account creation failed. Please try again.";
  }finally{
    button.disabled=false;
    button.textContent="Create my GigLedger ID →";
  }
};

/* =====================================
   LOGIN
===================================== */

$("loginForm").onsubmit=async e=>{
  e.preventDefault();

  const id=$("loginId").value.trim().toLowerCase();
  const password=$("loginPassword").value;
  const error=$("loginError");

  error.textContent="";

  if(!secureContextAvailable()){
    error.textContent="Secure password verification is unavailable. Use localhost or HTTPS.";
    return;
  }

  const user=getUsers().find(x=>x.id===id);

  if(!user){
    error.textContent="Incorrect GigLedger ID or password.";
    return;
  }

  try{
    const attempt=await hashPassword(password,user.salt);

    if(attempt!==user.passwordHash){
      error.textContent="Incorrect GigLedger ID or password.";
      return;
    }

    activateUser(user);
    $("loginForm").reset();

  }catch(err){
    error.textContent="Login failed. Please try again.";
  }
};

/* =====================================
   ACTIVATE ACCOUNT
===================================== */

function activateUser(user){
  currentUser=user;

  sessionStorage.setItem(SESSION_KEY,user.id);

  loadEntries();

  $("authScreen").hidden=true;
  $("appScreen").hidden=false;

  $("workerName").textContent=user.name.split(" ")[0];
  $("headerUser").textContent=user.id;
  $("userInitial").textContent=user.name.charAt(0).toUpperCase();

  $("statementWorkerName").textContent=user.name;
  $("statementLocation").textContent=user.city+", India";
  $("statementId").textContent="GigLedger ID: "+user.id;

  render();

  showPage("overview");

  showToast("Welcome to GigLedger, "+user.name+"!");
}

/* =====================================
   LOGOUT
===================================== */

$("logoutBtn").onclick=()=>{
  if(!confirm("Are you sure you want to log out?")) return;

  sessionStorage.removeItem(SESSION_KEY);

  currentUser=null;
  entries=[];

  $("appScreen").hidden=true;
  $("authScreen").hidden=false;

  showAuth("login");
  showToast("You have logged out.");
};

/* =====================================
   SESSION RESTORE
===================================== */

function initialize(){
  const id=sessionStorage.getItem(SESSION_KEY);

  if(!id){
    $("authScreen").hidden=false;
    $("appScreen").hidden=true;
    showAuth("login");
    return;
  }

  const user=getUsers().find(x=>x.id===id);

  if(!user){
    sessionStorage.removeItem(SESSION_KEY);
    $("authScreen").hidden=false;
    $("appScreen").hidden=true;
    showAuth("login");
    return;
  }

  activateUser(user);
}

/* =====================================
   PAGE NAVIGATION
===================================== */

function showPage(page){
  document.querySelectorAll(".page").forEach(el=>{
    el.classList.toggle("active",el.id===page+"Page");
  });

  document.querySelectorAll(".nav-link").forEach(el=>{
    el.classList.toggle("active",el.dataset.page===page);
  });

  window.scrollTo({top:0,behavior:"smooth"});
}

document.querySelectorAll(".nav-link").forEach(btn=>{
  btn.onclick=()=>showPage(btn.dataset.page);
});

document.querySelectorAll("[data-goto]").forEach(btn=>{
  btn.onclick=()=>showPage(btn.dataset.goto);
});

/* =====================================
   DATE AND CALCULATIONS
===================================== */

function monthEntries(){
  return entries.filter(x=>x.date.slice(0,7)===selectedMonth);
}

function totals(){
  const data=monthEntries();

  const income=data
    .filter(x=>x.type==="income")
    .reduce((a,x)=>a+x.amount,0);

  const expenses=data
    .filter(x=>x.type==="expense")
    .reduce((a,x)=>a+x.amount,0);

  return {
    income,
    expenses,
    net:income-expenses,
    count:data.length
  };
}

function sourceTotals(type){
  const result={};

  monthEntries()
    .filter(x=>x.type===type)
    .forEach(x=>{
      result[x.source]=(result[x.source]||0)+x.amount;
    });

  return Object.entries(result)
    .sort((a,b)=>b[1]-a[1]);
}

/* =====================================
   CHARTS
===================================== */

function renderBars(target,type){
  const data=sourceTotals(type);
  const max=Math.max(1,...data.map(x=>x[1]));

  $(target).innerHTML=data.length
    ?data.map(([name,value])=>`
      <div class="bar-row">
        <span class="bar-label">${esc(name)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${value/max*100}%"></div>
        </div>
        <span class="bar-value">${money(value)}</span>
      </div>
    `).join("")
    :'<div class="empty-state">No records for this month.</div>';
}

/* =====================================
   PLATFORM TOTALS
===================================== */

function renderPlatforms(){
  const map=Object.fromEntries(sourceTotals("income"));

  const ids={
    "Swiggy":"srcSwiggy",
    "Zomato":"srcZomato",
    "Uber":"srcUber",
    "Rapido":"srcRapido",
    "Ola":"srcOla",
    "Private rides":"srcPrivate",
    "Freelance work":"srcFreelance",
    "Part-time job":"srcParttime",
    "Other income":"srcOther"
  };

  Object.entries(ids).forEach(([source,id])=>{
    $(id).textContent=money(map[source]||0);
  });

}

/* =====================================
   TRANSACTION TABLE
===================================== */

function transactionRow(x,includeAction=false){
  return `
    <tr>
      <td>${esc(x.description)}</td>
      <td>${esc(x.source)}</td>
      <td>${esc(x.date)}</td>
      <td><span class="type-pill ${x.type}">${x.type}</span></td>
      <td class="right ${x.type==="income"?"positive":"negative"}">
        ${x.type==="income"?"+":"−"}${money(x.amount)}
      </td>
      ${includeAction?`
        <td><button class="delete-btn" data-delete="${esc(x.id)}">×</button></td>
      `:""}
    </tr>
  `;
}

function renderTransactions(){
  const search=$("searchInput").value.toLowerCase();
  const type=$("typeFilter").value;
  const source=$("sourceFilter").value;

  const data=monthEntries()
    .filter(x=>
      (type==="all"||x.type===type)&&
      (source==="all"||x.source===source)&&
      (x.description+" "+x.source).toLowerCase().includes(search)
    )
    .sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);

  $("allRows").innerHTML=data.map(x=>transactionRow(x,true)).join("");
  $("emptyState").hidden=data.length>0;
}

/* =====================================
   STATEMENT
===================================== */

function renderStatement(t){
  $("stIncome").textContent=money(t.income);
  $("stExpenses").textContent=money(t.expenses);
  $("stNet").textContent=money(t.net);

  $("statementPeriod").textContent=
    new Date(selectedMonth+"-01T00:00:00")
      .toLocaleDateString("en-IN",{month:"long",year:"numeric"});

  $("generatedDate").textContent=
    "Generated "+new Date().toLocaleDateString("en-IN");

  $("statementSources").innerHTML=
    sourceTotals("income").map(([name,value])=>`
      <div class="statement-line">
        <span>${esc(name)}</span><b>${money(value)}</b>
      </div>
    `).join("")||"<p>No income recorded.</p>";

  $("statementExpenses").innerHTML=
    sourceTotals("expense").map(([name,value])=>`
      <div class="statement-line">
        <span>${esc(name)}</span><b>${money(value)}</b>
      </div>
    `).join("")||"<p>No expenses recorded.</p>";
}

/* =====================================
   DASHBOARD RENDER
===================================== */

function render(){
  if(!currentUser)return;

  const t=totals();

  $("workerName").textContent=currentUser.name.split(" ")[0];
  $("headerUser").textContent=currentUser.id;
  $("userInitial").textContent=currentUser.name.charAt(0).toUpperCase();

  $("totalIncome").textContent=money(t.income);
  $("totalExpenses").textContent=money(t.expenses);
  $("netEarnings").textContent=money(t.net);
  $("entryCount").textContent=t.count;
  $("heroNet").textContent=money(t.net);

  $("insIncome").textContent=money(t.income);
  $("insExpenses").textContent=money(t.expenses);
  $("insNet").textContent=money(t.net);
  $("insCount").textContent=t.count;

  $("monthLabel").textContent=
    new Date(selectedMonth+"-01T00:00:00")
      .toLocaleDateString("en-IN",{month:"long",year:"numeric"});

  const sorted=monthEntries().sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);

  $("recentRows").innerHTML=sorted.slice(0,5)
    .map(x=>transactionRow(x)).join("")||
    '<tr><td colspan="5">No transactions recorded.</td></tr>';

  renderPlatforms();
  renderBars("sourceBars","income");
  renderBars("expenseBars","expense");
  renderBars("insightSources","income");
  renderBars("insightExpenses","expense");
  renderTransactions();
  renderStatement(t);
}

/* =====================================
   ADD ENTRY MODAL
===================================== */

function setSourceOptions(type,preferred=""){
  const list=type==="income"?incomeSources:expenseSources;

  $("entrySource").innerHTML=list.map(s=>
    `<option value="${esc(s)}">${esc(s)}</option>`
  ).join("");

  if(preferred&&list.includes(preferred)){
    $("entrySource").value=preferred;
  }
}

function openDialog(type="income",source=""){
  $("entryType").value=type;
  setSourceOptions(type,source);

  $("dialogTitle").textContent=type==="income"?"Add income":"Add expense";

  $("entryDate").value=today;
  $("description").value="";
  $("amount").value="";
  $("notes").value="";

  $("entryDialog").showModal();
}

$("heroAdd").onclick=()=>openDialog("income");
$("addIncome").onclick=()=>openDialog("income");
$("newEntry").onclick=()=>openDialog();

document.querySelectorAll(".platform-card").forEach(card=>{
  card.onclick=()=>openDialog("income",card.dataset.source);
});

$("entryType").onchange=e=>{
  setSourceOptions(e.target.value);
  $("dialogTitle").textContent=e.target.value==="income"?"Add income":"Add expense";
};

$("closeDialog").onclick=()=>$("entryDialog").close();
$("cancelDialog").onclick=()=>$("entryDialog").close();

/* =====================================
   SAVE ENTRY
===================================== */

$("entryForm").onsubmit=e=>{
  e.preventDefault();

  const amount=Number($("amount").value);
  const description=$("description").value.trim();
  const date=$("entryDate").value;

  if(!Number.isFinite(amount)||amount<=0||!description||!date){
    showToast("Please enter valid transaction details.");
    return;
  }

  if(date>today){
    showToast("Future-dated entries are not allowed in this demo.");
    return;
  }

  entries.push({
    id:Date.now(),
    type:$("entryType").value,
    description,
    source:$("entrySource").value,
    date,
    amount,
    notes:$("notes").value.trim()
  });

  save();
  $("entryDialog").close();
  showToast("Transaction saved successfully.");
};

/* =====================================
   DELETE ENTRY
===================================== */

$("allRows").onclick=e=>{
  const id=e.target.dataset.delete;
  if(!id)return;

  if(confirm("Delete this transaction?")){
    entries=entries.filter(x=>String(x.id)!==id);
    save();
    showToast("Transaction deleted.");
  }
};

/* =====================================
   SEARCH AND FILTER
===================================== */

$("searchInput").oninput=renderTransactions;
$("typeFilter").onchange=renderTransactions;
$("sourceFilter").onchange=renderTransactions;

/* =====================================
   CSV EXPORT
===================================== */

function downloadFile(name,content,type){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

$("exportCsv").onclick=()=>{
  const data=[
    ["type","description","source","date","amount","notes"],
    ...entries.map(x=>[
      x.type,x.description,x.source,x.date,x.amount,x.notes||""
    ])
  ];

  const csv=data.map(row=>row.map(value=>
    '"'+String(value).replace(/"/g,'""')+'"'
  ).join(",")).join("\r\n");

  downloadFile("gigledger-transactions.csv",csv,"text/csv;charset=utf-8");
  showToast("CSV exported.");
};

/* =====================================
   CSV IMPORT
===================================== */

function parseCSV(text){
  const rows=[];
  let row=[],field="",quoted=false;

  for(let i=0;i<text.length;i++){
    const c=text[i];

    if(c==='"'&&quoted&&text[i+1]==='"'){
      field+='"';
      i++;
    }else if(c==='"'){
      quoted=!quoted;
    }else if(c===","&&!quoted){
      row.push(field);
      field="";
    }else if((c==="\n"||c==="\r")&&!quoted){
      if(c==="\r"&&text[i+1]==="\n")i++;
      row.push(field);
      if(row.some(v=>v.trim()))rows.push(row);
      row=[];
      field="";
    }else{
      field+=c;
    }
  }

  row.push(field);
  if(row.some(v=>v.trim()))rows.push(row);
  return rows;
}

$("importCsv").onchange=async e=>{
  const file=e.target.files[0];
  if(!file)return;

  try{
    const rows=parseCSV(await file.text());
    if(rows.length<2)throw new Error("No transaction rows found.");

    const headers=rows[0].map(x=>x.trim().toLowerCase());
    let added=0;

    for(const values of rows.slice(1)){
      const r={};
      headers.forEach((h,i)=>r[h]=(values[i]||"").trim());

      const amount=Number(r.amount);
      const date=r.date||today;

      if(!["income","expense"].includes(r.type))continue;
      if(!r.description||!r.source||!Number.isFinite(amount)||amount<=0)continue;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
      if(date>today)continue;

      entries.push({
        id:Date.now()+Math.random(),
        type:r.type,
        description:r.description,
        source:r.source,
        date,
        amount,
        notes:r.notes||""
      });
      added++;
    }

    save();
    showToast(added+" transactions imported.");
  }catch(err){
    showToast("CSV import failed: "+err.message);
  }

  e.target.value="";
};

/* =====================================
   PRINT STATEMENT
===================================== */

$("printStatement").onclick=()=>window.print();

/* =====================================
   TOAST
===================================== */

function showToast(message){
  $("toast").textContent=message;
  $("toast").classList.add("show");

  setTimeout(()=>$("toast").classList.remove("show"),2500);
}

/* =====================================
   FILTER INITIALIZATION
===================================== */

$("sourceFilter").innerHTML=
  '<option value="all">All sources</option>'+
  [...new Set([...incomeSources,...expenseSources])]
    .map(s=>`<option value="${esc(s)}">${esc(s)}</option>`)
    .join("");

/* =====================================
   APPLICATION START
===================================== */

initialize();
