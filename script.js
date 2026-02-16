// ==========================
// Sapi Watches - Login + Catalog + Brands
// ==========================

// -------- CONFIG --------
const SUPABASE_URL = "https://gwprzkuuxhnixovmniaj.supabase.co";
const SUPABASE_KEY = "sb_publishable_pd2KxCYegn_GRt5VCvjbnw_fBSIIu8r";

const TABLE_PRODUCTS = "base_productos";
const TABLE_BRANDS = "brands";
const TABLE_PROFILES = "profiles"; // crea esta tabla (id uuid, role text)

const COL = {
  title: "Titulo",
  image: "Imagen",
  price: "Precio",
  url: "Titulo_URL",
};

// Brands columns
const BRAND = {
  id: "id",
  name: "name",
  logo: "logo_url",
};

// Paging
let page = 0;
const FIRST_LOAD = 10;      // 👈 inicio solo 10
const PAGE_SIZE = 24;       // luego cargar más
let loading = false;

// Filters
let lastQuery = "";
let lastSort = "name_asc";
let currentBrandId = null; // null = todas

// Auth / role
let isAdmin = false;

// -------- SUPABASE --------
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// -------- UI --------
const loginScreen = document.getElementById("loginScreen");
const appContent = document.getElementById("appContent");

const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");

const searchEl = document.getElementById("search");
const searchMobileEl = document.getElementById("searchMobile");
const sortEl = document.getElementById("sort");

const loadMoreBtn = document.getElementById("loadMore");
const loadMoreMobileBtn = document.getElementById("loadMoreMobile");

// Desktop brands dropdown
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

// Brands strip
const brandsStrip = document.getElementById("brandsStrip");
const brandsStripPrev = document.getElementById("brandsStripPrev");
const brandsStripNext = document.getElementById("brandsStripNext");
let allBrands = [];
let brandStripIndex = 0; // 0,3,6,...

// -------- Helpers --------
function setStatus(msg = "") {
  if (statusEl) statusEl.textContent = msg;
}

function showLogin(msg = "") {
  if (appContent) appContent.classList.add("hidden");
  if (loginScreen) loginScreen.classList.remove("hidden");
  if (msg) showLoginMsg(msg);
}

function showApp() {
  if (loginScreen) loginScreen.classList.add("hidden");
  if (appContent) appContent.classList.remove("hidden");
}

function showLoginMsg(msg) {
  if (!loginMsg) return;
  loginMsg.textContent = msg;
  loginMsg.classList.remove("hidden");
}

function hideLoginMsg() {
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

function normalizePriceToEuroPlus5(rawPrice) {
  const raw = String(rawPrice ?? "").trim();
  if (!raw) return "";

  if (/prices on login/i.test(raw)) return "Precio bajo consulta";

  // Busca un número tipo 138 o 138.50
  const m = raw.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return raw;

  let n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return raw;

  // Si detecta $ o USD -> +5 y €
  if (/\$|usd/i.test(raw)) {
    n = n + 5;
    const out = n % 1 === 0 ? String(n.toFixed(0)) : String(n.toFixed(2));
    return `${out} €`;
  }

  // Si ya viene en € lo deja
  if (/€|eur/i.test(raw)) return raw;

  // Si no sabe la moneda, lo deja tal cual
  return raw;
}

// -------- Auth role --------
// profiles: id(uuid) = auth.user.id, role(text) = 'admin' o 'client'
async function loadRoleForUser(user) {
  isAdmin = false;
  if (!user) return;

  const { data, error } = await sb
    .from(TABLE_PROFILES)
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // si no existe tabla o no hay fila, se queda como client
    console.warn("Role lookup:", error.message);
    isAdmin = false;
    return;
  }

  const role = (data?.role || "").toLowerCase().trim();
  isAdmin = role === "admin";
}

