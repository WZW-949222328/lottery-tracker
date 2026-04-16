const API_BASE = window.location.origin.includes("localhost")
  ? "http://127.0.0.1:8000"
  : "";

const form = document.getElementById("recordForm");
const recordDate = document.getElementById("recordDate");
const projectInputs = document.getElementById("projectInputs");
const formMsg = document.getElementById("formMsg");
const recordsHead = document.getElementById("recordsHead");
const recordsBody = document.getElementById("recordsBody");

let config = null;

function projectInputBlock(name, target) {
  return `
    <div class="card">
      <h3>${name}</h3>
      <label>当日投入
        <input type="number" min="0" step="0.01" required data-project="${name}" data-field="cost" />
      </label>
      <label>当日奖金
        <input type="number" min="0" step="0.01" required data-project="${name}" data-field="bonus" />
      </label>
      <small>每日目标盈利：${target}</small>
    </div>
  `;
}

function moneyClass(value) {
  return Number(value) >= 0 ? "profit-positive" : "profit-negative";
}

function formatMoney(value) {
  return Number(value).toFixed(2);
}

async function getConfig() {
  const res = await fetch(`${API_BASE}/api/config`);
  return res.json();
}

async function getRecords() {
  const res = await fetch(`${API_BASE}/api/records`);
  return res.json();
}

async function saveRecord(payload) {
  const res = await fetch(`${API_BASE}/api/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("保存失败，请检查输入");
  }
  return res.json();
}

function renderForm(cfg) {
  const html = cfg.projects
    .map((name) => projectInputBlock(name, cfg.daily_targets[name]))
    .join("");
  projectInputs.innerHTML = html;
}

function renderTable(records) {
  const projects = config.projects;
  recordsHead.innerHTML = `
    <tr>
      <th>日期</th>
      ${projects
        .map(
          (p) => `
            <th>${p}-投入</th>
            <th>${p}-奖金</th>
            <th>${p}-目标盈利</th>
            <th>${p}-明日需盈利</th>
            <th>${p}-当日总盈利</th>
          `
        )
        .join("")}
      <th>当日总盈利</th>
      <th>累计总盈利</th>
    </tr>
  `;

  recordsBody.innerHTML = records
    .map((r) => {
      const cols = projects
        .map((p) => {
          const v = r.projects[p];
          return `
            <td>${formatMoney(v.cost)}</td>
            <td>${formatMoney(v.bonus)}</td>
            <td>${formatMoney(v.daily_target_profit)}</td>
            <td>${formatMoney(v.tomorrow_required_profit)}</td>
            <td class="${moneyClass(v.daily_total_profit)}">${formatMoney(v.daily_total_profit)}</td>
          `;
        })
        .join("");

      return `
        <tr>
          <td>${r.record_date}</td>
          ${cols}
          <td class="${moneyClass(r.day_profit)}">${formatMoney(r.day_profit)}</td>
          <td class="${moneyClass(r.all_total_profit)}">${formatMoney(r.all_total_profit)}</td>
        </tr>
      `;
    })
    .join("");
}

function collectProjects() {
  const projects = {};
  for (const name of config.projects) {
    const costInput = document.querySelector(`[data-project="${name}"][data-field="cost"]`);
    const bonusInput = document.querySelector(`[data-project="${name}"][data-field="bonus"]`);
    projects[name] = {
      cost: Number(costInput.value || 0),
      bonus: Number(bonusInput.value || 0),
    };
  }
  return projects;
}

async function refreshTable() {
  const payload = await getRecords();
  renderTable(payload.records);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMsg.textContent = "";
  try {
    await saveRecord({
      record_date: recordDate.value,
      projects: collectProjects(),
    });
    formMsg.textContent = "保存成功";
    await refreshTable();
  } catch (err) {
    formMsg.textContent = err.message;
  }
});

async function boot() {
  config = await getConfig();
  renderForm(config);
  recordDate.value = new Date().toISOString().slice(0, 10);
  await refreshTable();
}

boot();
