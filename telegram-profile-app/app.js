"use strict";

/* =====================================================================
   1. CONFIG
   ===================================================================== */
const CONFIG = {
  // Point this at your own backend to validate `initData` server-side and
  // persist actions. When left null the app falls back to
  // Telegram.WebApp.sendData(), which only works if this Mini App was
  // opened from a `web_app` KEYBOARD button (see README for details).
  BACKEND_URL: "https://exhaust-crazy-macaroni.ngrok-free.dev",

  // Show fabricated sample data so the screen is never empty during
  // development. Set to false once routes are supplied by your backend.
  USE_MOCK_DATA: false,

  ROUTES_PREVIEW_COUNT: 3,
};

/* =====================================================================
   2. TELEGRAM WEBAPP BOOTSTRAP
   ===================================================================== */
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

if (tg) {
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor("secondary_bg_color"); } catch (e) { /* older client */ }
  try {
    const bg = (tg.themeParams && tg.themeParams.secondary_bg_color) || "#313b43";
    tg.setBackgroundColor(bg);
  } catch (e) { /* older client */ }
  if (typeof tg.enableClosingConfirmation === "function") tg.enableClosingConfirmation();
}

const MONTHS_UK = ["Січ.", "Лют.", "Берез.", "Квіт.", "Трав.", "Черв.", "Лип.", "Серп.", "Верес.", "Жовт.", "Листоп.", "Груд."];

/* =====================================================================
   3. DATA
   Every piece of content below is a plain JS object/array. Swap
   `loadProfileData()` for a real fetch() call against your backend and
   the rest of the app (rendering, stats, chart) keeps working unchanged
   because it's all derived from this data, never hard-coded in the HTML.
   ===================================================================== */
function getMockData() {
  const tgUser = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;

  return {
    profile: {
      name: (tgUser && (tgUser.first_name || tgUser.username)) || "Мандрівник",
      photoUrl: (tgUser && tgUser.photo_url) || null,
      statusEmoji: "🔰",
      statusLabel: "Новачок",
    },
    // `type` only controls which icon shows while a route is NOT completed:
    // 'standard' -> open-lock icon (an ordinary unlocked route)
    // 'gift'     -> box icon (a route someone sent as a gift, still unpacked)
    routes: [
      { id: "golden-gates", name: "Загадки Золотих воріт", city: "Київ", type: "standard", completed: false },
      { id: "rynok-square", name: "Таємниці Площі Ринок", city: "Львів", type: "gift", completed: false },
      { id: "ancestor-trails", name: "Стежки предків", city: "Полтава", type: "gift", completed: false },
      { id: "beast-hunt", name: "У пошуках звірів", city: "Одеса", type: "standard", completed: false },

      { id: "opera-secrets", name: "Секрети Оперного", city: "Одеса", completed: true, completedDate: "2026-03-04" },
      { id: "castle-legends", name: "Легенди фортеці", city: "Кам'янець-Подільський", completed: true, completedDate: "2026-03-15" },
      { id: "river-walk", name: "Прогулянка над Дніпром", city: "Київ", completed: true, completedDate: "2026-03-22" },

      { id: "old-town-lviv", name: "Старе місто", city: "Львів", completed: true, completedDate: "2026-04-11" },

      { id: "chernihiv-domes", name: "Бані Чернігова", city: "Чернігів", completed: true, completedDate: "2026-05-02" },
      { id: "market-tales", name: "Історії базару", city: "Полтава", completed: true, completedDate: "2026-05-09" },
      { id: "fortress-walls", name: "Мури фортеці", city: "Кам'янець-Подільський", completed: true, completedDate: "2026-05-16" },
      { id: "seaside-route", name: "Прибережний маршрут", city: "Одеса", completed: true, completedDate: "2026-05-21" },
      { id: "lviv-coffee", name: "Кавова кімната", city: "Львів", completed: true, completedDate: "2026-05-27" },

      { id: "kyiv-rooftops", name: "Дахи Києва", city: "Київ", completed: true, completedDate: "2026-06-03" },
      { id: "poltava-parks", name: "Парки Полтави", city: "Полтава", completed: true, completedDate: "2026-06-10" },
      { id: "chernihiv-gates", name: "Ворота Чернігова", city: "Чернігів", completed: true, completedDate: "2026-06-18" },
      { id: "lviv-legends", name: "Легенди Львова", city: "Львів", completed: true, completedDate: "2026-06-25" },
    ],
  };
}

