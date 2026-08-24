const START = new Date(2026, 7, 24);
const END = new Date(2026, 8, 23);
const LIMIT = 6;

const $ = (id) => document.getElementById(id);

let state = { user: "Игорь", entries: {} };
let selected = iso(clampToday());
let verdict = null;
let watchOn = false;
let watchStart = 0;
let watchRaf = 0;
let isAdmin = false;

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function clampToday() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today < START) return START;
  if (today > END) return END;
  return today;
}

function daysInRange() {
  const list = [];
  const cur = new Date(START);
  while (cur <= END) {
    list.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return list;
}

function kind(entry) {
  if (!entry) return "empty";
  if (!entry.ok) return "miss";
  if (entry.seconds > LIMIT) return "late";
  return "win";
}

function ruDate(value) {
  return parseIso(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function passed(entry) {
  return Boolean(entry && entry.ok && entry.seconds <= LIMIT);
}

function statsFrom(entries) {
  const days = daysInRange();
  const filled = days.map((d) => entries[iso(d)]).filter(Boolean);
  const wins = filled.filter(passed);
  const times = filled.map((e) => e.seconds);
  const best = times.length ? Math.min(...times) : null;
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
  const broken = filled.some((e) => !passed(e));
  return {
    filled: filled.length,
    total: days.length,
    wins: wins.length,
    best,
    avg,
    broken,
  };
}

function renderStats() {
  const s = statsFrom(state.entries);
  $("streak-pill").textContent = s.broken ? "Серия сорвана" : "Серия жива";
  $("streak-pill").classList.toggle("dead", s.broken);
  $("stats").innerHTML = `
    <li><b>${s.filled}/${s.total}</b><span>дней</span></li>
    <li><b>${s.wins}</b><span>чисто</span></li>
    <li><b>${s.avg == null ? "—" : s.avg.toFixed(2) + "с"}</b><span>среднее</span></li>
    <li><b>${s.best == null ? "—" : s.best.toFixed(2) + "с"}</b><span>лучшее</span></li>
  `;
}

function renderCalendar() {
  const today = iso(clampToday());
  const groups = [
    { title: "Август", days: daysInRange().filter((d) => d.getMonth() === 7) },
    { title: "Сентябрь", days: daysInRange().filter((d) => d.getMonth() === 8) },
  ];

  $("cal").innerHTML = groups.map((group) => `
    <div class="month">
      <p>${group.title}</p>
      <div class="days">
        ${group.days.map((d) => {
          const key = iso(d);
          const entry = state.entries[key];
          const cls = ["cell", kind(entry)];
          if (key === selected) cls.push("selected");
          if (key === today) cls.push("today");
          const time = entry ? `${entry.seconds.toFixed(1)}с` : "";
          return `<button type="button" class="${cls.join(" ")}" data-day="${key}">
            <span class="d">${d.getDate()}</span>
            <span class="t">${time}</span>
          </button>`;
        }).join("")}
      </div>
    </div>
  `).join("");
}

function setSeconds(value) {
  const n = Math.max(0, Math.min(120, Number(value) || 0));
  $("seconds").value = n ? n.toFixed(2) : "";
  $("slider").value = String(Math.min(10, n));
}

function applyMode() {
  document.body.classList.toggle("is-admin", isAdmin);
  document.body.classList.toggle("is-guest", !isAdmin);
}

function renderDayView(entry) {
  const view = $("day-view");
  if (!entry) {
    view.innerHTML = `<p class="empty-day">Этот день ещё не заполнен.</p>`;
    return;
  }
  const labels = { win: "Чисто", late: "Опоздал", miss: "Ошибка" };
  const k = kind(entry);
  view.innerHTML = `
    <p class="day-result ${k}">${labels[k]}</p>
    <p class="day-time">${entry.seconds.toFixed(2)} сек</p>
  `;
}

function loadDay(key) {
  selected = key;
  const entry = state.entries[key];
  const today = iso(clampToday());
  $("day-title").textContent = ruDate(key);
  $("day-hint").textContent = isAdmin
    ? (key === today
      ? "Сегодняшний день. Отметь слив и запиши секунды."
      : "Можно заполнить или поправить любой день челленджа.")
    : "Гости могут только смотреть. Чтобы менять журнал, войди.";

  verdict = entry ? Boolean(entry.ok) : null;
  $("btn-ok").classList.toggle("on", verdict === true);
  $("btn-bad").classList.toggle("on", verdict === false);
  setSeconds(entry ? entry.seconds : 0);
  $("form-msg").hidden = true;
  renderDayView(entry);
  renderCalendar();
}

async function checkMe() {
  const res = await fetch("/api/me");
  const data = await res.json();
  isAdmin = Boolean(data.admin);
  applyMode();
}

function showMsg(text, type) {
  const el = $("form-msg");
  el.hidden = false;
  el.className = `form-msg ${type}`;
  el.textContent = text;
}

async function refresh() {
  const res = await fetch("/api/state");
  state = await res.json();
  renderStats();
  loadDay(selected);
}

$("cal").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-day]");
  if (!btn) return;
  stopWatch();
  loadDay(btn.dataset.day);
});

