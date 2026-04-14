// ─────────────────────────────────────────────
// queens/app.js — Lógica completa das 8 Rainhas
// Hill Climbing · Simulated Annealing · Algoritmo Genético
// Disciplina de Inteligência Artificial - IFRS Campus Ibirubá
// ─────────────────────────────────────────────

// ══════════════════════════════════════════════
// UTILITÁRIOS GERAIS
// ══════════════════════════════════════════════

/** Relógio da taskbar */
function updateClock() {
  const d = new Date();
  document.getElementById('clock').textContent =
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0');
}
updateClock();
setInterval(updateClock, 10000);

/** Troca de abas */
function switchTab(id) {
  ['hc', 'sa', 'ga', 'cmp'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('active', t === id);
    document.getElementById('panel-' + t).classList.toggle('active', t === id);
  });
}

/**
 * Conta pares de rainhas se atacando.
 * Estado: array[8] onde state[col] = linha da rainha na coluna col.
 * Uma rainha ataca outra se estiver na mesma linha ou mesma diagonal.
 * (Conflito de coluna é impossível pois cada coluna tem exatamente uma rainha.)
 */
function conflicts(state) {
  let c = 0;
  for (let i = 0; i < 8; i++)
    for (let j = i + 1; j < 8; j++) {
      if (state[i] === state[j]) c++;                                // mesma linha
      if (Math.abs(state[i] - state[j]) === Math.abs(i - j)) c++;   // mesma diagonal
    }
  return c;
}

/**
 * Gera estado inicial aleatório (permutação de 0..7).
 * Usar permutação garante zero conflitos de linha, reduzindo o espaço de busca.
 */
function randomState() {
  const s = [0, 1, 2, 3, 4, 5, 6, 7];
  for (let i = 7; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

/**
 * Gera todos os vizinhos de um estado.
 * Cada vizinho é obtido movendo a rainha de uma coluna para qualquer outra linha.
 * Total de vizinhos: 8 colunas × 7 linhas alternativas = 56.
 */
function neighbors(state) {
  const nbrs = [];
  for (let col = 0; col < 8; col++)
    for (let row = 0; row < 8; row++)
      if (row !== state[col]) {
        const n = state.slice();
        n[col] = row;
        nbrs.push(n);
      }
  return nbrs;
}

// ── Renderização do tabuleiro ──────────────────

/**
 * Renderiza um tabuleiro de xadrez 8×8 com as rainhas posicionadas.
 * Células com rainhas em conflito são destacadas em vermelho.
 * @param {string} divId  - id do elemento .chess-board
 * @param {number[]} state - array de 8 valores (linha por coluna)
 * @param {boolean} small  - usa tamanho reduzido (classe .sm)
 */
function renderBoard(divId, state, small = false) {
  const div = document.getElementById(divId);
  if (!div) return;
  div.innerHTML = '';
  div.className = 'chess-board' + (small ? ' sm' : '');

  // Detecta quais colunas têm rainhas conflitantes
  const conflicted = new Set();
  for (let i = 0; i < 8; i++)
    for (let j = i + 1; j < 8; j++) {
      const atacando =
        state[i] === state[j] ||
        Math.abs(state[i] - state[j]) === Math.abs(i - j);
      if (atacando) { conflicted.add(i); conflicted.add(j); }
    }

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = document.createElement('div');
      const isLight    = (row + col) % 2 === 0;
      const hasQueen   = state[col] === row;
      const isConflict = hasQueen && conflicted.has(col);

      cell.className = 'cell' + (small ? ' sm' : '') + ' ' + (
        isConflict
          ? (isLight ? 'conflict-light' : 'conflict-dark')
          : (isLight ? 'light' : 'dark')
      );
      if (hasQueen) cell.textContent = '♛';
      div.appendChild(cell);
    }
  }
}

/** Renderiza tabuleiro vazio (todas as células sem rainha) */
function emptyBoard(divId, small = false) {
  renderBoard(divId, Array(8).fill(-1), small);
}

// Inicializa todos os tabuleiros vazios
['hc', 'sa', 'ga'].forEach(id => emptyBoard('board-' + id));
['hc', 'sa', 'ga'].forEach(id => emptyBoard('cmp-board-' + id, true));

// ── Helpers de UI ──────────────────────────────

function setVal(id, val)     { const el = document.getElementById(id); if (el) el.textContent = val; }
function setStatus(id, msg)  { const el = document.getElementById(id); if (el) el.textContent = msg; }
function setProg(id, pct)    { const el = document.getElementById(id); if (el) el.style.width = Math.min(100, pct) + '%'; }

/**
 * Adiciona uma linha ao log interno (caixa verde/preta estilo terminal).
 * @param {string} boxId  - id do .log-box
 * @param {string} msg    - mensagem a exibir
 * @param {string} cls    - classe CSS: 'log-line' | 'log-warn' | 'log-ok' | 'log-err'
 */
