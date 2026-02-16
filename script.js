// ==========================
// SAPI WATCHES - SCRIPT COMPLETO CORREGIDO
// ==========================

// CONFIG
const SUPABASE_URL = "https://gwprzkuuxhnixovmniaj.supabase.co";
const SUPABASE_KEY = "sb_publishable_pd2KxCYegn_GRt5VCvjbnw_fBSIIu8r";
const TABLE_NAME = "base_productos";
const BRANDS_TABLE = "brands";
const TABLE_PROFILES = "profiles";

const COL = {
  title: "Titulo",
  image: "Imagen",
  price: "Precio",
  url: "Titulo_URL",
  brand: "Marca",
};

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// UI Elements - Login
const loginScreen = document.getElementById("loginScreen");
const appContent = document.getElementById("appContent");
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

// UI Elements - App
const logoutBtn = document.getElementById("logoutBtn");
const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const searchEl = document.getElementById("search");
const searchMobile = document.getElementById("searchMobile");
const sortEl = document.getElementById("sort");
const loadMoreBtn = document.getElementById("loadMore");
const loadMoreMobile = document.getElementById("loadMoreMobile");

// UI Elements - Brands Desktop
const brandsBtn = document.getElementById("brandsBtn");
const brandsMenu = document.getElementById("brandsMenu");
const brandsGrid = document.getElementById("brandsGrid");
const brandsAll = document.getElementById("brandsAll");

// UI Elements - Brands Mobile
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileDrawer = document.getElementById("mobileDrawer");
const mobileDrawerBackdrop = document.getElementById("mobileDrawerBackdrop");
const mobileDrawerClose = document.getElementById("mobileDrawerClose");
const mobileBrandsGrid = document.getElementById("mobileBrandsGrid");
const mobileBrandsAll = document.getElementById("mobileBrandsAll");
const mobileBrandStatus = document.getElementById("mobileBrandStatus");

// UI Elements - Brands Strip
const brandsStrip = document.getElementById("brandsStrip");
const brandsStripPrev = document.getElementById("brandsStripPrev");
const brandsStripNext = document.getElementById("brandsStripNext");

// Estado
let isAdmin = false;
let currentUser = null;
let page = 0;
const FIRST_LOAD = 10;
const PAGE_SIZE = 24;
let loading = false;
let lastQuery = "";
let lastSort = "name_asc";
let selectedBrand = null;
let allBrands = [];
let stripIndex = 0;
const STRIP_SIZE = 3;

// --------------------------
// Helpers
// --------------------------
function setStatus(msg = "") {
  if (statusEl) statusEl.textContent = msg;
}