async function loadProfileData() {
  if (!CONFIG.USE_MOCK_DATA && CONFIG.BACKEND_URL) {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/webapp/profile`, {
      headers: { "X-Telegram-Init-Data": (tg && tg.initData) || "", "ngrok-skip-browser-warning": "true"},
    });
    if (!res.ok) throw new Error("Failed to load profile");
    return res.json();
  }
  return getMockData();
}

/* =====================================================================
   4. STATE
   ===================================================================== */
const state = {
  profile: null,
  routes: [],
  searchQuery: "",
  showAllRoutes: false,
  openRouteId: null,
  openStat: null, // 'completed' | 'cities' | 'history' | null (independent toggles)
  activeOverlay: null, // 'editName' | 'donate' | 'return' | null
  overlayRoute: null,
};

/* =====================================================================
   5. DOM REFS
   ===================================================================== */
const el = (id) => document.getElementById(id);

const refs = {
  avatarImg: el("avatarImg"),
  avatarFallback: el("avatarFallback"),
  usernameText: el("usernameText"),
  editNameBtn: el("editNameBtn"),
  statusEmoji: el("statusEmoji"),
  statusLabel: el("statusLabel"),

  searchInput: el("searchInput"),

  routesList: el("routesList"),
  showMoreRoutesBtn: el("showMoreRoutesBtn"),
  routesEmptyState: el("routesEmptyState"),

  statCompletedRow: el("statCompletedRow"),
  statCompletedCount: el("statCompletedCount"),
  statCompletedList: el("statCompletedList"),
  statCitiesRow: el("statCitiesRow"),
  statCitiesCount: el("statCitiesCount"),
  statCitiesList: el("statCitiesList"),
  statHistoryRow: el("statHistoryRow"),
  historyChart: el("historyChart"),

  overlay: el("overlay"),
  overlayBackdrop: el("overlayBackdrop"),
  sheetEditName: el("sheetEditName"),
  editNameInput: el("editNameInput"),
  sheetDonate: el("sheetDonate"),
  donateRouteLabel: el("donateRouteLabel"),
  donateAddressInput: el("donateAddressInput"),
  screenReturn: el("screenReturn"),
  returnRouteLabel: el("returnRouteLabel"),
  returnConfirmCheckbox: el("returnConfirmCheckbox"),
  returnBackBtn: el("returnBackBtn"),

  toast: el("toast"),
};

/* =====================================================================
   6. DERIVED DATA HELPERS
   ===================================================================== */
function getCompletedRoutes() {
  return state.routes.filter((r) => r.completed);
}

function getCitiesVisited() {
  const map = new Map();
  for (const r of getCompletedRoutes()) {
    map.set(r.city, (map.get(r.city) || 0) + 1);
  }
  return [...map.entries()].map(([city, count]) => ({ city, count }));
}

function getMonthlyHistory() {
  const buckets = new Map(); // 'YYYY-MM' -> count
  for (const r of getCompletedRoutes()) {
    if (!r.completedDate) continue;
    const key = r.completedDate.slice(0, 7);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-8) // keep the chart readable on small screens
    .map(([key, count]) => {
      const monthIndex = parseInt(key.slice(5, 7), 10) - 1;
      return { key, count, label: MONTHS_UK[monthIndex] || key };
    });
}

function getFilteredRoutes() {
  const q = state.searchQuery.trim().toLowerCase();
  if (!q) return state.routes;
  return state.routes.filter(
    (r) => r.name.toLowerCase().includes(q) || r.city.toLowerCase().includes(q)
  );
}

/* =====================================================================
   7. RENDER
   ===================================================================== */
function renderProfile() {
  const p = state.profile;
  refs.usernameText.textContent = p.name;
  refs.statusEmoji.textContent = p.statusEmoji;
  refs.statusLabel.textContent = p.statusLabel;
  refs.avatarFallback.textContent = (p.name || "?").trim().charAt(0).toUpperCase();

  if (p.photoUrl) {
    refs.avatarImg.src = p.photoUrl;
    refs.avatarImg.hidden = false;
    refs.avatarFallback.hidden = true;
  } else {
    refs.avatarImg.hidden = true;
    refs.avatarFallback.hidden = false;
  }
}

function routeStatusIcon(route) {
  if (route.completed) return "icon-open";
  return "icon-box";
}

function renderRouteActions(route) {
  if (route.completed) {
    return `
      <button class="repeat-btn" data-action="repeat" data-route="${route.id}">
        <span class="icon icon-play"></span> Повторити
      </button>`;
  }
  return `
    <div class="action-row">
      <button class="action-btn" data-action="start" data-route="${route.id}">
        <span class="icon-circle"><span class="icon icon-play"></span></span>
        Розпочати
      </button>
      <button class="action-btn" data-action="donate" data-route="${route.id}">
        <span class="icon-circle"><span class="icon icon-box"></span></span>
        Подарувати
      </button>
      <button class="action-btn is-return" data-action="return" data-route="${route.id}">
        <span class="icon-circle"><span class="icon icon-undo"></span></span>
        Повернути
      </button>
    </div>`;
}

function renderRoutes() {
  const filtered = getFilteredRoutes();
  const isSearching = state.searchQuery.trim().length > 0;
  
  const visible = isSearching || state.showAllRoutes 
    ? filtered 
    : filtered.slice(0, CONFIG.ROUTES_PREVIEW_COUNT);

  refs.routesEmptyState.hidden = filtered.length !== 0;
  refs.routesList.hidden = filtered.length === 0;

  refs.routesList.innerHTML = visible
    .map((route) => {
      const isOpen = state.openRouteId === route.id;
      return `
      <div class="route-item ${isOpen ? "is-open" : ""}" data-route-id="${route.id}">
        <button class="route-row" data-toggle-route="${route.id}">
          <span class="route-icon"><span class="icon ${routeStatusIcon(route)}"></span></span>
          <span class="route-text">
            <div class="route-name">${escapeHtml(route.name)}</div>
            <div class="route-city">${escapeHtml(route.city)}</div>
          </span>
          <span class="icon icon-arrow chevron"></span>
        </button>
        <div class="route-panel">
          <div class="route-panel-inner">${renderRouteActions(route)}</div>
        </div>
      </div>`;
    })
    .join("");

  const hasManyRoutes = filtered.length > CONFIG.ROUTES_PREVIEW_COUNT;

  if (isSearching || !hasManyRoutes) {
    refs.showMoreRoutesBtn.hidden = true;
  } else {
    refs.showMoreRoutesBtn.hidden = false;
    refs.showMoreRoutesBtn.textContent = state.showAllRoutes ? "Показати менше" : "Показати більше";
  }
}

function renderStats() {
  const completed = getCompletedRoutes();
  const cities = getCitiesVisited();

  refs.statCompletedCount.textContent = completed.length;
  refs.statCitiesCount.textContent = cities.length;

  refs.statCompletedList.innerHTML = completed.length
    ? completed
        .map(
          (r) => `<div class="stat-list-item"><span class="name">${escapeHtml(r.name)}</span><span class="meta">${escapeHtml(r.city)}</span></div>`
        )
        .join("")
    : `<p class="empty-state">Ще немає пройдених маршрутів</p>`;

  refs.statCitiesList.innerHTML = cities.length
    ? cities
        .map(
          (c) => `<div class="stat-list-item"><span class="name">${escapeHtml(c.city)}</span><span class="meta">${c.count} ${routeWord(c.count)}</span></div>`
        )
        .join("")
    : `<p class="empty-state">Ще немає відвіданих міст</p>`;

  renderHistoryChart();
}

function routeWord(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "маршрут";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "маршрути";
  return "маршрутів";
}

// Fully dynamic SVG bar chart, generated from getMonthlyHistory() — no
// baked-in numbers. Re-run this any time `state.routes` changes.
function renderHistoryChart() {
  const data = getMonthlyHistory();
  const svg = refs.historyChart;
  const width = 320, height = 150;

  const paddingBottom = 26, paddingTop = 20, paddingLeft = 32, paddingRight = 10;
  const chartH = height - paddingBottom - paddingTop;
  const chartW = width - paddingLeft - paddingRight;

  if (data.length === 0) {
    svg.innerHTML = `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="chart-label">Ще немає даних</text>`;
    return;
  }

  const maxCount = Math.max(1, ...data.map((d) => d.count));

  let gridLines = "";
  const yTicks = 3; 
  for (let i = 0; i <= yTicks; i++) {
    const val = Math.round(maxCount * (i / yTicks));
    const y = paddingTop + chartH - (val / maxCount) * chartH;
    
    gridLines += `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--separator)" stroke-width="1"></line>`;
    gridLines += `<text x="${paddingLeft - 8}" y="${y + 4}" text-anchor="end" class="chart-label" style="fill: var(--hint); font-size: 10px;">${val}</text>`;
  }

  const barGap = 12;
  const barWidth = Math.min(34, (chartW - barGap * (data.length + 1)) / data.length);
  const totalBarsWidth = data.length * barWidth + (data.length - 1) * barGap;
  const startX = paddingLeft + (chartW - totalBarsWidth) / 2;

  let bars = "";
  data.forEach((d, i) => {
    const x = startX + i * (barWidth + barGap);
    const barH = Math.max(4, (d.count / maxCount) * chartH);
    const y = paddingTop + (chartH - barH);
    
    bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" class="chart-bar"></rect>`;
    bars += `<text x="${x + barWidth / 2}" y="${height - 6}" text-anchor="middle" class="chart-label">${escapeHtml(d.label)}</text>`;
  });

  svg.innerHTML = gridLines + bars;
}