function appendLog(boxId, msg, cls = 'log-line') {
  const box = document.getElementById(boxId);
  if (!box) return;
  const line = document.createElement('div');
  line.className = cls;
  line.textContent = msg;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

// ── Gráfico de linha (canvas nativo, sem dependências) ──

/**
 * Desenha um gráfico de linhas simples em um <canvas>.
 * @param {string}   canvasId - id do elemento canvas
 * @param {number[][]} series - array de séries de dados
 * @param {string[]} labels  - legenda por série
 * @param {string[]} colors  - cor por série (hex)
 */
function drawLineChart(canvasId, series, labels, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const W = canvas.offsetWidth || 400, H = 100;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  if (!series || !series.length || !series[0].length) {
    ctx.fillStyle = '#888'; ctx.font = '11px Tahoma';
    ctx.fillText('Sem dados.', 10, H / 2);
    return;
  }

  const pad = { l: 32, r: 10, t: 10, b: 20 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const allVals = series.flat();
  const minV = Math.min(...allVals), maxV = Math.max(...allVals);
  const range = maxV - minV || 1;

  const tx = (i, n) => pad.l + (i / (n - 1 || 1)) * pw;
  const ty = v      => pad.t + ph - ((v - minV) / range) * ph;

  // Grade horizontal
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = pad.t + g * (ph / 4);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke();
    ctx.fillStyle = '#888'; ctx.font = '9px Tahoma'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxV - g * (range / 4)), pad.l - 2, y + 3);
  }
  ctx.textAlign = 'left';

  // Linhas
  series.forEach((data, si) => {
    ctx.beginPath();
    ctx.strokeStyle = colors[si] || '#333'; ctx.lineWidth = 1.5;
    data.forEach((v, i) => {
      const x = tx(i, data.length), y = ty(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  // Legenda
  labels.forEach((lbl, i) => {
    ctx.fillStyle = colors[i] || '#333';
    ctx.fillRect(pad.l + i * 90, H - 12, 10, 8);
    ctx.fillStyle = '#333'; ctx.font = '9px Tahoma';
    ctx.fillText(lbl, pad.l + i * 90 + 13, H - 5);
  });
}

// ══════════════════════════════════════════════
// RESULTADOS GLOBAIS (para o comparativo)
// ══════════════════════════════════════════════

const results = { hc: null, sa: null, ga: null };

/** Atualiza a aba Comparativo com os resultados disponíveis */
function updateComparison() {
  const r = results;

  // Mini tabuleiros
  if (r.hc) { renderBoard('cmp-board-hc', r.hc.bestState, true); setVal('cmp-label-hc', `Conf: ${r.hc.conf} | ${r.hc.time}ms`); }
  if (r.sa) { renderBoard('cmp-board-sa', r.sa.bestState, true); setVal('cmp-label-sa', `Conf: ${r.sa.conf} | ${r.sa.time}ms`); }
  if (r.ga) { renderBoard('cmp-board-ga', r.ga.bestState, true); setVal('cmp-label-ga', `Conf: ${r.ga.conf} | ${r.ga.time}ms`); }

  const metrics = [
    { label: 'Conflitos finais',        key: 'conf',   lower: true,  bool: false },
    { label: 'Tempo (ms)',              key: 'time',   lower: true,  bool: false },
    { label: 'Iterações / Gerações',    key: 'iters',  lower: true,  bool: false },
    { label: 'Solução perfeita (0 cf)', key: 'solved', lower: false, bool: true  },
  ];

  const keys = ['hc', 'sa', 'ga'];
  const body = document.getElementById('cmp-body');
  body.innerHTML = '';

  for (const m of metrics) {
    const vals = keys.map(k => r[k] ? r[k][m.key] : null);
    let bestIdx = -1;
    const nonNull = vals.map((v, i) => ({ v, i })).filter(x => x.v !== null);
    if (nonNull.length) {
      if (m.bool)        bestIdx = nonNull.find(x => x.v === true)?.i ?? -1;
      else if (m.lower)  bestIdx = nonNull.reduce((a, b) => a.v <= b.v ? a : b).i;
      else               bestIdx = nonNull.reduce((a, b) => a.v >= b.v ? a : b).i;
    }

    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td class="metric">${m.label}</td>` +
      keys.map((k, i) => {
        const v   = r[k] ? (m.bool ? (r[k][m.key] ? '✔ Sim' : '✘ Não') : r[k][m.key]) : '—';
        const cls = (vals[i] !== null && i === bestIdx) ? 'num win' : (vals[i] !== null ? 'num lose' : 'num');
        return `<td class="${cls}">${v}</td>`;
      }).join('');
    body.appendChild(tr);
  }

  // Análise textual automática
  const labels  = { hc: 'Hill Climbing', sa: 'Simulated Annealing', ga: 'Algoritmo Genético' };
  const solved  = keys.filter(k => r[k] && r[k].solved);
  const fastest = keys.filter(k => r[k]).sort((a, b) => r[a].time  - r[b].time)[0];
  const fewest  = keys.filter(k => r[k]).sort((a, b) => r[a].conf  - r[b].conf)[0];

  let txt = '';
  txt += solved.length
    ? `✔ ${solved.map(k => labels[k]).join(' e ')} encontraram solução perfeita (0 conflitos). `
    : '⚠ Nenhum algoritmo encontrou solução perfeita nesta execução. Tente novamente ou ajuste os parâmetros. ';
  if (fastest) txt += `⚡ Mais rápido: ${labels[fastest]} (${r[fastest].time} ms). `;
  if (fewest)  txt += `🎯 Menos conflitos: ${labels[fewest]} (${r[fewest].conf} conflito(s)). `;
  txt += '\n\n📌 HC é rápido mas pode ficar preso em ótimos locais. SA escapa via aceitação probabilística. GA explora em paralelo com população — mais robusto mas mais lento.';

  document.getElementById('cmp-analysis').textContent = txt;
  drawCmpBarChart();
}

/** Gráfico de barras comparativo (tempo e conflitos) */
function drawCmpBarChart() {
  const r = results;
  const canvas = document.getElementById('cmp-chart');
  if (!canvas) return;
  const W = canvas.offsetWidth || 400, H = 120;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const keys   = ['hc', 'sa', 'ga'];
  const colors = ['#3a6ea5', '#c04000', '#206820'];
  const lbls   = ['HC', 'SA', 'GA'];
  const times  = keys.map(k => r[k] ? r[k].time : 0);
  const confs  = keys.map(k => r[k] ? r[k].conf : 0);

  const padL = 36, padB = 28, padT = 10;
  const ph   = H - padT - padB;
  const maxT = Math.max(...times, 1);

  // Eixo
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB);
  ctx.lineTo(W - 10, H - padB); ctx.stroke();

  const bw   = 28;
  const step = (W - padL - 20) / 3;

  keys.forEach((k, i) => {
    const x  = padL + 14 + i * step;
    // Barra de tempo
    if (times[i]) {
      const bh = (times[i] / maxT) * ph;
      ctx.fillStyle = colors[i] + 'aa';
      ctx.fillRect(x, H - padB - bh, bw, bh);
      ctx.strokeStyle = colors[i]; ctx.lineWidth = 1;
      ctx.strokeRect(x, H - padB - bh, bw, bh);
      ctx.fillStyle = '#333'; ctx.font = '9px Tahoma'; ctx.textAlign = 'center';
      ctx.fillText(times[i] + 'ms', x + bw / 2, H - padB - bh - 3);
    }
    // Indicador de conflitos (barra fina sobreposta)
    if (confs[i] !== undefined && maxT) {
      const bh2 = (confs[i] / 28) * ph * 0.5;
      ctx.fillStyle = '#ff000055';
      ctx.fillRect(x + bw + 2, H - padB - bh2, 10, bh2);
      if (bh2 > 6) {
        ctx.fillStyle = '#cc0000'; ctx.font = '9px Tahoma';
        ctx.fillText(confs[i] + 'c', x + bw + 7, H - padB - bh2 - 2);
      }
    }
    ctx.fillStyle = '#333'; ctx.font = '10px Tahoma'; ctx.textAlign = 'center';
    ctx.fillText(lbls[i], x + bw / 2, H - padB + 12);
  });

  ctx.fillStyle = '#555'; ctx.font = '9px Tahoma'; ctx.textAlign = 'left';
  ctx.fillText('Barras = tempo (ms)  |  Vermelho = conflitos', padL + 2, padT + 8);
}

// ══════════════════════════════════════════════
// HILL CLIMBING COM REINÍCIO ALEATÓRIO
// ══════════════════════════════════════════════

let hcRunning  = false;
let hcCurve    = [];   // histórico de conflitos para o gráfico

/**
 * Hill Climbing com Reinício Aleatório (assíncrono via setTimeout).
 *
 * A cada iteração, avalia todos os 56 vizinhos e move para o de menor conflito.
 * Se não houver melhoria (ótimo local), reinicia com estado aleatório.
 * Para ao encontrar conflitos = 0 ou atingir o limite de reinícios.
 */
function runHC() {
  if (hcRunning) return;
  hcRunning = true;

  const maxRestarts = parseInt(document.getElementById('hc-restarts').value) || 100;
  const maxIter     = parseInt(document.getElementById('hc-maxiter').value)  || 1000;

  // Reset visual
  document.getElementById('hc-log').innerHTML = '';
  setProg('hc-prog', 0);
  setStatus('hc-status', '🔄 Executando...');
  ['hc-sol', 'hc-conf', 'hc-iters', 'hc-rest', 'hc-time'].forEach(id => setVal(id, '—'));
  hcCurve = [];

  const t0 = performance.now();
  let bestState = randomState(), bestConf = conflicts(bestState);
  let totalIter = 0, restart = 0, solved = false;

  appendLog('hc-log', `▶ Iniciando: max_reinícios=${maxRestarts}, max_iter=${maxIter}`, 'log-line');

  function step() {
    if (!hcRunning || restart >= maxRestarts || solved) {
      finishHC(bestState, bestConf, totalIter, restart, performance.now() - t0, solved);
      return;
    }

    // Um reinício: começa de estado aleatório
    let state = randomState();
    let conf  = conflicts(state);

    for (let it = 0; it < maxIter; it++) {
      totalIter++;
      hcCurve.push(conf);

      if (conf === 0) { solved = true; bestState = state.slice(); bestConf = 0; break; }

      // Avalia vizinhos e escolhe o de menor conflito (gradiente)
      let bestNbr = null, bestNbrConf = conf;
      for (const n of neighbors(state)) {
        const c = conflicts(n);
        if (c < bestNbrConf) { bestNbrConf = c; bestNbr = n; }
      }

      if (bestNbr === null) break;   // ótimo local — reinicia
      state = bestNbr; conf = bestNbrConf;
      if (conf < bestConf) { bestConf = conf; bestState = state.slice(); }
    }

    restart++;
    setProg('hc-prog', (restart / maxRestarts) * 100);

    if (restart % 10 === 0)
      appendLog('hc-log',
        `  Reinício ${restart}: melhor conflito = ${bestConf}`,
        bestConf === 0 ? 'log-ok' : 'log-warn'
      );

    if (solved) finishHC(bestState, 0, totalIter, restart, performance.now() - t0, true);
    else        setTimeout(step, 0);
  }
  setTimeout(step, 0);
}

function finishHC(state, conf, iters, rest, time, solved) {
  hcRunning = false;
  renderBoard('board-hc', state);
  setVal('hc-sol',   state.join(' '));
  setVal('hc-conf',  conf);
  setVal('hc-iters', iters);
  setVal('hc-rest',  rest);
  setVal('hc-time',  Math.round(time));
  setProg('hc-prog', 100);
  setStatus('hc-status', solved ? '✔ Solução encontrada!' : `⚠ Melhor: ${conf} conflito(s)`);
  appendLog('hc-log',
    solved
      ? `✔ SOLUÇÃO em ${rest} reinícios, ${iters} iterações, ${Math.round(time)} ms`
      : `✘ Parou com ${conf} conflito(s) após ${rest} reinícios`,
    solved ? 'log-ok' : 'log-err'
  );
  setStatus('status-left', `HC | Conflitos: ${conf} | ${Math.round(time)} ms`);

  // Amostra da curva para o gráfico (máx. 200 pontos)
  const step  = Math.max(1, Math.floor(hcCurve.length / 200));
  const curve = hcCurve.filter((_, i) => i % step === 0);
  drawLineChart('hc-chart', [curve], ['Conflitos'], ['#3a6ea5']);

  results.hc = { bestState: state.slice(), conf, time: Math.round(time), iters, solved: conf === 0 };
  updateComparison();
}

// ══════════════════════════════════════════════
// SIMULATED ANNEALING (TÊMPERA SIMULADA)
// ══════════════════════════════════════════════

let saRunning = false;

/**
 * Simulated Annealing para o problema das 8 rainhas.
 *
 * A cada passo, escolhe um vizinho aleatório:
 *   - Se ΔE < 0 (melhora): sempre aceita.
 *   - Se ΔE ≥ 0 (piora):   aceita com probabilidade e^(−ΔE/T).
 * A temperatura T decresce multiplicativamente: T *= α.
 * Quando T < Tmin, considera-se resfriado e reinicia (se configurado).
 */
function runSA() {
  if (saRunning) return;
  saRunning = true;

  const T0      = parseFloat(document.getElementById('sa-t0').value)       || 30;
  const alpha   = parseFloat(document.getElementById('sa-alpha').value)     || 0.995;
  const Tmin    = parseFloat(document.getElementById('sa-tmin').value)      || 0.01;
  const maxRest = parseInt(document.getElementById('sa-restarts').value)    || 5;

  document.getElementById('sa-log').innerHTML = '';
  setProg('sa-prog', 0);
  setStatus('sa-status', '🔄 Executando...');
  ['sa-sol', 'sa-conf', 'sa-iters', 'sa-tfinal', 'sa-time'].forEach(id => setVal(id, '—'));

  const confCurve = [];
  const t0 = performance.now();
  let bestState = randomState(), bestConf = conflicts(bestState);
  let totalIter = 0, restDone = 0, solved = false;

  appendLog('sa-log', `▶ T₀=${T0}, α=${alpha}, Tmin=${Tmin}, reinícios=${maxRest}`, 'log-line');

  function doRestart() {
    if (!saRunning || restDone >= maxRest || solved) {
      finishSA(bestState, bestConf, totalIter, confCurve, performance.now() - t0, solved);
      return;
    }

    let state = randomState();
    let conf  = conflicts(state);
    let T     = T0;

    function annealChunk() {
      const CHUNK = 500;  // iterações por fatia de CPU

      for (let c = 0; c < CHUNK && T > Tmin; c++) {
        totalIter++;

        // Escolhe vizinho aleatório
        const col  = Math.floor(Math.random() * 8);
        let   row  = Math.floor(Math.random() * 7);
        if (row >= state[col]) row++;  // garante que row ≠ state[col]

        const next     = state.slice();
        next[col]      = row;
        const nextConf = conflicts(next);
        const dE       = nextConf - conf;

        // Critério de aceitação de Metropolis
        if (dE < 0 || Math.random() < Math.exp(-dE / T)) {
          state = next; conf = nextConf;
        }

        if (conf < bestConf) { bestConf = conf; bestState = state.slice(); }
        if (conf === 0) { solved = true; break; }

        T *= alpha;
        if (totalIter % 500 === 0) confCurve.push(conf);
      }

      if (solved || T <= Tmin) {
        appendLog('sa-log',
          `  Reinício ${restDone + 1}: T_final=${T.toFixed(5)}, melhor conf=${bestConf}`,
          bestConf === 0 ? 'log-ok' : 'log-warn'
        );
        restDone++;
        setProg('sa-prog', (restDone / maxRest) * 100);
        if (solved) finishSA(bestState, 0, totalIter, confCurve, performance.now() - t0, true);
        else        setTimeout(doRestart, 0);
      } else {
        setTimeout(annealChunk, 0);
      }
    }
    annealChunk();
  }
  doRestart();
}

function finishSA(state, conf, iters, confCurve, time, solved) {
  saRunning = false;
  renderBoard('board-sa', state);
  setVal('sa-sol',    state.join(' '));
  setVal('sa-conf',   conf);
  setVal('sa-iters',  iters);
  setVal('sa-tfinal', confCurve.length ? '—' : '—');
  setVal('sa-time',   Math.round(time));
  setProg('sa-prog', 100);
  setStatus('sa-status', solved ? '✔ Solução encontrada!' : `⚠ Melhor: ${conf} conflito(s)`);
  appendLog('sa-log',
    solved
      ? `✔ SOLUÇÃO em ${iters} iterações, ${Math.round(time)} ms`
      : `✘ Parou com ${conf} conflito(s)`,
    solved ? 'log-ok' : 'log-err'
  );
  setStatus('status-left', `SA | Conflitos: ${conf} | ${Math.round(time)} ms`);
  drawLineChart('sa-chart', [confCurve], ['Conflitos SA'], ['#c04000']);

  results.sa = { bestState: state.slice(), conf, time: Math.round(time), iters, solved: conf === 0 };
  updateComparison();
}

// ══════════════════════════════════════════════
// ALGORITMO GENÉTICO
// ══════════════════════════════════════════════

let gaRunning = false;

/**
 * Algoritmo Genético para o problema das 8 rainhas.
 *
 * Representação: cromossomo = array[8], onde gene[col] = linha da rainha.
 * Fitness: 28 − conflitos (máximo 28 = solução perfeita).
 *
 * Operadores genéticos:
 *   - Seleção: torneio de tamanho k (escolhe o melhor de k indivíduos aleatórios).
 *   - Crossover: cruzamento de um ponto (com probabilidade crossRate).
 *   - Mutação: cada gene muda para valor aleatório com probabilidade mutRate.
 *   - Elitismo: os N% melhores da geração anterior são preservados intactos.
 */
function runGA() {
  if (gaRunning) return;
  gaRunning = true;

  const popSize   = parseInt(document.getElementById('ga-pop').value)    || 200;
  const maxGens   = parseInt(document.getElementById('ga-gens').value)   || 2000;
  const mutRate   = parseFloat(document.getElementById('ga-mut').value)  || 0.05;
  const crossRate = parseFloat(document.getElementById('ga-cross').value) || 0.85;
  const eliteP    = parseInt(document.getElementById('ga-elite').value)  || 5;
  const tournK    = parseInt(document.getElementById('ga-tourn').value)  || 5;

  document.getElementById('ga-log').innerHTML = '';
  setProg('ga-prog', 0);
  setStatus('ga-status', '🔄 Evoluindo...');
  ['ga-sol', 'ga-conf', 'ga-gen', 'ga-fit', 'ga-time'].forEach(id => setVal(id, '—'));

  const MAX_FITNESS = 28;   // C(8,2) = 28 pares possíveis
  const fitness = s => MAX_FITNESS - conflicts(s);

  // Inicializa população com permutações aleatórias
  let pop = Array.from({ length: popSize }, randomState);
  let bestState = pop[0].slice(), bestConf = conflicts(pop[0]);
  const bestCurve = [], avgCurve = [];
  let gen = 0, solved = false;
  const ec = Math.max(1, Math.round(popSize * eliteP / 100));

  const t0 = performance.now();
  appendLog('ga-log', `▶ Pop=${popSize}, gens=${maxGens}, mut=${mutRate}, cross=${crossRate}, elite=${eliteP}%, torneio=${tournK}`, 'log-line');

  /** Seleção por torneio: escolhe o melhor de tournK indivíduos aleatórios */
  function tournamentSelect(popFit) {
    let best = null, bestF = -1;
    for (let i = 0; i < tournK; i++) {
      const idx = Math.floor(Math.random() * popFit.length);
      if (popFit[idx].f > bestF) { bestF = popFit[idx].f; best = popFit[idx].s; }
    }
    return best;
  }

  /** Crossover de um ponto: troca os genes após o ponto de corte */
  function crossover(a, b) {
    if (Math.random() > crossRate) return [a.slice(), b.slice()];
    const pt = 1 + Math.floor(Math.random() * 7);
    return [
      [...a.slice(0, pt), ...b.slice(pt)],
      [...b.slice(0, pt), ...a.slice(pt)]
    ];
  }

  /** Mutação: cada gene muda para linha aleatória com probabilidade mutRate */
  function mutate(s) {
    const c = s.slice();
    for (let i = 0; i < 8; i++)
      if (Math.random() < mutRate) c[i] = Math.floor(Math.random() * 8);
    return c;
  }

  function evolveChunk() {
    const CHUNK = 50;  // gerações por fatia de CPU

    for (let g = 0; g < CHUNK && gen < maxGens && !solved; g++, gen++) {
      // Avalia fitness de toda a população
      const popFit = pop.map(s => ({ s, f: fitness(s), c: conflicts(s) }));
      popFit.sort((a, b) => b.f - a.f);   // ordena decrescente por fitness

      // Atualiza melhor global
      if (popFit[0].c < bestConf) { bestConf = popFit[0].c; bestState = popFit[0].s.slice(); }
      if (bestConf === 0) { solved = true; break; }

      // Registra curvas a cada 10 gerações
      if (gen % 10 === 0) {
        bestCurve.push(popFit[0].f);
        avgCurve.push(popFit.reduce((s, x) => s + x.f, 0) / popFit.length);
      }

      // Nova geração: elitismo + seleção + crossover + mutação
      const newPop = popFit.slice(0, ec).map(x => x.s.slice());   // elite
      while (newPop.length < popSize) {
        const p1 = tournamentSelect(popFit);
        const p2 = tournamentSelect(popFit);
        const [c1, c2] = crossover(p1, p2);
        newPop.push(mutate(c1));
        if (newPop.length < popSize) newPop.push(mutate(c2));
      }
      pop = newPop;
    }

    // Atualiza UI a cada chunk
    const elapsed = performance.now() - t0;
    setProg('ga-prog', Math.min(100, (gen / maxGens) * 100));
    setVal('ga-gen',  gen);
    setVal('ga-conf', bestConf);
    setVal('ga-fit',  MAX_FITNESS - bestConf);
    setVal('ga-time', Math.round(elapsed));

    if (gen % 100 === 0)
      appendLog('ga-log',
        `  Gen ${gen}: melhor fitness=${MAX_FITNESS - bestConf}, conflitos=${bestConf}`,
        bestConf <= 2 ? 'log-ok' : bestConf <= 5 ? 'log-warn' : 'log-line'
      );

    if (solved || gen >= maxGens || !gaRunning)
      finishGA(bestState, bestConf, gen, bestCurve, avgCurve, performance.now() - t0, solved);
    else
      setTimeout(evolveChunk, 0);
  }
  setTimeout(evolveChunk, 0);
}

function finishGA(state, conf, gen, bestCurve, avgCurve, time, solved) {
  gaRunning = false;
  renderBoard('board-ga', state);
  setVal('ga-sol',  state.join(' '));
  setVal('ga-conf', conf);
  setVal('ga-gen',  gen);
  setVal('ga-fit',  28 - conf);
  setVal('ga-time', Math.round(time));
  setProg('ga-prog', 100);
  setStatus('ga-status', solved ? '✔ Solução encontrada!' : `⚠ Melhor: ${conf} conflito(s)`);
  appendLog('ga-log',
    solved
      ? `✔ SOLUÇÃO na geração ${gen}, ${Math.round(time)} ms`
      : `✘ Parou com ${conf} conflito(s) na geração ${gen}`,
    solved ? 'log-ok' : 'log-err'
  );
  setStatus('status-left', `GA | Conflitos: ${conf} | ${Math.round(time)} ms`);
  drawLineChart('ga-chart', [bestCurve, avgCurve], ['Melhor', 'Média'], ['#206820', '#88c888']);

  results.ga = { bestState: state.slice(), conf, time: Math.round(time), iters: gen, solved: conf === 0 };
  updateComparison();
}

// ══════════════════════════════════════════════
// CONTROLES GLOBAIS
// ══════════════════════════════════════════════

/** Executa os três algoritmos em sequência */
function runAll() { runHC(); runSA(); runGA(); }

/** Para todos os algoritmos em execução */
function stopAll() {
  hcRunning = false; saRunning = false; gaRunning = false;
  setStatus('status-left', 'Parado pelo usuário.');
}

/** Reseta toda a interface */
function resetAll() {
  stopAll();
  ['hc', 'sa', 'ga'].forEach(id => {
    emptyBoard('board-' + id);
    emptyBoard('cmp-board-' + id, true);
    document.getElementById(id + '-log').innerHTML = '';
    setProg(id + '-prog', 0);
    setStatus(id + '-status', 'Aguardando...');
    ['sol', 'conf', 'iters', 'time'].forEach(k => setVal(id + '-' + k, '—'));
  });
  setVal('hc-rest', '—'); setVal('sa-tfinal', '—'); setVal('ga-gen', '—'); setVal('ga-fit', '—');
  results.hc = null; results.sa = null; results.ga = null;
  document.getElementById('cmp-body').innerHTML =
    '<tr><td colspan="4" style="text-align:center;color:#888;padding:12px;">Execute os algoritmos para ver comparação.</td></tr>';
  document.getElementById('cmp-analysis').textContent = 'Execute os algoritmos para ver análise.';
  ['cmp-label-hc', 'cmp-label-sa', 'cmp-label-ga'].forEach(id => setVal(id, '—'));
  setStatus('status-left', 'Pronto');
}

// ══════════════════════════════════════════════
// BATCH — EXECUTA N VEZES PARA ESTATÍSTICAS
// ══════════════════════════════════════════════

/**
 * Executa os três algoritmos N vezes de forma síncrona (rápida, sem animação)
 * e exibe estatísticas médias na aba Comparativo.
 * Útil para comparar consistência e robustez dos algoritmos.
 */
function runBatch(n) {
  const batch = {
    hc: { times: [], confs: [], solved: 0 },
    sa: { times: [], confs: [], solved: 0 },
    ga: { times: [], confs: [], solved: 0 },
  };

  function nextRun(i) {
    if (i >= n) { showBatchResults(batch, n); return; }
    setStatus('status-left', `Batch: execução ${i + 1}/${n}...`);

    const [, hcConf, hcTime] = runHCSync();
    batch.hc.times.push(hcTime); batch.hc.confs.push(hcConf);
    if (hcConf === 0) batch.hc.solved++;

    const [, saConf, saTime] = runSASync();
    batch.sa.times.push(saTime); batch.sa.confs.push(saConf);
    if (saConf === 0) batch.sa.solved++;

    const [, gaConf, gaTime] = runGASync();
    batch.ga.times.push(gaTime); batch.ga.confs.push(gaConf);
    if (gaConf === 0) batch.ga.solved++;

    setTimeout(() => nextRun(i + 1), 0);
  }
  nextRun(0);
}

const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0;

function showBatchResults(b, n) {
  const keys = ['hc', 'sa', 'ga'];
  const body = document.getElementById('cmp-body');
  body.innerHTML = `
    <tr>
      <td class="metric">Tempo médio (ms)</td>
      ${keys.map(k => `<td class="num">${avg(b[k].times)}</td>`).join('')}
    </tr><tr>
      <td class="metric">Conflitos médios</td>
      ${keys.map(k => `<td class="num">${avg(b[k].confs)}</td>`).join('')}
    </tr><tr>
      <td class="metric">Soluções perfeitas / ${n}</td>
      ${keys.map(k => `<td class="num ${b[k].solved === n ? 'win' : b[k].solved > 0 ? '' : 'lose'}">${b[k].solved}</td>`).join('')}
    </tr>`;
  switchTab('cmp');
  setStatus('status-left', `Batch de ${n} execuções concluído.`);

  // Mini chart de dispersão de tempos
  const canvas = document.getElementById('cmp-chart');
  if (!canvas) return;
  const W = canvas.offsetWidth || 400, H = 120;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const colors = { hc: '#3a6ea5', sa: '#c04000', ga: '#206820' };
  const allT   = [...b.hc.times, ...b.sa.times, ...b.ga.times];
  const maxT   = Math.max(...allT, 1);
  const padL = 36, padB = 28, padT = 10;
  const ph   = H - padT - padB;

  keys.forEach((k, i) => {
    const x    = padL + 20 + i * ((W - padL - 20) / 3);
    const mn   = Math.min(...b[k].times), mx = Math.max(...b[k].times), av = avg(b[k].times);
    const y1   = H - padB - (mn / maxT) * ph;
    const y2   = H - padB - (mx / maxT) * ph;
    const yA   = H - padB - (av / maxT) * ph;

    ctx.strokeStyle = colors[k]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 15, y1); ctx.lineTo(x + 15, y2); ctx.stroke();
    ctx.fillStyle = colors[k] + '88'; ctx.fillRect(x + 5, y2, 20, y1 - y2);
    ctx.strokeRect(x + 5, y2, 20, y1 - y2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 5, yA); ctx.lineTo(x + 25, yA); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.font = '10px Tahoma'; ctx.textAlign = 'center';
    ctx.fillText(['HC', 'SA', 'GA'][i], x + 15, H - padB + 12);
  });
  ctx.fillStyle = '#555'; ctx.font = '9px Tahoma'; ctx.textAlign = 'left';
  ctx.fillText(`Batch ${n}× — barra = tempo (ms), traço branco = média`, padL + 2, padT + 8);
}

// ── Versões síncronas rápidas para o batch ─────

/** HC síncrono (sem atualização de UI) — retorna [estado, conflitos, tempo_ms] */
function runHCSync() {
  const maxR = parseInt(document.getElementById('hc-restarts').value) || 100;
  const maxI = parseInt(document.getElementById('hc-maxiter').value)  || 1000;
  const t0 = performance.now();
  let best = randomState(), bc = conflicts(best);
  for (let r = 0; r < maxR && bc > 0; r++) {
    let s = randomState(), c = conflicts(s);
    for (let i = 0; i < maxI && c > 0; i++) {
      let bn = null, bnc = c;
      for (const n of neighbors(s)) { const nc = conflicts(n); if (nc < bnc) { bnc = nc; bn = n; } }
      if (!bn) break;
      s = bn; c = bnc;
      if (c < bc) { bc = c; best = s.slice(); }
    }
  }
  return [best, bc, Math.round(performance.now() - t0)];
}

/** SA síncrono — retorna [estado, conflitos, tempo_ms] */
function runSASync() {
  const T0    = parseFloat(document.getElementById('sa-t0').value)       || 30;
  const alpha = parseFloat(document.getElementById('sa-alpha').value)     || 0.995;
  const Tmin  = parseFloat(document.getElementById('sa-tmin').value)      || 0.01;
  const maxR  = parseInt(document.getElementById('sa-restarts').value)    || 5;
  const t0 = performance.now();
  let best = randomState(), bc = conflicts(best);
  for (let r = 0; r < maxR && bc > 0; r++) {
    let s = randomState(), c = conflicts(s), T = T0;
    while (T > Tmin && c > 0) {
      const col = Math.floor(Math.random() * 8);
      let   row = Math.floor(Math.random() * 7);
      if (row >= s[col]) row++;
      const n = s.slice(); n[col] = row;
      const nc = conflicts(n), dE = nc - c;
      if (dE < 0 || Math.random() < Math.exp(-dE / T)) { s = n; c = nc; }
      if (c < bc) { bc = c; best = s.slice(); }
      T *= alpha;
    }
  }
  return [best, bc, Math.round(performance.now() - t0)];
}

/** GA síncrono — retorna [estado, conflitos, tempo_ms] */
function runGASync() {
  const popSize   = parseInt(document.getElementById('ga-pop').value)    || 200;
  const maxGens   = parseInt(document.getElementById('ga-gens').value)   || 2000;
  const mutRate   = parseFloat(document.getElementById('ga-mut').value)  || 0.05;
  const crossRate = parseFloat(document.getElementById('ga-cross').value) || 0.85;
  const eliteP    = parseInt(document.getElementById('ga-elite').value)  || 5;
  const tournK    = parseInt(document.getElementById('ga-tourn').value)  || 5;
  const MAX_FITNESS = 28;
  const fit = s => MAX_FITNESS - conflicts(s);
  const t0  = performance.now();
  let pop   = Array.from({ length: popSize }, randomState);
  let best  = pop[0].slice(), bc = conflicts(pop[0]);
  const ec  = Math.max(1, Math.round(popSize * eliteP / 100));
  const sel = pf => { let b = null, bf = -1; for (let i = 0; i < tournK; i++) { const idx = Math.floor(Math.random() * pf.length); if (pf[idx].f > bf) { bf = pf[idx].f; b = pf[idx].s; } } return b; };
  const mut = s  => { const c = s.slice(); for (let i = 0; i < 8; i++) if (Math.random() < mutRate) c[i] = Math.floor(Math.random() * 8); return c; };
  for (let g = 0; g < maxGens && bc > 0; g++) {
    const pf = pop.map(s => ({ s, f: fit(s), c: conflicts(s) })); pf.sort((a, b) => b.f - a.f);
    if (pf[0].c < bc) { bc = pf[0].c; best = pf[0].s.slice(); }
    if (bc === 0) break;
    const np = pf.slice(0, ec).map(x => x.s.slice());
    while (np.length < popSize) {
      const p1 = sel(pf), p2 = sel(pf);
      let c1, c2;
      if (Math.random() < crossRate) { const pt = 1 + Math.floor(Math.random() * 7); c1 = [...p1.slice(0, pt), ...p2.slice(pt)]; c2 = [...p2.slice(0, pt), ...p1.slice(pt)]; }
      else { c1 = p1.slice(); c2 = p2.slice(); }
      np.push(mut(c1)); if (np.length < popSize) np.push(mut(c2));
    }
    pop = np;
  }
  return [best, bc, Math.round(performance.now() - t0)];
}