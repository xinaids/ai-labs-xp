// ─────────────────────────────────────────────
// desktop.js — Lógica do Desktop Windows XP
// AI Labs · IFRS Campus Ibirubá
// ─────────────────────────────────────────────

// ── Relógio ───────────────────────────────────
function updateClock() {
  const d = new Date();
  document.getElementById('clock').textContent =
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0');
}
updateClock();
setInterval(updateClock, 10000);

// ── Seleção de ícone ──────────────────────────
function selectIcon(id) {
  document.querySelectorAll('.desk-icon').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById(id);
  if (el) el.classList.add('selected');
}

// Deseleciona ao clicar no desktop
document.getElementById('desktop').addEventListener('click', function (e) {
  if (e.target === this)
    document.querySelectorAll('.desk-icon').forEach(el => el.classList.remove('selected'));
});

// ── Navegação ─────────────────────────────────
function openApp(url) {
  window.location.href = url;
}

// ── Menu de contexto ──────────────────────────
let ctxTarget = null;

function showCtx(e, url) {
  e.preventDefault();
  ctxTarget = url;
  const m = document.getElementById('ctxMenu');
  m.style.display = 'block';
  m.style.left = Math.min(e.clientX, window.innerWidth  - 160) + 'px';
  m.style.top  = Math.min(e.clientY, window.innerHeight - 130) + 'px';
}

function hideCtx() {
  document.getElementById('ctxMenu').style.display = 'none';
}

function ctxOpenApp() {
  hideCtx();
  if (ctxTarget) openApp(ctxTarget);
}

document.addEventListener('click', hideCtx);

// ── Dialog de mensagem ────────────────────────
function showMsg(txt) {
  document.getElementById('msgText').textContent = txt;
  document.getElementById('msgOverlay').classList.add('show');
}