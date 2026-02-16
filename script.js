// ==========================
// SAPI WATCHES - SCRIPT ROBUSTO
// Login Supabase + Roles + Catálogo
// ==========================

const SUPABASE_URL = "https://gwprzkuuxhnixovmniaj.supabase.co";
const SUPABASE_KEY = "sb_publishable_pd2KxCYegn_GRt5VCvjbnw_fBSIIu8r";

const TABLE_NAME = "base_productos";

const COL = {
  title: "Titulo",
  image: "Imagen",
  price: "Precio",
  url: "Titulo_URL",
};

const FIRST_LOAD = 10;
const PAGE_SIZE = 24;

const DEBUG = true;
const log = (...a) => DEBUG && console.log("[SW]", ...a);
const warn = (...a) => console.warn("[SW]", ...a);

if (!window.supabase) {
  alert("No se ha cargado Supabase. Revisa el CDN en index.html.");
  throw new Error("Supabase not found");
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

// UI helpers
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

// helpers UI
function setStatus(msg = "") {
  if (statusEl) statusEl.textConten
