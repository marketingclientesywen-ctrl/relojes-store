(() => {
  // Evita doble inicialización si el script se carga 2 veces
  if (window.__relojesStoreInit) return;
  window.__relojesStoreInit = true;

  // ==========================
  // 1) CONFIG
  // ==========================
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

  // ==========================
  // 2) INIT SUPABASE
  // ==========================
  if (!window.supabase) {
    console.error("Supabase SDK no cargado. Falta el <script> del CDN.");
    return;
  }

  // Reutiliza el cliente si ya existe
  window.__sbClient = window.__sbClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const sb = window.__sbClient;

  // ==========================
  // 3) UI
  // ==========================
  const grid = document.getElementById("grid");
  const statusEl = document.getElementById("status");
  const searchEl = document.getElementById("search");
  const sortEl = document.getElementById("sort");
  const loadMoreBtn = document.getElementById("loadMore");

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

  function productCard(p) {
    const title = escapeHtml(p[COL.title] ?? "Sin título");
    const img = p[COL.image] ? escapeHtml(p[COL.image]) : "";
    const url = p[COL.url] ? escapeHtml(p[COL.url]) : "";
    const priceText = p[COL.price] ? escapeHtml(p[COL.price]) : "";

    return `
      <article class="card">
        <a class="card__img" href="${url || "#"}" target="_blank" rel="noopener">
          ${img ? `<img src="${img}" alt="${title}" loading="lazy">`
               : `<div class="img__placeholder">Sin imagen</div>`}
        </a>

        <div class="card__body">
          <h3 class="card__title" title="${title}">${title}</h3>
          ${priceText ? `<div class="card__price">${priceText}</div>` : ""}
          ${url ? `<a class="card__link" href="${url}" target="_blank" rel="noopener">Ver producto</a>` : ""}
        </div>
      </article>
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
      if (loadMoreBtn) loadMoreBtn.style.display = "inline-block";
    }

    setStatus("Cargando…");
    if (loadMoreBtn) loadMoreBtn.disabled = true;

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

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

    console.log("Rows:", data?.length, data?.[0]); // DEBUG útil

    if (!data || data.length === 0) {
      setStatus(reset ? "No hay resultados." : "No hay más productos.");
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      loading = false;
      return;
    }

    grid.insertAdjacentHTML("beforeend", data.map(productCard).join(""));
    page += 1;

    setStatus("");
    if (loadMoreBtn) loadMoreBtn.disabled = false;
    loading = false;
  }

  // Events
  let t = null;

  if (searchEl) {
    searchEl.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        lastQuery = searchEl.value;
        fetchProducts({ reset: true });
      }, 250);
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

  fetchProducts({ reset: true });
})();