function showLoginMsg(msg = "") {
  if (!loginMsg) return;
  if (!msg) {
    loginMsg.classList.add("hidden");
    loginMsg.textContent = "";
    return;
  }
  loginMsg.classList.remove("hidden");
  loginMsg.textContent = msg;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applySort(q, sortValue) {
  switch (sortValue) {
    case "name_asc":
    default:
      return q.order(COL.title, { ascending: true });
  }
}

function setView(isLoggedIn) {
  if (loginScreen) loginScreen.classList.toggle("hidden", isLoggedIn);
  if (appContent) appContent.classList.toggle("hidden", !isLoggedIn);
}

// --------------------------
// Tarjeta producto
// --------------------------
function productCard(p) {
  const title = escapeHtml(p?.[COL.title] ?? "Sin título");
  const img = p?.[COL.image] ? escapeHtml(p[COL.image]) : "";
  const url = p?.[COL.url] ? escapeHtml(p[COL.url]) : "";
  const price = escapeHtml(p?.[COL.price] ?? "");

  return `
    <div class="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 hover:border-white/20 transition-all duration-300">
      <div class="bg-neutral-dark aspect-[4/5] overflow-hidden relative border-b border-white/10">
        ${
          img
            ? `<img src="${img}" alt="${title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy"
                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=&quot;w-full h-full grid place-items-center text-slate-500 text-sm&quot;>Imagen no disponible</div>';" />`
            : `<div class="w-full h-full grid place-items-center text-slate-500 text-sm">Sin imagen</div>`
        }
      </div>

      <div class="p-4">
        <h3 class="text-base font-bold mb-2 line-clamp-2">${title}</h3>
        ${price ? `<p class="text-slate-400 text-sm font-semibold">${price}</p>` : ""}

        ${
          isAdmin && url
            ? `<a href="${url}" target="_blank" rel="noopener"
                 class="inline-block mt-3 text-primary text-sm font-bold hover:underline">
                 Ver producto →
               </a>`
            : ""
        }
      </div>
    </div>
  `;
}

// --------------------------
// Fetch productos
// --------------------------
async function fetchProducts({ reset = false } = {}) {
  if (loading) return;
  loading = true;

  if (reset) {
    page = 0;
    if (grid) grid.innerHTML = "";
    if (loadMoreBtn) loadMoreBtn.disabled = false;
    if (loadMoreMobile) loadMoreMobile.disabled = false;
  }

  setStatus("Cargando…");
  if (loadMoreBtn) loadMoreBtn.disabled = true;
  if (loadMoreMobile) loadMoreMobile.disabled = true;

  const size = page === 0 ? FIRST_LOAD : PAGE_SIZE;
  const from = page === 0 ? 0 : FIRST_LOAD + (page - 1) * PAGE_SIZE;
  const to = from + size - 1;

  let q = sb.from(TABLE_NAME).select("*").range(from, to);

  // Filtro de búsqueda
  const term = (lastQuery || "").trim();
  if (term) q = q.ilike(COL.title, `%${term}%`);

  // Filtro de marca
  if (selectedBrand) {
    q = q.eq(COL.brand, selectedBrand);
  }

  q = applySort(q, lastSort);

  try {
    const { data, error } = await q;

    if (error) {
      console.error("Supabase error:", error);
      setStatus("Error cargando productos.");
      if (loadMoreBtn) loadMoreBtn.disabled = false;
      if (loadMoreMobile) loadMoreMobile.disabled = false;
      loading = false;
      return;
    }

    if (!data || data.length === 0) {
      setStatus(reset ? "No hay resultados." : "No hay más productos.");
      if (loadMoreBtn) loadMoreBtn.disabled = true;
      if (loadMoreMobile) loadMoreMobile.disabled = true;
      loading = false;
      return;
    }

    if (grid) grid.insertAdjacentHTML("beforeend", data.map(productCard).join(""));
    page += 1;

    setStatus("");
    if (loadMoreBtn) loadMoreBtn.disabled = false;
    if (loadMoreMobile) loadMoreMobile.disabled = false;
  } catch (err) {
    console.error("Error fetching products:", err);
    setStatus("Error de conexión.");
    if (loadMoreBtn) loadMoreBtn.disabled = false;
    if (loadMoreMobile) loadMoreMobile.disabled = false;
  } finally {
    loading = false;
  }
}

// --------------------------
// Fetch Brands
// --------------------------
async function fetchBrands() {
  try {
    const { data, error } = await sb
      .from(BRANDS_TABLE)
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error cargando marcas:", error);
      // Si no existe la tabla brands, continuar sin error
      allBrands = [];
      return;
    }

    allBrands = data || [];
    renderBrandsDesktop();
    renderBrandsMobile();
    renderBrandsStrip();
  } catch (err) {
    console.error("Error fetching brands:", err);
    allBrands = [];
  }
}

function brandCard(brand, isMobile = false) {
  const name = escapeHtml(brand.name || "");
  const logo = brand.logo ? escapeHtml(brand.logo) : "";
  
  return `
    <button 
      class="brand-card group bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/40 transition-all duration-300 p-4 text-left ${
        selectedBrand === brand.name ? "border-primary bg-primary/10" : ""
      }"
      data-brand="${name}"
      data-mobile="${isMobile}"
      type="button"
    >
      ${
        logo
          ? `<img src="${logo}" alt="${name}" class="h-8 w-auto mb-2 opacity-80 group-hover:opacity-100 transition" />`
          : `<div class="h-8 flex items-center mb-2"><span class="text-sm font-bold text-slate-400">${name}</span></div>`
      }
      <div class="text-xs text-slate-500 uppercase tracking-wider">${name}</div>
    </button>
  `;
}

function renderBrandsDesktop() {
  if (!brandsGrid) return;
  
  if (allBrands.length === 0) {
    brandsGrid.innerHTML = '<div class="text-slate-500 text-xs">No hay marcas disponibles</div>';
    return;
  }

  brandsGrid.innerHTML = allBrands.map(b => brandCard(b, false)).join("");
  attachBrandListeners();
}

function renderBrandsMobile() {
  if (!mobileBrandsGrid) return;
  
  if (allBrands.length === 0) {
    mobileBrandsGrid.innerHTML = '<div class="text-slate-500 text-xs">No hay marcas disponibles</div>';
    return;
  }

  mobileBrandsGrid.innerHTML = allBrands.map(b => brandCard(b, true)).join("");
  attachBrandListeners();
}

function renderBrandsStrip() {
  if (!brandsStrip) return;
  
  if (allBrands.length === 0) {
    brandsStrip.innerHTML = '<div class="text-slate-500 text-xs col-span-3">No hay marcas disponibles</div>';
    return;
  }

  const visible = allBrands.slice(stripIndex, stripIndex + STRIP_SIZE);
  brandsStrip.innerHTML = visible.map(b => brandCard(b, false)).join("");
  attachBrandListeners();
  
  // Update navigation buttons
  if (brandsStripPrev) brandsStripPrev.disabled = stripIndex === 0;
  if (brandsStripNext) brandsStripNext.disabled = stripIndex + STRIP_SIZE >= allBrands.length;
}

function attachBrandListeners() {
  document.querySelectorAll(".brand-card").forEach(btn => {
    btn.addEventListener("click", () => {
      const brand = btn.dataset.brand;
      selectBrand(brand);
      
      // Cerrar drawer mobile si está abierto
      if (btn.dataset.mobile === "true" && mobileDrawer) {
        mobileDrawer.classList.add("hidden");
      }
      
      // Cerrar menú desktop si está abierto
      if (btn.dataset.mobile === "false" && brandsMenu) {
        brandsMenu.classList.add("hidden");
      }
    });
  });
}

function selectBrand(brand) {
  selectedBrand = brand;
  fetchProducts({ reset: true });
  
  // Update UI
  renderBrandsDesktop();
  renderBrandsMobile();
  renderBrandsStrip();
  
  if (mobileBrandStatus) {
    mobileBrandStatus.textContent = `Filtrando: ${brand}`;
  }
}

function clearBrandFilter() {
  selectedBrand = null;
  fetchProducts({ reset: true });
  
  renderBrandsDesktop();
  renderBrandsMobile();
  renderBrandsStrip();
  
  if (mobileBrandStatus) {
    mobileBrandStatus.textContent = "";
  }
}

// --------------------------
// Brands UI Controls
// --------------------------

// Desktop dropdown
if (brandsBtn && brandsMenu) {
  brandsBtn.addEventListener("click", () => {
    brandsMenu.classList.toggle("hidden");
  });

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (!brandsBtn.contains(e.target) && !brandsMenu.contains(e.target)) {
      brandsMenu.classList.add("hidden");
    }
  });
}

if (brandsAll) {
  brandsAll.addEventListener("click", () => {
    clearBrandFilter();
    if (brandsMenu) brandsMenu.classList.add("hidden");
  });
}

// Mobile drawer
if (mobileMenuBtn && mobileDrawer) {
  mobileMenuBtn.addEventListener("click", () => {
    mobileDrawer.classList.remove("hidden");
  });
}

if (mobileDrawerClose) {
  mobileDrawerClose.addEventListener("click", () => {
    if (mobileDrawer) mobileDrawer.classList.add("hidden");
  });
}

if (mobileDrawerBackdrop) {
  mobileDrawerBackdrop.addEventListener("click", () => {
    if (mobileDrawer) mobileDrawer.classList.add("hidden");
  });
}

if (mobileBrandsAll) {
  mobileBrandsAll.addEventListener("click", () => {
    clearBrandFilter();
    if (mobileDrawer) mobileDrawer.classList.add("hidden");
  });
}

// Strip navigation
if (brandsStripPrev) {
  brandsStripPrev.addEventListener("click", () => {
    if (stripIndex > 0) {
      stripIndex -= STRIP_SIZE;
      renderBrandsStrip();
    }
  });
}

if (brandsStripNext) {
  brandsStripNext.addEventListener("click", () => {
    if (stripIndex + STRIP_SIZE < allBrands.length) {
      stripIndex += STRIP_SIZE;
      renderBrandsStrip();
    }
  });
}

// --------------------------
// Role (profiles) - CORREGIDO
// --------------------------
async function loadRole(userId) {
  isAdmin = false;

  if (!userId) {
    console.warn("⚠️ No se proporcionó userId para verificar rol");
    return;
  }

  try {
    console.log("🔍 Buscando rol para user_id:", userId);
    
    const { data, error } = await sb
      .from(TABLE_PROFILES)
      .select("role")
      .eq("user_id", userId)  // ✅ CAMBIADO: usar "user_id" en lugar de "id"
      .maybeSingle();

    if (error) {
      console.error("❌ Error al consultar profiles:", error.message);
      console.info("ℹ️ Usuario sin perfil definido. Rol por defecto: client");
      return;
    }

    if (!data) {
      console.info("ℹ️ No existe registro en profiles para este usuario. Rol por defecto: client");
      return;
    }

    const role = (data.role || "").toLowerCase().trim();
    console.log("📋 Rol encontrado:", role);

    if (role === "admin") {
      isAdmin = true;
      console.log("✅ Usuario identificado como ADMIN");
    } else {
      console.log("ℹ️ Usuario identificado como CLIENT");
    }
  } catch (err) {
    console.error("❌ Excepción en loadRole:", err);
  }
}

// --------------------------
// Sesión
// --------------------------
async function boot() {
  try {
    const { data, error } = await sb.auth.getSession();
    
    if (error) {
      console.warn("❌ getSession error:", error.message);
      setView(false);
      return;
    }

    const session = data?.session;

    if (!session) {
      console.log("ℹ️ No hay sesión activa");
      setView(false);
      return;
    }

    currentUser = session.user;
    console.log("🔑 Sesión activa - User ID:", currentUser.id);
    console.log("📧 Email:", currentUser.email);
    
    setView(true);
    await loadRole(currentUser.id);
    await fetchBrands();
    fetchProducts({ reset: true });
  } catch (err) {
    console.error("❌ Error en boot:", err);
    setView(false);
  }
}

// --------------------------
// Login
// --------------------------
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showLoginMsg("");

    const email = (emailEl?.value || "").trim();
    const password = (passEl?.value || "").trim();

    if (!email || !password) {
      showLoginMsg("Rellena email y contraseña.");
      return;
    }

    if (loginBtn) loginBtn.disabled = true;

    try {
      console.log("🔐 Intentando login para:", email);
      
      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error) {
        console.warn("❌ Login error:", error.message);
        showLoginMsg("Credenciales incorrectas o usuario no existe.");
        if (loginBtn) loginBtn.disabled = false;
        return;
      }

      console.log("✅ Login exitoso");
      // El onAuthStateChange manejará el resto
    } catch (err) {
      console.error("❌ Error en login:", err);
      showLoginMsg("Error de conexión.");
      if (loginBtn) loginBtn.disabled = false;
    }
  });
}

// --------------------------
// Logout
// --------------------------
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      console.log("👋 Cerrando sesión...");
      await sb.auth.signOut();
      console.log("✅ Sesión cerrada");
    } catch (err) {
      console.error("❌ Error en logout:", err);
    }
  });
}

// --------------------------
// Search / Sort / Load more
// --------------------------
let searchTimeout = null;

function setupSearch(element) {
  if (!element) return;
  
  element.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      lastQuery = element.value;
      fetchProducts({ reset: true });
    }, 300);
  });
}

setupSearch(searchEl);
setupSearch(searchMobile);

if (sortEl) {
  sortEl.addEventListener("change", () => {
    lastSort = sortEl.value;
    fetchProducts({ reset: true });
  });
}

if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", () => fetchProducts());
}

if (loadMoreMobile) {
  loadMoreMobile.addEventListener("click", () => fetchProducts());
}

// --------------------------
// Auth State Change
// --------------------------
sb.auth.onAuthStateChange(async (event, session) => {
  try {
    console.log("🔄 Auth state changed:", event);
    
    if (!session) {
      console.log("ℹ️ Sesión cerrada - limpiando estado");
      isAdmin = false;
      currentUser = null;
      selectedBrand = null;
      allBrands = [];
      if (grid) grid.innerHTML = "";
      setStatus("");
      showLoginMsg("");
      setView(false);
      return;
    }

    currentUser = session.user;
    console.log("🔑 Sesión actualizada - User ID:", currentUser.id);
    console.log("📧 Email:", currentUser.email);
    
    setView(true);
    await loadRole(currentUser.id);
    await fetchBrands();
    fetchProducts({ reset: true });
  } catch (err) {
    console.error("❌ Error en auth state change:", err);
  }
});

// Iniciar aplicación
console.log("🚀 Iniciando Sapi Watches...");
boot();
