// ==========================
// Sapi Watches - Supabase Catalog
// ==========================

// CONFIG
const SUPABASE_URL = "https://gwprzkuuxhnixovmniaj.supabase.co";
const SUPABASE_KEY = "sb_publishable_pd2KxCYegn_GRt5VCvjbnw_fBSIIu8r";
const TABLE_NAME = "base_productos";

// Columnas EXACTAS según tu tabla (con mayúsculas)
const COL = {
  title: "Titulo",
  image: "Imagen",
  price: "Precio",
  url: "Titulo_URL",
};

// INIT
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// UI
const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");

const searchEl = document.getElementById("search");
const searchMobileEl = document.getElementById("searchMobile");

const sortEl = document.getElementById("sort");

const loadMoreBtn = document.getElementById("loadMore");
const loadMoreMobileBtn = document.getElementById("loadMoreMobile");

let page = 0;
const PAGE_SIZE = 24;
let loading = false;

let lastQuery = "";
let lastSort = "name_asc";

function setStatus(msg = "") {
  if (statusEl) statusEl.textContent = msg;
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
  // Tu scraping trae "Prices on Login" -> lo convertimos a algo más bonito
  if (/prices on login/i.test(raw)) return "Precio bajo consulta";
  return raw;
}

function productCard(p) {
  const title = escapeHtml(p[COL.title] ?? "Sin título");
  const img = p[COL.image] ? escapeHtml(p[COL.image]) : "";
  const url = p[COL.url] ? escapeHtml(p[COL.url]) : "";
  const priceText = escapeHtml(normalizePrice(p[COL.price]));

  return `
    <div class="product-card group">
      <div class="bg-neutral-dark aspect-[4/5] overflow-hidden mb-8 relative border border-white/5 shadow-2xl">
        ${
          img
            ? `<img src="${img}" alt="${title}" class="w-full h-full object-cover transition-transform duration-1000 grayscale group-hover:grayscale-0" loading="lazy" />`
            : `<div class="w-full h-full grid place-items-center text-slate-500 text-sm">Sin imagen</div>`
        }
      </div>

      <div class="space-y-4">
        <div class="flex justify-between items-baseline gap-4">
          <h3 class="text-xl font-medium tracking-tight group-hover:text-primary transition-colors line-clamp-2">${title}</h3>
          ${priceText ? `<span class="text-lg font-light text-slate-400 whitespace-nowrap">${priceText}</span>` : ""}
        </div>

<p class="text-slate-500 uppercase tracking-[0.2em] text-[10px]">
  ${escapeHtml(p?.brands?.name ?? "Sin marca")}
</p>

        ${
          url
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

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

let q = sb
  .from(TABLE_NAME)
  .select(`*, brands(name)`)
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

  grid.insertAdjacentHTML("beforeend", data.map(productCard).join(""));
  page += 1;

  setStatus("");
  if (loadMoreBtn) loadMoreBtn.disabled = false;
  if (loadMoreMobileBtn) loadMoreMobileBtn.disabled = false;
  loading = false;
}

// Events
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

// Start
fetchProducts({ reset: true });