function renderAll() {
  renderProfile();
  renderRoutes();
  renderStats();
}

/* =====================================================================
   8. EVENTS — routes, search, show more
   ===================================================================== */
refs.searchInput.addEventListener("input", (e) => {
  state.searchQuery = e.target.value;
  renderRoutes();
});

refs.showMoreRoutesBtn.addEventListener("click", () => {
  state.showAllRoutes = !state.showAllRoutes;
  renderRoutes();
});

refs.routesList.addEventListener("click", (e) => {
  const toggleBtn = e.target.closest("[data-toggle-route]");
  if (toggleBtn) {
    const id = toggleBtn.getAttribute("data-toggle-route");
    state.openRouteId = state.openRouteId === id ? null : id;
    renderRoutes();
    haptic("light");
    return;
  }

  const actionBtn = e.target.closest("[data-action]");
  if (actionBtn) {
    const action = actionBtn.getAttribute("data-action");
    const routeId = actionBtn.getAttribute("data-route");
    const route = state.routes.find((r) => r.id === routeId);
    if (!route) return;
    handleRouteAction(action, route);
  }
});

function handleRouteAction(action, route) {
  if (action === "start") {
    haptic("light");
    sendCommand("start_route", { route: route.name });
    showToast("Відкриваємо маршрут…");
    state.openRouteId = null;
    renderRoutes();
  } else if (action === "repeat") {
    haptic("light");
    sendCommand("repeat_route", { route: route.name });
    showToast("Починаємо маршрут заново…");
    state.openRouteId = null;
    renderRoutes();
  } else if (action === "donate") {
    openOverlay("donate", route);
  } else if (action === "return") {
    openOverlay("return", route);
  }
}

