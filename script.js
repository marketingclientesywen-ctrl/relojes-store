// script.js
// ==========================
// Sapi Watches - Catalog + Brands + Login (admin sees "Ver producto")
// ==========================

// CONFIG
const SUPABASE_URL = "https://gwprzkuuxhnixovmniaj.supabase.co";
const SUPABASE_KEY = "PASTE_YOUR_ANON_KEY_HERE"; // <- pon tu anon key real
const TABLE_NAME = "base_productos";

const COL = {
  title: "Titulo",
  image: "Imagen",
  price: "Precio",
  url: "Titulo_URL",
};

const BRAND = {
  table: "brands",
  id: "id",
  name: "name",
  logo: "logo_url",
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

// Brands dropdown (desktop)
const brandsBtn = document.getElementById("brandsBtn");
const brandsMenu = document.getElementById("brandsMenu");
const brandsGrid = document.getElementById("brandsGrid");
const brandsAllBtn = document.getElementById("brandsAll");

// Mobile drawer
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileDrawer = document.getElementById("mobileDrawer");
const mobileDrawerBackdrop = document.getElementById("mobileDrawerBackdrop");
const mobileDrawerClose = document.getElementById("mobileDrawerClose");
const mobileBrandsGrid = document.getElementById("mobileBrandsGrid");
const mobileBrandsAllBtn = document.getElementById("mobileBrandsAll");
const mobileBrandStatus = document.getElementById("mobileBrandStatus");

// Brands strip (3 en 3)
const brandsStrip = document.getElementById("brandsStrip");
const brandsStripPrev = document.getElementById("brandsStripPrev");
const brandsStripNext = document.getElementById("brandsStripNext");

// Auth modal
const authModal = document.getElementById("authModal");
const authBackdrop = document.getElementById("authBackdrop");
const authClose = document.getElementById("authClose");
const openAuth = document.getElementById("openAuth");
const openAuthMobile = document.getElementById("openAuthMobile");

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authStatus = document.getElementById("authStatus");
const roleBadge = document.getElementById("roleBadge");

// State
let currentBrandId = null;
let isAdmin = false;

let page = 0;
const FIRST_LOAD = 10;
const PAGE_SIZE = 24;
let loading = false;

let lastQuery = "";
let lastSort = "name_asc";

// Brands cache for strip
let brandsList = [];
let brandsStripIndex = 0;

// --------------------------
// Helpers
// --------------------------
function setStatus(msg = "") {
  if (statusEl) statusEl.textContent = msg;
}

function setAuthStatus(msg = "") {
  if (authStatus) authStatus.textContent = msg;
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

// --------------------------
// Auth (login / logout / role)
// --------------------------
function openAuthModal() {
  if (!authModal) return;
  authModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeAuthModal() {
  if (!authModal) return;
  authModal.classList.add("hidden");
  document.body.style.overflow = "";
}

async function detectRole() {
  const { data } = await sb.auth.getUser();
  const user = data?.user;

  if (!user) {
    isAdmin = false;
    if (roleBadge) roleBadge.textContent = "";
    if (logoutBtn) logoutBtn.classList.add("hidden");
    return;
  }

  // profiles: user_id (uuid) + role (text: 'admin' | 'client')
  const { data: prof, error } = await sb
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = (!error && prof?.role) ? prof.role : "client";
  isAdmin = role === "admin";

  if (roleBadge) roleBadge.textContent = isAdmin ? "ADMIN" : "CLIENTE";
  if (logoutBtn) logoutBtn.classList.remove("hidden");
}

async function login(email, password) {
  setAuthStatus("Entrando…");
  if (loginBtn) loginBtn.disabled = true;

  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    setAuthStatus(error.message);
    if (loginBtn) loginBtn.disabled = false;
    return false;
  }

  setAuthStatus("OK ✅");
  if (loginBtn) loginBtn.disabled = false;
  return true;
}

async function logout() {
  setAuthStatus("Cerrando sesión…");
  await sb.auth.signOut();
  setAuthStatus("");
  await detectRole();
  await fetchProducts({ reset: true });
}

// --------------------------
// Desktop dropdown
// --------------------------
function closeBrandsMenu() {
  if (!brandsMenu) return;
  brandsMenu.classList.add("hidden");
}
function toggleBrandsMenu() {
  if (!brandsMenu) return;
  brandsMenu.classList.toggle("hidden");
}

// --------------------------
// Mobile drawer
// --------------------------
function openMobileDrawer() {
  if (!mobileDrawer) return;
  mobileDrawer.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeMobileDrawer() {
  if (!mobileDrawer) return;
  mobileDrawer.classList.add("hidden");
  document.body.style.overflow = "";
}

// --------------------------
// Brands rendering
// --------------------------
function brandFallback(name) {
  const parts = String(name || "B").trim().split(/\s+/);
  const a = (parts[0]?.[0] || "B").toUpperCase();
  const b = (parts[1]?.[0] || "").toUpperCase();
  return (a + b).slice(0, 2);
}

function brandCard(b) {
  const name = escapeHtml(b?.[BRAND.name] ?? "Marca");
  const logo = b?.[BRAND.logo] ? escapeHtml(b[BRAND.logo]) : "";
  const id = b?.[BRAND.id];
  const fb = brandFallback(name);

  return `
    <button
      class="group text-left flex items-center gap-3 p-3 border border-white/10 hover:border-primary/60 hover:bg-white/5 transition"
      data-brand-id="${id}"
      type="button"
      title="${name}"
    >
      <div class="w-10 h-10 bg-white/5 border border-white/10 grid place-items-center overflow-hidden">
        ${
          logo
            ? `<img src="${logo}" alt="${name}" class="w-full h-full object-contain p-2 opacity-90 group-hover:opacity-100"
                 loading="lazy"
                 onerror="this.remove(); this.parentElement.innerHTML='<span class=&quot;text-xs font-bold text-slate-300&quot;'>${fb}</span>';">`
            : `<span class="text-xs font-bold text-slate-300">${fb}</span>`
        }
      </div>
      <div class="min-w-0">
        <div class="text-sm font-semibold tracking-tight group-hover:text-primary transition-colors truncate">${name}</div>
        <div class="text-[10px] uppercase tracking-[0.25em] text-slate-500">Ver relojes</div>
      </div>
    </button>
  `;
}

function bindBrandClicks(container, onPick) {
  if (!container) return;
  container.querySelectorAll("[data-brand-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-brand-id");
      onPick(id ? Number(id) : null);
    });
  });
}