// -------- Brands UI --------
function closeBrandsMenu() {
  if (!brandsMenu) return;
  brandsMenu.classList.add("hidden");
}
function toggleBrandsMenu() {
  if (!brandsMenu) return;
  brandsMenu.classList.toggle("hidden");
}

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

  if (!allBrands.length) {
    brandsStrip.innerHTML = `<div class="text-slate-500 text-xs">No hay marcas.</div>`;
    if (brandsStripPrev) brandsStripPrev.disabled = true;
    if (brandsStripNext) brandsStripNext.disabled = true;
    return;
  }

  const slice = allBrands.slice(brandStripIndex, brandStripIndex + 3);
  brandsStrip.innerHTML = slice.map(brandCard).join("");

  bindBrandClicks(brandsStrip, (id) => {
    currentBrandId = id;
    fetchProducts({ reset: true });
    // baja al catálogo para que “se note”
    document.getElementById("coleccion")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if (brandsStripPrev) brandsStripPrev.disabled = brandStripIndex <= 0;
  if (brandsStripNext) brandsStripNext.disabled = brandStripIndex + 3 >= allBrands.length;
}

async function loadBrands() {
  // placeholders
  if (brandsGrid) brandsGrid.innerHTML = `<div class="text-slate-500 text-xs">Cargando marcas…</div>`;
  if (mobileBrandsGrid) mobileBrandsGrid.innerHTML = `<div class="text-slate-500 text-xs">Cargando marcas…</div>`;
  if (brandsStrip) brandsStrip.innerHTML = `<div class="text-slate-500 text-xs">Cargando marcas…</div>`;

  const { data, error } = await sb
    .from(TABLE_BRANDS)
    .select(`${BRAND.id}, ${BRAND.name}, ${BRAND.logo}`)
    .order(BRAND.name, { ascending: true });

  if (error) {
    console.error("Brands error:", error);
    if (brandsGrid) brandsGrid.innerHTML = `<div class="text-slate-500 text-xs">Error cargando marcas.</div>`;
    if (mobileBrandsGrid) mobileBrandsGrid.innerHTML = `<div class="text-slate-500 text-xs">Error cargando marcas.</div>`;
    if (brandsStrip) brandsStrip.innerHTML = `<div class="text-slate-500 text-xs">Error cargando marcas.</div>`;
    return;
  }

  allBrands = data || [];
  brandStripIndex = 0;

  const html = allBrands.map(brandCard).join("");

  if (brandsGrid) brandsGrid.innerHTML = html;
  if (mobileBrandsGrid) mobileBrandsGrid.innerHTML = html;

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

  if (mobileBrandStatus) mobileBrandStatus.textContent = `${allBrands.length} marcas`;

  renderBrandsStrip();
}

// -------- Products --------
function productCard(p) {
  const title = escapeHtml(p?.[COL.title] ?? "Sin título");
  const img = p?.[COL.image] ? escapeHtml(p[COL.image]) : "";
  const url = p?.[COL.url] ? escapeHtml(p[COL.url]) : "";
  const priceText = escapeHtml(normalizePriceToEuroPlus5(p?.[COL.price]));
  const brandName = escapeHtml(p?.brands?.name ?? "Sin marca");

  return `
    <div class="product-card group">
      <div class="bg-neutral-dark aspect-[4/5] overflow-hidden mb-8 relative border border-white/5 shadow-2xl">
        ${
          img
            ? `<img src="${img}" alt="${title}" class="w-full h-full object-cover transition-transform duration-700"
                 loading="lazy"
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
          isAdmin && url
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
    .from(TABLE_PRODUCTS)
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

  grid.insertAdjacentHTML("beforeend", data.map(productCard).join(""));
  page += 1;

  setStatus("");
  if (loadMoreBtn) loadMoreBtn.disabled = false;
  if (loadMoreMobileBtn) loadMoreMobileBtn.disabled = false;
  loading = false;
}

// -------- Events --------
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

// Brands strip prev/next
if (brandsStripPrev) {
  brandsStripPrev.addEventListener("click", () => {
    brandStripIndex = Math.max(0, brandStripIndex - 3);
    renderBrandsStrip();
  });
}
if (brandsStripNext) {
  brandsStripNext.addEventListener("click", () => {
    brandStripIndex = Math.min(allBrands.length - 1, brandStripIndex + 3);
    // ajustar a múltiplo de 3
    brandStripIndex = Math.floor(brandStripIndex / 3) * 3;
    renderBrandsStrip();
  });
}

// ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeBrandsMenu();
    closeMobileDrawer();
  }
});

// -------- Login / Logout --------
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideLoginMsg();

    const email = document.getElementById("email")?.value?.trim();
    const password = document.getElementById("password")?.value;

    if (!email || !password) {
      showLoginMsg("Rellena email y contraseña.");
      return;
    }

    loginBtn && (loginBtn.disabled = true);

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    loginBtn && (loginBtn.disabled = false);

    if (error) {
      showLoginMsg(error.message);
      return;
    }

    // data.session ya disparará onAuthStateChange, pero por si acaso:
    if (data?.session?.user) {
      await loadRoleForUser(data.session.user);
      showApp();
      await loadBrands();
      await fetchProducts({ reset: true });
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await sb.auth.signOut();
    isAdmin = false;
    currentBrandId = null;
    lastQuery = "";
    page = 0;
    showLogin();
  });
}

// -------- Boot --------
async function boot() {
  // Estado inicial
  const { data } = await sb.auth.getSession();
  const session = data?.session || null;

  if (!session) {
    showLogin();
    return;
  }

  await loadRoleForUser(session.user);
  showApp();
  await loadBrands();
  await fetchProducts({ reset: true });

  // Si cambia auth en caliente
  sb.auth.onAuthStateChange(async (_event, newSession) => {
    if (!newSession) {
      isAdmin = false;
      currentBrandId = null;
      showLogin();
      return;
    }
    await loadRoleForUser(newSession.user);
    showApp();
    await loadBrands();
    await fetchProducts({ reset: true });
  });
}

boot();
