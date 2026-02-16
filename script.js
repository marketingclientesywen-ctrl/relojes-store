
// ==========================
// SAPI WATCHES - SCRIPT ROBUSTO
// Login Supabase + Roles + CatÃ¡logo
// ==========================

// -------- CONFIG (TU PROYECTO) --------
const SUPABASE_URL = "https://gwprzkuuxhnixovmniaj.supabase.co";
const SUPABASE_KEY = "sb_publishable_pd2KxCYegn_GRt5VCvjbnw_fBSIIu8r";

const TABLE_NAME = "base_productos";

// Columnas (tal cual las tienes en tu tabla)
const COL = {
  title: "Titulo",
  image: "Imagen",
  price: "Precio",
  url: "Titulo_URL",
};

// PaginaciÃ³n
const FIRST_LOAD = 10;
const PAGE_SIZE = 24;

// Debug
const DEBUG = true;

// -------- BOOTSTRAP --------
function log(...args) { if (DEBUG) console.log("[SW]", ...args); }
function warn(...args) { console.warn("[SW]", ...args); }

if (!window.supabase) {
  alert("No se ha cargado Supabase. Revisa el script CDN en index.html.");
  throw new Error("Supabase not found");
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// -------- UI --------
const $ = (id) => document.getElementById(id);

const loginScreen = $("loginScreen");
const appContent = $("appContent");
const topbar = $("topbar");

const loginForm = $("loginForm");
const loginMsg = $("loginMsg");
const emailEl = $("email");
const passEl = $("password");
const loginBtn = $("loginBtn");

const logoutBtn = $("logoutBtn");

const grid = $("grid");
const statusEl = $("status");
const searchEl = $("search");
const sortEl = $("sort");
const loadMoreBtn = $("loadMore");

const sessionState = $("sessionState");
const roleState = $("roleState");
const countState = $("countState");
const footerHint = $("footerHint");

// Estado
let isAdmin = false;
let page = 0;
let loading = false;
let lastQuery = "";
let lastSort = "name_asc";
let lastCount = 0;

// -------- HELPERS --------
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

function setView(isLoggedIn) {
  // Super literal: esto evita â€œcosas rarasâ€
  if (loginScreen) loginScreen.classList.toggle("hidden", isLoggedIn);
  if (appContent) appContent.classList.toggle("hidden", !isLoggedIn);
  if (topbar) topbar.classList.toggle("hidden", !isLoggedIn);
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

function setMeta({ session, role, count } = {}) {
  if (sessionState) sessionState.textContent = session ?? "â€”";
  if (roleState) roleState.textContent = role ?? "â€”";
  if (countState) countState.textContent = typeof count === "number" ? String(count) : "â€”";
  if (footerHint) footerHint.textContent = session ? "SesiÃ³n activa" : "SesiÃ³n no activa";
}

// -------- ROLE (profiles) --------
// Si no hay tabla profiles o no hay registro, no rompe: queda como "cliente".
async function loadRole(userId) {
  isAdmin = false;
  setMeta({ role: "cliente" });

  try {
    const { data, error } = await sb
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      warn("profiles role error:", error.message);
      return;
    }

    if (data?.role === "admin") {
      isAdmin = true;
      setMeta({ role: "admin" });
    }
  } catch (e) {
    warn("loadRole exception:", e);
  }
}

// -------- CARD --------
function productCard(p) {
  const title = escapeHtml(p?.[COL.title] ?? "Sin tÃ­tulo");
  const img = p?.[COL.image] ? escapeHtml(p[COL.image]) : "";
  const url = p?.[COL.url] ? escapeHtml(p[COL.url]) : "";
  const price = escapeHtml(p?.[COL.price] ?? "");

  return `
    <article class="card">
      <div class="card__img">
        ${
          img
            ? `<img src="${img}" alt="${title}" loading="lazy"
                 onerror="this.remove(); this.parentElement.innerHTML='<div class=&quot;img__placeholder&quot;>Imagen no disponible</div>';" />`
            : `<div class="img__placeholder">Sin imagen</div>`
        }
      </div>
      <div class="card__body">
        <h3 class="card__title">${title}</h3>
        ${price ? `<div class="card__price">${price}</div>` : `<div class="card__price">â€”</div>`}
        ${
          isAdmin && url
            ? `<a class="card__link" href="${url}" target="_blank" rel="noopener">Ver producto â†’</a>`
            : `<span class="card__link" style="opacity:.55; pointer-events:none;">Solo admin</span>`
        }
      </div>
    </article>
  `;
}

// -------- FETCH PRODUCTOS --------
async function fetchProducts({ reset = false } = {}) {
  if (loading) return;
  loading = true;

  if (reset) {
    page = 0;
    lastCount = 0;
    if (grid) grid.innerHTML = "";
    if (loadMoreBtn) loadMoreBtn.disabled = false;
  }

  setStatus("Cargandoâ€¦");
  if (loadMoreBtn) loadMoreBtn.disabled = true;

  const size = page === 0 ? FIRST_LOAD : PAGE_SIZE;
  const from = page === 0 ? 0 : FIRST_LOAD + (page - 1) * PAGE_SIZE;
  const to = from + size - 1;

  try {
    let q = sb.from(TABLE_NAME).select("*").range(from, to);

    const term = (lastQuery || "").trim();
    if (term) q = q.ilike(COL.title, `%${term}%`);

    q = applySort(q, lastSort);

    const { data, error } = await q;

    if (error) {
      console.error("Supabase error:", error);
      setStatus("Error cargando productos.");
      if (loadMoreBtn) loadMoreBtn.disabled = false;
      loading = false;
      return;
    }

    if (!data || data.length === 0) {
      setStatus(reset ? "No hay resultados." : "No hay mÃ¡s productos.");
      if (loadMoreBtn) loadMoreBtn.disabled = true;
      setMeta({ count: lastCount });
      loading = false;
      return;
    }

    lastCount += data.length;
    setMeta({ count: lastCount });

    if (grid) grid.insertAdjacentHTML("beforeend", data.map(productCard).join(""));
    page += 1;

    setStatus("");
    if (loadMoreBtn) loadMoreBtn.disabled = false;
    loading = false;

  } catch (e) {
    console.error("fetchProducts exception:", e);
    setStatus("Error inesperado cargando productos.");
    if (loadMoreBtn) loadMoreBtn.disabled = false;
    loading = false;
  }
}

// -------- BOOT --------
async function boot() {
  log("bootâ€¦");

  // 1) comprobar sesiÃ³n
  const { data, error } = await sb.auth.getSession();
  if (error) warn("getSession error:", error.message);

  const session = data?.session;

  if (!session) {
    log("Sin sesiÃ³n â†’ mostrar login");
    setView(false);
    setMeta({ session: "no", role: "â€”", count: 0 });
    return;
  }

  log("Con sesiÃ³n â†’ entrar app");
  setView(true);
  setMeta({ session: "sÃ­" });

  await loadRole(session.user.id);
  await fetchProducts({ reset: true });
}

// -------- EVENTS --------
// Login
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showLoginMsg("");

    const email = (emailEl?.value || "").trim();
    const password = (passEl?.value || "").trim();

    if (!email || !password) {
      showLoginMsg("Rellena email y contraseÃ±a.");
      return;
    }

    if (loginBtn) loginBtn.disabled = true;

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (loginBtn) loginBtn.disabled = false;

    if (error) {
      warn("login error:", error.message);
      showLoginMsg("Credenciales incorrectas o usuario no existe.");
      return;
    }

    // NO hacemos setView aquÃ­: lo hace onAuthStateChange (mÃ¡s fiable)
  });
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await sb.auth.signOut();
  });
}

// Search / Sort / Load more
let t = null;
function onSearch(v) {
  clearTimeout(t);
  t = setTimeout(() => {
    lastQuery = v;
    fetchProducts({ reset: true });
  }, 250);
}

if (searchEl) searchEl.addEventListener("input", () => onSearch(searchEl.value));

if (sortEl) {
  sortEl.addEventListener("change", () => {
    lastSort = sortEl.value;
    fetchProducts({ reset: true });
  });
}

if (loadMoreBtn) loadMoreBtn.addEventListener("click", () => fetchProducts());

// SesiÃ³n reactiva (esto evita â€œcosas rarasâ€)
sb.auth.onAuthStateChange(async (event, session) => {
  log("onAuthStateChange:", event, !!session);

  if (!session) {
    isAdmin = false;
    if (grid) grid.innerHTML = "";
    setStatus("");
    showLoginMsg("");
    setView(false);
    setMeta({ session: "no", role: "â€”", count: 0 });
    return;
  }

  setView(true);
  setMeta({ session: "sÃ­" });
  await loadRole(session.user.id);
  await fetchProducts({ reset: true });
});

// START
boot();