/* ---- Stat row toggles ------------------------------------------------ */
[refs.statCompletedRow, refs.statCitiesRow, refs.statHistoryRow].forEach((row) => {
  row.querySelector(".stat-row-head").addEventListener("click", () => {
    const key = row.dataset.stat;
    state.openStat = state.openStat === key ? null : key;
    [refs.statCompletedRow, refs.statCitiesRow, refs.statHistoryRow].forEach((r) => {
      r.classList.toggle("is-open", state.openStat === r.dataset.stat);
    });
    haptic("light");
  });
});

/* =====================================================================
   9. OVERLAY / SHEET / SCREEN CONTROLLER
   ===================================================================== */
function openOverlay(kind, route) {
  state.activeOverlay = kind;
  state.overlayRoute = route || null;

  refs.overlay.hidden = false;
  requestAnimationFrame(() => refs.overlay.classList.add("is-visible"));

  refs.sheetEditName.hidden = kind !== "editName";
  refs.sheetDonate.hidden = kind !== "donate";
  refs.screenReturn.hidden = kind !== "return";

  if (kind === "editName") {
    refs.editNameInput.value = state.profile.name;
    requestAnimationFrame(() => refs.sheetEditName.classList.add("is-active"));
    setTimeout(() => refs.editNameInput.focus(), 250);
    setMainButton("Зберегти", { onClick: saveNameFromSheet, active: true });
  }

  if (kind === "donate") {
    refs.donateRouteLabel.textContent = route.name;
    refs.donateAddressInput.value = "";
    requestAnimationFrame(() => refs.sheetDonate.classList.add("is-active"));
    setTimeout(() => refs.donateAddressInput.focus(), 250);
    setMainButton("Надіслати", { onClick: confirmDonate, active: false });
  }

  if (kind === "return") {
    refs.returnRouteLabel.textContent = route.name;
    refs.returnConfirmCheckbox.checked = false;
    requestAnimationFrame(() => refs.screenReturn.classList.add("is-active"));
    setMainButton("Повернути маршрут", { onClick: confirmReturn, active: false, destructive: true });
  }

  if (tg && tg.BackButton) {
    tg.BackButton.show();
    tg.BackButton.onClick(closeOverlay);
  }
}

