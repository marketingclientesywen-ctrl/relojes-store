// ==========================
// Sapi Watches - Login gate + Catalog (limpio)
// ==========================

// CONFIG
const SUPABASE_URL = "https://gwprzkuuxhnixovmniaj.supabase.co";
const SUPABASE_KEY = "sb_publishable_pd2KxCYegn_GRt5VCvjbnw_fBSIIu8r";
const TABLE_NAME = "base_productos";

const COL = { title: "Titulo", image: "Imagen", price: "Precio", url: "Titulo_URL" };

// INIT
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// UI (login)
const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginMsg = document.getElementById("loginMsg");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");

// UI (app)
const appContent = document.getElementById("appContent");
const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const searchEl = document.getElementById("search");
const sortEl = document.getElementById("sort");
const loadMoreBtn = document.getElementById("loadMore");
const logoutBtn = document.getElementById("logoutBtn");

let IS_ADMIN = false;

// paging
let page = 0;
const FIRST_LOAD = 10;  // inicio: 10 relojes
const PAGE_SIZE = 24;   // siguientes páginas
let loading = false;

let lastQuery = "";
let lastSort = "name_asc";

function setStatus(msg = "") {
  if (statusEl) statusEl.textContent = msg;
}

function showLoginError(msg) {
  if (!loginMsg) return;
  loginMsg.textContent = msg;
  loginMsg.classList.remove("hidden");
}

function clearLoginError() {
  if (!loginMsg) return;
  loginMsg.textContent = "";
  loginMsg.classList.add("hidden");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --- ROLE ---
async function loadUserRole() {
  IS_ADMIN = false;

  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData?.user) return;

  const userId = userData.user.id;

  const { data: profile, error } = await sb
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error || !profile) return;

  IS_ADMIN = profile.role === "admin";
}

// --- GATE ---
async function showApp() {
  if (loginScreen) loginScreen.classList.add("hidden");
  if (appContent) appContent.classList.remove("hidden");
}

async function showLogin() {
  if (appContent) appContent.classList.add("hidden");
  if (loginScreen) loginScreen.classList.remove("hidden");
}

async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    await showLogin();
    return false;
  }

  await loadUserRole();
  await showApp();
  return true;
}

// --- LOGIN ---
async function doLogin() {
  clearLoginError();

  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  if (!email || !password) {
    showLoginError("Rellena email y contraseña.");
    return;
  }

  if (loginBtn) loginBtn.disabled = true;

  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (loginBtn) loginBtn.disabled = false;

  if (error) {
    showLoginError("Credenciales incorrectas.");
    return;
  }

  const ok = await checkSession();
  if (ok) bootApp();
}

if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    doLogin();
  });
}

// --- LOGOUT ---
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await sb.auth.signOut();
    page = 0;
    if (grid) grid.innerHTML = "";
    await showLogin();
  });
}

// --- UI PRODUCT ---
function productCard(p) {
  const title = escapeHtml(p?.[COL.title] ?? "Sin título");
  const img = p?.[COL.image] ? escapeHtml(p[COL.image]) : "";
  const url = p?.[COL.url] ? escapeHtml(p[COL.url]) : "";
  const priceText = escapeHtml(p?.[COL.price] ?? "");

  return `
    <div class="group">
      <div class="bg-neutral-dark aspect-[4/5] overflow-hidden mb-8 border border-white/5 shadow-2xl">
        ${
          img
            ? `<img src="${img}" alt="${title}" class="w-full h-full object-cover" loading="lazy">`
            : `<div class="w-full h-full grid place-items-center text-slate-500 text-sm">Sin imagen</div>`
        }
      </div>

      <div class="space-y-4">
        <div class="flex justify-between items-baseline gap-4">
          <h3 class="text-xl font-medium tracking-tight group-hover:text-primary transition-colors line-clamp-2">${title}</h3>
          ${priceText ? `<span class="text-lg font-light text-slate-400 whitespace-nowrap">${priceText}</span>` : ""}
        </div>

        ${
          (IS_ADMIN && url)
            ? `<a class="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] font-bold text-primary pt-4 border-b border-transparent hover:border-primary transition-all"
                 href="${url}" target="_blank" rel="noopener">
                 Ver producto <span class="material-symbols-outlined text-xs">arrow_forward</span>
               </a>`
            : ``
        }
      </div>
    </div>
  `;
}

function applySort(q, sortValue) {
  switch (sortValue) {
    case "name_asc":
    default:
      return q.order(COL.title, { ascending: true });
  }
}

// --- FETCH ---
async function fetchProducts({ reset = false } = {}) {
  if (loading) return;
  loading = true;

  if (reset) {
    page = 0;
    if (grid) grid.innerHTML = "";
    if (loadMoreBtn) loadMoreBtn.disabled = false;
  }

  setStatus("Cargando…");
  if (loadMoreBtn) loadMoreBtn.disabled = true;

  const size = (page === 0) ? FIRST_LOAD : PAGE_SIZE;
  const from = page === 0 ? 0 : (FIRST_LOAD + (page - 1) * PAGE_SIZE);
  const to = from + size - 1;

  let q = sb.from(TABLE_NAME).select("*").range(from, to);

  const term = (lastQuery || "").trim();
  if (term) q = q.ilike(COL.title, `%${term}%`);

  q = applySort(q, lastSort);

  const { data, error } = await q;

  if (error) {
    console.error("Supabase error:", error);
    setStatus(`Error: ${error.message}`);
    if (loadMoreBtn) loadMoreBtn.disabled = false;
    loading = false;
    return;
  }

  if (!data || data.length === 0) {
    setStatus(reset ? "No hay resultados." : "No hay más productos.");
    if (loadMoreBtn) loadMoreBtn.disabled = true;
    loading = false;
    return;
  }

  grid.insertAdjacentHTML("beforeend", data.map(productCard).join(""));
  page += 1;

  setStatus("");
  if (loadMoreBtn) loadMoreBtn.disabled = false;
  loading = false;
}

// --- EVENTS APP ---
let searchTimer = null;
function onSearch(value) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    lastQuery = value;
    fetchProducts({ reset: true });
  }, 250);
}

let appBooted = false;
function bootApp() {
  if (appBooted) return;
  appBooted = true;

  if (searchEl) searchEl.addEventListener("input", () => onSearch(searchEl.value));

  if (sortEl) {
    sortEl.addEventListener("change", () => {
      lastSort = sortEl.value;
      fetchProducts({ reset: true });
    });
  }

  if (loadMoreBtn) loadMoreBtn.addEventListener("click", () => fetchProducts());

  fetchProducts({ reset: true });
}

// --- START ---
(async () => {
  const hasSession = await checkSession();
  if (hasSession) bootApp();

  sb.auth.onAuthStateChange(async () => {
    const ok = await checkSession();
    if (ok) bootApp();
  });
})();
