// ==========================
// Sapi Watches (GitHub Pages) + Supabase Auth + Roles
// ==========================

// CONFIG
const SUPABASE_URL = "https://gwprzkuuxhnixovmniaj.supabase.co";
const SUPABASE_KEY = "TU_SB_PUBLISHABLE_KEY_AQUI"; // <-- pon tu publishable key
const TABLE_NAME = "base_productos";

const COL = {
  title: "Titulo",
  image: "Imagen",
  price: "Precio",
  url: "Titulo_URL",
};

// INIT
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// UI (catalog)
const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const searchEl = document.getElementById("search");
const searchMobileEl = document.getElementById("searchMobile");
const sortEl = document.getElementById("sort");
const loadMoreBtn = document.getElementById("loadMore");
const loadMoreMobileBtn = document.getElementById("loadMoreMobile");

// UI (auth)
const authPanel = document.getElementById("authPanel");
const authStatus = document.getElementById("authStatus");
const logoutBtn = document.getElementById("logoutBtn");

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const authMsg = document.getElementById("authMsg");

const registerForm = document.getElementById("registerForm");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");
const regMsg = document.getElementById("regMsg");

const toggleRegister = document.getElementById("toggleRegister");
const toggleLogin = document.getElementById("toggleLogin");

// State
let page = 0;
const FIRST_LOAD = 10;    // <-- inicio: 10 relojes
const PAGE_SIZE = 24;     // <-- después: 24 por "cargar más"
let loading = false;
let lastQuery = "";
let lastSort = "name_asc";

let sessionUser = null;
let role = "guest"; // guest | client | admin
let isAdmin = false;

// Helpers
function setStatus(msg = "") {
  if (statusEl) statusEl.textContent = msg;
}

function setAuthMsg(msg = "", isError = false) {
  if (!authMsg) return;
  authMsg.textContent = msg;
  authMsg.className = "text-sm min-h-[18px] " + (isError ? "text-red-300" : "text-slate-400");
}