function closeOverlay() {
  refs.sheetEditName.classList.remove("is-active");
  refs.sheetDonate.classList.remove("is-active");
  refs.screenReturn.classList.remove("is-active");
  refs.overlay.classList.remove("is-visible");

  setTimeout(() => {
    if (!state.activeOverlay) refs.overlay.hidden = true;
  }, 260);

  state.activeOverlay = null;
  state.overlayRoute = null;
  hideMainButton();
  if (tg && tg.BackButton) tg.BackButton.hide();
}

refs.overlayBackdrop.addEventListener("click", closeOverlay);
refs.returnBackBtn.addEventListener("click", closeOverlay);

refs.donateAddressInput.addEventListener("input", () => {
  const active = refs.donateAddressInput.value.trim().length > 0;
  if (tg && tg.MainButton) tg.MainButton.setParams({ is_active: active });
  else mainButtonFallback.active = active;
});

refs.returnConfirmCheckbox.addEventListener("change", () => {
  const active = refs.returnConfirmCheckbox.checked;
  if (tg && tg.MainButton) tg.MainButton.setParams({ is_active: active });
  else mainButtonFallback.active = active;
});

function saveNameFromSheet() {
  const value = refs.editNameInput.value.trim();
  if (!value) return;
  state.profile.name = value;
  renderProfile();
  sendCommand("update_name", { name: value });
  showToast("Ім'я збережено");
  closeOverlay();
}

