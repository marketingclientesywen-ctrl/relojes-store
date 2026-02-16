// ==========================
// SAPI WATCHES - SCRIPT COMPLETO
// Login + Role (profiles) + Catálogo
// ==========================

// CONFIG
const SUPABASE_URL = "https://gwprzkuuxhnixovmniaj.supabase.co";
const SUPABASE_KEY = "sb_publishable_pd2KxCYegn_GRt5VCvjbnw_fBSIIu8r";
const TABLE_NAME = "base_productos";

const COL = {
  title: "Titulo",
  image: "Imagen",
  price: "Precio",
  url: "Titulo_URL",
};

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// UI Elements
const loginScreen = document.getElementById("loginScreen");
const appContent = document.getElementById("appContent");
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const searchEl = document.getElementById("search");
const sortEl = document.getElementById("sort");
const loadMoreBtn = document.getElementById("loadMore");

// Estado
let isAdmin = false;
let page = 0;
const FIRST_LOAD = 10;
const PAGE_SIZE = 24;
let loading = false;
let lastQuery = "";
let lastSort = "name_asc";

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
  }

  setStatus("Cargando…");
  if (loadMoreBtn) loadMoreBtn.disabled = true;

  const size = page === 0 ? FIRST_LOAD : PAGE_SIZE;
  const from = page === 0 ? 0 : FIRST_LOAD + (page - 1) * PAGE_SIZE;
  const to = from + size - 1;

  let q = sb.from(TABLE_NAME).select("*").range(from, to);

  const term = (lastQuery || "").trim();
  if (term) q = q.ilike(COL.title, `%${term}%`);

  q = applySort(q, lastSort);

  try {
    const { data, error } = await q;

    if (error) {
      console.error("Supabase error:", error);
      setStatus("Error cargando productos.");
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

    if (grid) grid.insertAdjacentHTML("beforeend", data.map(productCard).join(""));
    page += 1;

    setStatus("");
    if (loadMoreBtn) loadMoreBtn.disabled = false;
  } catch (err) {
    console.error("Error fetching products:", err);
    setStatus("Error de conexión.");
    if (loadMoreBtn) loadMoreBtn.disabled = false;
  } finally {
    loading = false;
  }
}

// --------------------------
// Role (profiles)
// --------------------------
async function loadRole(userId) {
  isAdmin = false;

  try {
    const { data, error } = await sb
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // La tabla profiles podría no existir - no es crítico
      console.info("ℹ️ Tabla profiles no disponible. Usuario = cliente.");
      return;
    }

    if (data?.role === "admin") {
      isAdmin = true;
      console.log("✅ Usuario admin");
    }
  } catch (err) {
    console.info("ℹ️ No se pudo verificar rol");
  }
}

// --------------------------
// Sesión
// --------------------------
async function boot() {
  try {
    const { data, error } = await sb.auth.getSession();
    
    if (error) {
      console.warn("getSession error:", error.message);
      setView(false);
      return;
    }

    const session = data?.session;

    if (!session) {
      setView(false);
      return;
    }

    setView(true);
    await loadRole(session.user.id);
    fetchProducts({ reset: true });
  } catch (err) {
    console.error("Error en boot:", err);
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
      const { error } = await sb.auth.signInWithPassword({ email, password });

      if (error) {
        console.warn("login error:", error.message);
        showLoginMsg("Credenciales incorrectas o usuario no existe.");
        if (loginBtn) loginBtn.disabled = false;
        return;
      }
    } catch (err) {
      console.error("Error en login:", err);
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
      await sb.auth.signOut();
    } catch (err) {
      console.error("Error en logout:", err);
    }
  });
}

// --------------------------
// Search / Sort / Load more
// --------------------------
let searchTimeout = null;

if (searchEl) {
  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      lastQuery = searchEl.value;
      fetchProducts({ reset: true });
    }, 300);
  });
}

if (sortEl) {
  sortEl.addEventListener("change", () => {
    lastSort = sortEl.value;
    fetchProducts({ reset: true });
  });
}

if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", () => fetchProducts());
}

// --------------------------
// Auth State Change
// --------------------------
sb.auth.onAuthStateChange(async (_event, session) => {
  try {
    if (!session) {
      isAdmin = false;
      if (grid) grid.innerHTML = "";
      setStatus("");
      showLoginMsg("");
      setView(false);
      return;
    }

    setView(true);
    await loadRole(session.user.id);
    fetchProducts({ reset: true });
  } catch (err) {
    console.error("Error en auth state:", err);
  }
});

// Iniciar
boot();