function renderBrandsStrip() {
  if (!brandsStrip) return;
  if (!brandsList.length) {
    brandsStrip.innerHTML = `<div class="text-slate-500 text-xs">No hay marcas.</div>`;
    return;
  }

  const slice = brandsList.slice(brandsStripIndex, brandsStripIndex + 3);
  const html = slice.map(brandCard).join("");
  brandsStrip.innerHTML = html;

  bindBrandClicks(brandsStrip, (id) => {
    currentBrandId = id;
    fetchProducts({ reset: true });
    document.getElementById("coleccion")?.scrollIntoView({ behavior: "smooth" });
  });
}

function stripNext() {
  if (!brandsList.length) return;
  brandsStripIndex += 3;
  if (brandsStripIndex >= brandsList.length) brandsStripIndex = 0;
  renderBrandsStrip();
}

function stripPrev() {
  if (!brandsList.length) return;
  brandsStripIndex -= 3;
  if (brandsStripIndex < 0) {
    const r = brandsList.length % 3;
    brandsStripIndex = r === 0 ? brandsList.length - 3 : brandsList.length - r;
  }
  renderBrandsStrip();
}

async function loadBrands() {
  if (brandsGrid) brandsGrid.innerHTML = `<div class="text-slate-500 text-xs">Cargando marcas…</div>`;
  if (mobileBrandsGrid) mobileBrandsGrid.innerHTML = `<div class="text-slate-500 text-xs">Cargando marcas…</div>`;
  if (brandsStrip) brandsStrip.innerHTML = `<div class="text-slate-500 text-xs">Cargando marcas…</div>`;

  const { data, error } = await sb
    .from(BRAND.table)
    .select(`${BRAND.id}, ${BRAND.name}, ${BRAND.logo}`)
    .order(BRAND.name, { ascending: true });

  if (error) {
    console.error("Brands error:", error);
    if (brandsGrid) brandsGrid.innerHTML = `<div class="text-slate-500 text-xs">Error cargando marcas.</div>`;
    if (mobileBrandsGrid) mobileBrandsGrid.innerHTML = `<div class="text-slate-500 text-xs">Error cargando marcas.</div>`;
    if (brandsStrip) brandsStrip.innerHTML = `<div class="text-slate-500 text-xs">Error cargando marcas.</div>`;
    return;
  }

  brandsList = data || [];

  if (brandsGrid) brandsGrid.innerHTML = brandsList.map(brandCard).join("");
  if (mobileBrandsGrid) mobileBrandsGrid.innerHTML = brandsList.map(brandCard).join("");

  bindBrandClicks(brandsGrid, (id) => {
    currentBrandId = id;
    closeBrandsMenu();
    fetchProducts({ reset: true });
  });

  bindBrandClicks(mobileBrandsGrid, (id) => {
    currentBrandId = id;
    closeMobileDrawer();
    fetchProducts({ reset: true });
  });

  if (mobileBrandStatus) mobileBrandStatus.textContent = `${brandsList.length} marcas`;

  brandsStripIndex = 0;
  renderBrandsStrip();
}