function confirmDonate() {
  const address = refs.donateAddressInput.value.trim();
  if (!address || !state.overlayRoute) return;
  sendCommand("donate", { route: state.overlayRoute.name, address });
  showToast("Дякуємо! Маршрут подаровано");
  state.openRouteId = null;
  closeOverlay();
  renderRoutes();
}

function confirmReturn() {
  if (!refs.returnConfirmCheckbox.checked || !state.overlayRoute) return;
  const routeId = state.overlayRoute.id;
  sendCommand("return_route", { route: state.overlayRoute.name });
  state.routes = state.routes.filter((r) => r.id !== routeId);
  showToast("Маршрут повернено");
  state.openRouteId = null;
  closeOverlay();
  renderAll();
}

refs.editNameBtn.addEventListener("click", () => openOverlay("editName"));

/* =====================================================================
   10. MAIN BUTTON — a thin wrapper so the rest of the app doesn't care
   whether it's running inside Telegram or a plain browser preview.
   ===================================================================== */
const mainButtonFallback = { active: false, onClick: null };

function setMainButton(text, { onClick, active = true, destructive = false } = {}) {
  if (tg && tg.MainButton) {
    const themeButtonColor = (tg.themeParams && tg.themeParams.button_color) || "#4be1ab";
    const themeButtonTextColor = (tg.themeParams && tg.themeParams.button_text_color) || "#0e1621";
    const destructiveColor = (tg.themeParams && tg.themeParams.destructive_text_color) || "#ff5c5c";

    tg.MainButton.setText(text);
    tg.MainButton.setParams({
      is_visible: true,
      is_active: active,
      color: destructive ? destructiveColor : themeButtonColor,
      text_color: destructive ? "#ffffff" : themeButtonTextColor,
    });
    tg.MainButton.offClick(mainButtonFallback.onClick || (() => {}));
    tg.MainButton.onClick(onClick);
    mainButtonFallback.onClick = onClick;
    tg.MainButton.show();
  } else {
    // Minimal fallback so the flow is testable outside Telegram.
    mainButtonFallback.onClick = onClick;
    mainButtonFallback.active = active;
    console.log(`[demo] MainButton: "${text}" (active=${active})`);
  }
}

function hideMainButton() {
  if (tg && tg.MainButton) tg.MainButton.hide();
  mainButtonFallback.onClick = null;
}

/* =====================================================================
   11. COMMAND CHANNEL — sends a structured action back to the bot.
   ===================================================================== */
async function sendCommand(action, payload = {}) {
  const message = { action, ...payload };

  try {
    if (CONFIG.BACKEND_URL) {
      const res = await fetch(`${CONFIG.BACKEND_URL}/api/webapp/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Init-Data": (tg && tg.initData) || "",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify(message),
      });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      return true;
    }

    if (tg && typeof tg.sendData === "function") {
      // Only works if this Mini App was opened via a `web_app` keyboard button.
      tg.sendData(JSON.stringify(message));
      return true;
    }
  } catch (err) {
    console.error("sendCommand failed:", err);
    showToast("Не вдалося надіслати дію");
    return false;
  }

  console.log("[demo] command ->", message);
  return true;
}

/* =====================================================================
   12. HELPERS
   ===================================================================== */
function haptic(style) {
  if (tg && tg.HapticFeedback) {
    if (style === "light" || style === "medium" || style === "heavy") {
      tg.HapticFeedback.impactOccurred(style);
    } else {
      tg.HapticFeedback.notificationOccurred(style);
    }
  }
}

let toastTimer = null;
function showToast(text) {
  refs.toast.textContent = text;
  refs.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => refs.toast.classList.remove("is-visible"), 2200);
  haptic("success");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =====================================================================
   13. INIT
   ===================================================================== */
(async function init() {
  try {
    const data = await loadProfileData();
    state.profile = data.profile;
    state.routes = data.routes;
  } catch (err) {
    console.error("Failed to load profile data, falling back to mock:", err);
    const data = getMockData();
    state.profile = data.profile;
    state.routes = data.routes;
  }
  renderAll();
})();