$("btn-ok").addEventListener("click", () => {
  verdict = true;
  $("btn-ok").classList.add("on");
  $("btn-bad").classList.remove("on");
  $("seconds").focus();
});

$("btn-bad").addEventListener("click", () => {
  verdict = false;
  $("btn-bad").classList.add("on");
  $("btn-ok").classList.remove("on");
});

$("sec-minus").addEventListener("click", () => {
  setSeconds(Number($("seconds").value || 0) - 0.1);
});

$("sec-plus").addEventListener("click", () => {
  setSeconds(Number($("seconds").value || 0) + 0.1);
});

$("seconds").addEventListener("input", () => {
  $("slider").value = String(Math.min(10, Math.max(0, Number($("seconds").value) || 0)));
});
$("slider").addEventListener("input", () => setSeconds($("slider").value));

$("chips").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-sec]");
  if (!btn) return;
  setSeconds(btn.dataset.sec);
});

function stopWatch() {
  watchOn = false;
  cancelAnimationFrame(watchRaf);
  $("watch-btn").classList.remove("live");
  $("watch-btn").textContent = "Засечь";
}

function tickWatch() {
  if (!watchOn) return;
  setSeconds((performance.now() - watchStart) / 1000);
  watchRaf = requestAnimationFrame(tickWatch);
}

$("watch-btn").addEventListener("click", () => {
  if (watchOn) {
    stopWatch();
    return;
  }
  watchOn = true;
  watchStart = performance.now();
  $("watch-btn").classList.add("live");
  $("watch-btn").textContent = "Стоп";
  tickWatch();
});

$("log-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  stopWatch();
  if (verdict === null) {
    showMsg("Сначала отметь: слил правильно или с ошибкой.", "err");
    return;
  }
  const seconds = Number($("seconds").value);
  if (!Number.isFinite(seconds) || $("seconds").value === "") {
    showMsg("Укажи, за сколько секунд был слив.", "err");
    return;
  }

  const res = await fetch(`/api/entries/${selected}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: verdict, seconds, note: "" }),
  });
  if (res.status === 401) {
    showMsg("Сначала войди, чтобы менять журнал.", "err");
    return;
  }
  state = await res.json();
  renderStats();
  loadDay(selected);

  const late = verdict && seconds > LIMIT;
  const text = !verdict
    ? "День записан: ошибка."
    : late
      ? `День записан: опоздание ${seconds.toFixed(2)} сек.`
      : `День записан: чисто, ${seconds.toFixed(2)} сек.`;
  showMsg(text, verdict && !late ? "ok" : "err");
});

$("clear-btn").addEventListener("click", async () => {
  stopWatch();
  const res = await fetch(`/api/entries/${selected}`, { method: "DELETE" });
  if (res.status === 401) {
    showMsg("Сначала войди, чтобы менять журнал.", "err");
    return;
  }
  await refresh();
  showMsg("День очищен.", "ok");
});

function openLogin() {
  $("login-modal").hidden = false;
  $("login-msg").hidden = true;
  $("login-pass").value = "";
  $("login-pass").focus();
}

function closeLogin() {
  $("login-modal").hidden = true;
}

$("login-btn").addEventListener("click", openLogin);
$("login-cancel").addEventListener("click", closeLogin);
$("login-modal").addEventListener("click", (event) => {
  if (event.target === $("login-modal")) closeLogin();
});

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: $("login-pass").value }),
  });
  if (!res.ok) {
    $("login-msg").hidden = false;
    $("login-msg").textContent = "Неверный пароль.";
    return;
  }
  isAdmin = true;
  applyMode();
  closeLogin();
  loadDay(selected);
});

$("logout-btn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  isAdmin = false;
  applyMode();
  stopWatch();
  loadDay(selected);
});

applyMode();
Promise.all([checkMe(), refresh()]).catch(() => {
  applyMode();
  renderStats();
  loadDay(selected);
});