// --------------------------
// Product card (admin-only link)
// --------------------------
function productCard(p) {
  const title = escapeHtml(p?.[COL.title] ?? "Sin título");
  const img = p?.[COL.image] ? escapeHtml(p[COL.image]) : "";
  const url = p?.[COL.url] ? escapeHtml(p[COL.url]) : "";
  const priceText = escapeHtml(normalizePrice(p?.[COL.price]));
  const brandName = escapeHtml(p?.brands?.name ?? "Sin marca");

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

        ${
          (isAdmin && url)
            ? `<a class="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] font-bold text-primary pt-4 border-b border-transparent hover:border-primary transition-all"
                 href="${url}" target="_blank" rel="noopener">
                 Ver producto <span class="material-symbols-outlined text-xs">arrow_forward</span>
               </a>`
            : ""
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

// --------------------------
// Fetch products (first load 10)
// --------------------------
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
  const from = page === 0 ? 0 : (FIRST_LOAD + (page - 1) * PAGE_SIZE);
  const to = from + size - 1;

  let q = sb
    .from(TABLE_NAME)
    .select(`*, brands:brand_id(name)`)
    .range(from, to);

  if (currentBrandId) q = q.eq("brand_id", currentBrandId);

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

// --------------------------
// Events
// --------------------------
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

// Desktop brands dropdown
if (brandsBtn) {
  brandsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleBrandsMenu();
  });
}
if (brandsAllBtn) {
  brandsAllBtn.addEventListener("click", () => {
    currentBrandId = null;
    closeBrandsMenu();
    fetchProducts({ reset: true });
  });
}
document.addEventListener("click", (e) => {
  if (!brandsMenu || !brandsBtn) return;
  const inside = brandsMenu.contains(e.target) || brandsBtn.contains(e.target);
  if (!inside) closeBrandsMenu();
});

// Mobile drawer
if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openMobileDrawer);
if (mobileDrawerBackdrop) mobileDrawerBackdrop.addEventListener("click", closeMobileDrawer);
if (mobileDrawerClose) mobileDrawerClose.addEventListener("click", closeMobileDrawer);

if (mobileBrandsAllBtn) {
  mobileBrandsAllBtn.addEventListener("click", () => {
    currentBrandId = null;
    closeMobileDrawer();
    fetchProducts({ reset: true });
  });
}

// Brands strip controls
if (brandsStripNext) brandsStripNext.addEventListener("click", stripNext);
if (brandsStripPrev) brandsStripPrev.addEventListener("click", stripPrev);

// Auth modal events
if (openAuth) openAuth.addEventListener("click", openAuthModal);
if (openAuthMobile) openAuthMobile.addEventListener("click", openAuthModal);
if (authBackdrop) authBackdrop.addEventListener("click", closeAuthModal);
if (authClose) authClose.addEventListener("click", closeAuthModal);

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await login(loginEmail.value.trim(), loginPassword.value);
    if (ok) {
      await detectRole();
      await fetchProducts({ reset: true });
      closeAuthModal();
    }
  });
}
if (logoutBtn) logoutBtn.addEventListener("click", logout);

// ESC closes menus + modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeBrandsMenu();
    closeMobileDrawer();
    closeAuthModal();
  }
});

// Keep UI in sync if session changes in another tab
sb.auth.onAuthStateChange(async () => {
  await detectRole();
  await fetchProducts({ reset: true });
});

// --------------------------
// START
// --------------------------
(async () => {
  await detectRole();
  await loadBrands();
  await fetchProducts({ reset: true });
})();
