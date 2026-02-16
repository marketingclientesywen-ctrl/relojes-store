// ==========================
// SAPI WATCHES - SCRIPT ROBUSTO
// Login Supabase + Roles + Catálogo
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

// Paginación
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
  // Super literal: esto evita “cosas raras”
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
  if (sessionState) sessionState.textContent = session ?? "—";
  if (roleState) roleState.textContent = role ?? "—";
  if (countState) cou
