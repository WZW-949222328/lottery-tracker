// const API_BASE = window.location.origin.includes("localhost")
//   ? "http://127.0.0.1:8000"
//   : "";
const API_BASE = "http://49.233.122.150";
const form = document.getElementById("recordForm");
const recordDate = document.getElementById("recordDate");
const datePickerTrigger = document.getElementById("datePickerTrigger");
const projectInputs = document.getElementById("projectInputs");
const formMsg = document.getElementById("formMsg");
const recordsList = document.getElementById("recordsList");
const ovDays = document.getElementById("ovDays");
const ovCost = document.getElementById("ovCost");
const ovBonus = document.getElementById("ovBonus");
const ovDayProfit = document.getElementById("ovDayProfit");
const ovAllProfit = document.getElementById("ovAllProfit");

let config = null;
const saveSuccessAudio = new Audio("./images/leisu.mp3");
saveSuccessAudio.preload = "auto";

function projectInputBlock(name, target) {
  return `
    <div class="project-item">
      <div class="project-name"><span class="dot"></span>${name}</div>
      <label class="field">
        <input type="number" min="0" step="0.01" required data-project="${name}" data-field="cost" placeholder="投入" />
      </label>
      <label class="field">
        <input type="number" min="0" step="0.01" required data-project="${name}" data-field="bonus" placeholder="奖金" />
      </label>
      <small class="project-target">目标盈利：${target}</small>
    </div>
  `;
}

function moneyClass(value) {
  return Number(value) >= 0 ? "profit-positive" : "profit-negative";
}

function formatMoney(value) {
  return Number(value).toFixed(2);
}

function profitDisplayClass(value) {
  return Number(value) < 0 ? "profit-negative" : "profit-gold";
}

function renderOverview(records) {
  const totalDays = records.length;
  const latest = records[records.length - 1];
  if (!latest) {
    ovDays.textContent = "0";
    ovCost.textContent = "0.00";
    ovBonus.textContent = "0.00";
    ovDayProfit.textContent = "0.00";
    ovAllProfit.textContent = "0.00";
    return;
  }

  let dayCost = 0;
  let dayBonus = 0;
  for (const projectName of config.projects) {
    dayCost += Number(latest.projects[projectName].cost || 0);
    dayBonus += Number(latest.projects[projectName].bonus || 0);
  }

  ovDays.textContent = String(totalDays);
  ovCost.textContent = formatMoney(dayCost);
  ovBonus.textContent = formatMoney(dayBonus);
  ovDayProfit.textContent = formatMoney(latest.day_profit);
  ovAllProfit.textContent = formatMoney(latest.all_total_profit);
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

async function deleteRecord(recordDateValue) {
  const res = await fetch(`${API_BASE}/api/records/${recordDateValue}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("删除失败，请稍后重试");
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
  if (!records.length) {
    recordsList.innerHTML = `<div class="empty-record">暂无记录，先在上方录入今天的数据</div>`;
    return;
  }

  recordsList.innerHTML = [...records]
    .reverse()
    .map((r) => {
      const dayProfit = Number(r.day_profit || 0);
      const toneClass = dayProfit > 0 ? "tone-win" : dayProfit < 0 ? "tone-loss" : "tone-flat";
      const projectRows = projects
        .map((p) => {
          const v = r.projects[p];
          return `
            <div class="history-grid-row">
              <div class="c-project">${p}</div>
              <div class="c-cost">${formatMoney(v.cost)}</div>
              <div class="c-bonus">${formatMoney(v.bonus)}</div>
              <div class="c-profit ${profitDisplayClass(v.daily_total_profit)}">${formatMoney(v.daily_total_profit)}</div>
              <div class="c-next ${profitDisplayClass(v.tomorrow_required_profit)}">${formatMoney(v.tomorrow_required_profit)}</div>
            </div>
          `;
        })
        .join("");

      return `
        <article class="history-card ${toneClass}">
          <div class="history-card-head">
            <div class="head-date">
              <strong>${r.record_date}</strong>
              <span>日盈利：<em class="${profitDisplayClass(r.day_profit)}">${formatMoney(r.day_profit)}</em></span>
            </div>
            <div class="date-bar-actions">
              <span>累计：<strong class="${profitDisplayClass(r.all_total_profit)}">${formatMoney(r.all_total_profit)}</strong></span>
              <button class="danger-btn" type="button" data-delete-date="${r.record_date}">删除</button>
            </div>
          </div>

          <div class="history-grid head">
            <div class="h-project">项目</div>
            <div class="h-cost">投入</div>
            <div class="h-bonus">奖金</div>
            <div class="h-profit">盈利</div>
            <div class="h-next">明日</div>
          </div>

          <div class="history-grid body">
            ${projectRows}
            <div class="history-grid-row total">
              <div class="c-project">合计</div>
              <div class="c-cost">${formatMoney(projects.reduce((s, name) => s + Number(r.projects[name].cost || 0), 0))}</div>
              <div class="c-bonus">${formatMoney(projects.reduce((s, name) => s + Number(r.projects[name].bonus || 0), 0))}</div>
              <div class="c-profit ${profitDisplayClass(r.day_profit)}">${formatMoney(r.day_profit)}</div>
              <div class="c-next">--</div>
            </div>
          </div>
        </article>
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
  renderOverview(payload.records);
}

function openDatePicker() {
  if (typeof recordDate.showPicker === "function") {
    recordDate.showPicker();
    return;
  }
  recordDate.focus();
  recordDate.click();
}

datePickerTrigger.addEventListener("click", (e) => {
  if (e.target !== recordDate) {
    e.preventDefault();
    openDatePicker();
  }
});

recordsList.addEventListener("click", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const recordDateValue = target.dataset.deleteDate;
  if (!recordDateValue) {
    return;
  }
  const ok = window.confirm(`确认删除 ${recordDateValue} 的记录吗？`);
  if (!ok) {
    return;
  }
  try {
    await deleteRecord(recordDateValue);
    formMsg.textContent = `已删除 ${recordDateValue} 记录`;
    await refreshTable();
  } catch (err) {
    formMsg.textContent = err.message;
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMsg.textContent = "";
  try {
    await saveRecord({
      record_date: recordDate.value,
      projects: collectProjects(),
    });
    formMsg.textContent = "保存成功";
    try {
      saveSuccessAudio.currentTime = 0;
      await saveSuccessAudio.play();
    } catch {
      // ignore autoplay / decode errors
    }
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