function setRegMsg(msg = "", isError = false) {
  if (!regMsg) return;
  regMsg.textContent = msg;
  regMsg.className = "text-sm min-h-[18px] " + (isError ? "text-red-300" : "text-slate-400");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizePrice(p) {
  const raw = String(p ?? "").trim();
  if (!raw) return "";
  if (/prices on login/i.test(raw)) return "Precio bajo consulta";
  return raw;
}

function applySort(q, sortValue) {
  switch (sortValue) {
    case "name_asc":
    default:
      return q.order(COL.title, { ascending: true });
  }
}

// ==========================
// AUTH + ROLE
// ==========================
async function refreshSessionAndRole() {
  const { data } = await sb.auth.getSession();
  sessionUser = data?.session?.user ?? null;

  if (!sessionUser) {
    role = "guest";
    isAdmin = false;
    if (authStatus) authStatus.textContent = "No has iniciado sesión";
    if (logoutBtn) logoutBtn.classList.add("hidden");
    if (authPanel) authPanel.classList.remove("hidden");
    return;
  }

  // User logged
  if (logoutBtn) logoutBtn.classList.remove("hidden");
  if (authPanel) authPanel.classList.add("hidden");

  // Lee role desde profiles (policy: select own)
  const { data: проф, error } = await sb
    .from("profiles")
    .select("role")
    .eq("user_id", sessionUser.id)
    .single();

  if (error) {
    // Si te falla aquí, es que la policy no deja o el profile no existe
    role = "client";
    isAdmin = false;
    if (authStatus) authStatus.textContent = `Sesión iniciada (${sessionUser.email})`;
    return;
  }

  role = проф?.role || "client";
  isAdmin = role === "admin";
  if (authStatus) authStatus.textContent = `Sesión: ${sessionUser.email} · Rol: ${role}`;
}

if (toggleRegister) {
  toggleRegister.addEventListener("click", () => {
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    setAuthMsg("");
  });
}

if (toggleLogin) {
  toggleLogin.addEventListener("click", () => {
    registerForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
    setRegMsg("");
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAuthMsg("Entrando…");
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return setAuthMsg(error.message, true);

    setAuthMsg("");
    await refreshSessionAndRole();
    await fetchProducts({ reset: true });
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setRegMsg("Creando cuenta…");
    const email = regEmail.value.trim();
    const password = regPassword.value;

    const { error } = await sb.auth.signUp({ email, password });
    if (error) return setRegMsg(error.message, true);

    setRegMsg("Cuenta creada. Revisa tu email si te pide confirmación.");
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await sb.auth.signOut();
    await refreshSessionAndRole();
    await fetchProducts({ reset: true });
  });
}

// ==========================
// PRODUCT CARD (link solo admin)
// ==========================
function productCard(p) {
  const title = escapeHtml(p?.[COL.title] ?? "Sin título");
  const img = p?.[COL.image] ? escapeHtml(p[COL.image]) : "";
  const url = p?.[COL.url] ? escapeHtml(p[COL.url]) : "";
  const priceText = escapeHtml(normalizePrice(p?.[COL.price]));
  const brandName = escapeHtml(p?.brands?.name ?? "Sin marca");

  const adminLink = (isAdmin && url)
    ? `<a class="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] font-bold text-primary pt-4 border-b border-transparent hover:border-primary transition-all"
         href="${url}" target="_blank" rel="noopener">
         Ver producto <span class="material-symbols-outlined text-xs">arrow_forward</span>
       </a>`
    : "";

  return `
    <div class="product-card group">
      <div class="bg-neutral-dark aspect-[4/5] overflow-hidden mb-8 relative border border-white/5 shadow-2xl">
        ${
          img
            ? `<img src="${img}" alt="${title}" class="w-full h-full object-cover" loading="lazy"
                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=&quot;w-full h-full grid place-items-center text-slate-500 text-sm&quot;>Imagen no disponible</div>';" />`
            : `<div class="w-full h-full grid place-items-center text-slate-500 text-sm">Sin imagen</div>`
        }
      </div>

      <div class="space-y-4">
        <div class="flex justify-between items-baseline gap-4">
          <h3 class="text-xl font-medium tracking-tight group-hover:text-primary transition-colors line-clamp-2">${title}</h3>
          ${priceText ? `<span class="text-lg font-light text-slate-400 whitespace-nowrap">${priceText}</span>` : ""}
        </div>

        <p class="text-slate-500 uppercase tracking-[0.2em] text-[10px]">${brandName}</p>
        ${adminLink}
      </div>
    </div>
  `;
}

// ==========================
// FETCH PRODUCTS
// ==========================
async function fetchProducts({ reset = false } = {}) {
  if (loading) return;
  loading = true;

  if (reset) {
    page = 0;
    if (grid) grid.innerHTML = "";
    if (loadMoreBtn) loadMoreBtn.disabled = false;
    if (loadMoreMobileBtn) loadMoreMobileBtn.disabled = false;
  }

  setStatus("Cargando…");
  if (loadMoreBtn) loadMoreBtn.disabled = true;
  if (loadMoreMobileBtn) loadMoreMobileBtn.disabled = true;

  const size = (page === 0) ? FIRST_LOAD : PAGE_SIZE;
  const from = (page === 0) ? 0 : (FIRST_LOAD + (page - 1) * PAGE_SIZE);
  const to = from + size - 1;

  let q = sb
    .from(TABLE_NAME)
    .select(`*, brands:brand_id(name)`)
    .range(from, to);

  const term = (lastQuery || "").trim();
  if (term) q = q.ilike(COL.title, `%${term}%`);

  q = applySort(q, lastSort);

  const { data, error } = await q;

  if (error) {
    console.error("Supabase error:", error);
    setStatus(`Error: ${error.message}`);
    if (loadMoreBtn) loadMoreBtn.disabled = false;
    if (loadMoreMobileBtn) loadMoreMobileBtn.disabled = false;
    loading = false;
    return;
  }

  if (!data || data.length === 0) {
    setStatus(reset ? "No hay resultados." : "No hay más productos.");
    if (loadMoreBtn) loadMoreBtn.disabled = true;
    if (loadMoreMobileBtn) loadMoreMobileBtn.disabled = true;
    loading = false;
    return;
  }

  if (grid) grid.insertAdjacentHTML("beforeend", data.map(productCard).join(""));
  page += 1;

  setStatus("");
  if (loadMoreBtn) loadMoreBtn.disabled = false;
  if (loadMoreMobileBtn) loadMoreMobileBtn.disabled = false;
  loading = false;
}

// ==========================
// EVENTS (search/sort/load more)
// ==========================
let t = null;
function onSearch(value) {
  clearTimeout(t);
  t = setTimeout(() => {
    lastQuery = value;
    fetchProducts({ reset: true });
  }, 250);
}

if (searchEl) searchEl.addEventListener("input", () => onSearch(searchEl.value));
if (searchMobileEl) searchMobileEl.addEventListener("input", () => onSearch(searchMobileEl.value));

if (sortEl) {
  sortEl.addEventListener("change", () => {
    lastSort = sortEl.value;
    fetchProducts({ reset: true });
  });
}

if (loadMoreBtn) loadMoreBtn.addEventListener("click", () => fetchProducts());
if (loadMoreMobileBtn) loadMoreMobileBtn.addEventListener("click", () => fetchProducts());

// Listen auth changes (por si refresca token)
sb.auth.onAuthStateChange(async () => {
  await refreshSessionAndRole();
});

// START
(async function start() {
  await refreshSessionAndRole();
  await fetchProducts({ reset: true });
})();
