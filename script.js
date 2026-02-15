// ==========================
// SAPI WATCHES - SCRIPT COMPLETO
// Login + Roles + Catálogo
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

// UI
const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");

const loginForm = document.getElementById("loginForm");
const loginBox = document.getElementById("loginBox");
const mainContent = document.getElementById("mainContent");
const loginError = document.getElementById("loginError");

let isAdmin = false;

let page = 0;
const FIRST_LOAD = 9;
const PAGE_SIZE = 24;
let loading = false;

// ==========================
// LOGIN
// ==========================

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    const { error } = await sb.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      loginError.textContent = "Credenciales incorrectas";
      return;
    }

    window.location.reload();
  });
}

// ==========================
// SESIÓN + ROL
// ==========================

async function checkSession() {
  const { data } = await sb.auth.getSession();

  if (!data.session) {
    if (loginBox) loginBox.style.display = "flex";
    if (mainContent) mainContent.style.display = "none";
    return;
  }

  if (loginBox) loginBox.style.display = "none";
  if (mainContent) mainContent.style.display = "block";

  const userId = data.session.user.id;

  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (profile?.role === "admin") {
    isAdmin = true;
  }

  fetchProducts({ reset: true });
}

// ==========================
// HELPERS
// ==========================

function setStatus(msg = "") {
  if (statusEl) statusEl.textContent = msg;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// ==========================
// TARJETA PRODUCTO
// ==========================

function productCard(p) {
  const title = escapeHtml(p?.[COL.title]);
  const img = p?.[COL.image] || "";
  const url = p?.[COL.url] || "";
  const price = p?.[COL.price] || "";

  return `
    <div class="product-card">
      <div class="aspect-[4/5] overflow-hidden mb-6 border border-white/10">
        ${
          img
            ? `<img src="${img}" class="w-full h-full object-cover" />`
            : `<div class="w-full h-full grid place-items-center text-slate-500">Sin imagen</div>`
        }
      </div>

      <h3 class="text-lg font-semibold">${title}</h3>
      <p class="text-slate-400">${price}</p>

      ${
        isAdmin && url
          ? `<a href="${url}" target="_blank" class="text-primary text-sm mt-2 inline-block">Ver producto</a>`
          : ""
      }
    </div>
  `;
}

// ==========================
// FETCH PRODUCTOS
// ==========================

async function fetchProducts({ reset = false } = {}) {
  if (loading) return;
  loading = true;

  if (reset) {
    page = 0;
    if (grid) grid.innerHTML = "";
  }

  const size = page === 0 ? FIRST_LOAD : PAGE_SIZE;
  const from = page === 0 ? 0 : FIRST_LOAD + (page - 1) * PAGE_SIZE;
  const to = from + size - 1;

  const { data, error } = await sb
    .from(TABLE_NAME)
    .select("*")
    .range(from, to);

  if (error) {
    setStatus("Error cargando productos");
    loading = false;
    return;
  }

  if (!data || data.length === 0) {
    setStatus("No hay más productos");
    loading = false;
    return;
  }

  grid.insertAdjacentHTML("beforeend", data.map(productCard).join(""));
  page++;
  loading = false;
}

// ==========================
// START
// ==========================

checkSession();
