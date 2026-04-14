// ─────────────────────────────────────────────
// app.js — Interface, renderização e controles do 8 Puzzle Solver
// Disciplina de Inteligência Artificial - IFRS Campus Ibirubá
// Depende de: bfs.js, astar.js
// ─────────────────────────────────────────────

const MOVE_LABELS = {
  cima: '↑ CIMA',
  baixo: '↓ BAIXO',
  esquerda: '← ESQUERDA',
  direita: '→ DIREITA'
};

// ── Estado global ─────────────────────────────────────────
let solution     = [], currentStep   = 0, playInterval   = null;
let solutionAS   = [], currentStepAS = 0, playIntervalAS = null;

// ── Relógio ───────────────────────────────────────────────
function updateClock() {
  const d = new Date();
  document.getElementById('clock').textContent =
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
updateClock();
setInterval(updateClock, 15000);

// ── Abas ──────────────────────────────────────────────────
function switchTab(name) {
  ['bfs', 'astar', 'compare'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('active', t === name);
    document.getElementById('panel-' + t).classList.toggle('active', t === name);
  });
}

// ── Parse de entrada ──────────────────────────────────────
function parseInput(val) {
  const clean = val.trim();
  if (/^\d{9}$/.test(clean)) return clean.split('').map(Number);
  return clean.split(/\s+/).map(Number);
}

function loadPreset(val) {
  if (!val) return;
  document.getElementById('inputState').value = val;
  solveAll();
}

// ── Resolve com BFS e A* ─────────────────────────────────
function solveAll() {
  stopPlay();
  stopPlayAS();

  const raw = parseInput(document.getElementById('inputState').value);

  if (raw.length !== 9 || raw.some(isNaN) || [...raw].sort((a, b) => a - b).join('') !== '012345678') {
    setLog('❌ Entrada inválida!', '#cc0000');
    setStatus('Erro na entrada', 'BFS + A* | v2.0');
    return;
  }

  renderBig(raw, null);
  renderBigAS(raw, null);

  if (!isSolvable(raw)) {
    clearStats();
    setLog('❌ Sem solução (número ímpar de inversões).', '#cc0000');
    document.getElementById('asLogMsg').textContent = '❌ Sem solução para este estado.';
    document.getElementById('asLogMsg').style.color = '#cc0000';
    updateCompareTable(null, null);
    setStatus('Sem solução', 'BFS + A* | v2.0');
    return;
  }

  setTimeout(() => {
    // ── BFS ────────────────────────────────────────────────
    const t0 = performance.now();
    const resBFS = bfs(raw);
    const timeBFS = (performance.now() - t0).toFixed(1);

    // ── A* ─────────────────────────────────────────────────
    const t1 = performance.now();
    const resAS = astar(raw);
    const timeAS = (performance.now() - t1).toFixed(1);

    // ── Preenche aba BFS ───────────────────────────────────
    solution = [{ state: raw, move: null }, ...(resBFS ? resBFS.path : [])];
    currentStep = 0;
    if (resBFS) {
      setEl('statMoves',  resBFS.path.length);
      setEl('statTested', resBFS.tested);
      setEl('statTime',   timeBFS);
      setEl('statDepth',  resBFS.path.length);
      document.getElementById('slider').max   = solution.length - 1;
      document.getElementById('slider').value = 0;
      document.getElementById('progressBar').style.width = '100%';
      setLog(`✔ BFS: ${resBFS.path.length} movimento(s) | ${resBFS.tested} estados testados`, '#006600');
      renderSteps();
      goToStep(0);
    }

    // ── Preenche aba A* ────────────────────────────────────
    solutionAS = [{ state: raw, move: null }, ...(resAS ? resAS.path : [])];
    currentStepAS = 0;
    if (resAS) {
      setEl('asStatMoves',  resAS.path.length);
      setEl('asStatTested', resAS.tested);
      setEl('asStatTime',   timeAS);
      setEl('asStatDepth',  resAS.path.length);
      document.getElementById('sliderAS').max   = solutionAS.length - 1;
      document.getElementById('sliderAS').value = 0;
      document.getElementById('asProgressBar').style.width = '100%';
      document.getElementById('asLogMsg').textContent =
        `✔ A*: ${resAS.path.length} movimento(s) | ${resAS.tested} estados testados`;
      document.getElementById('asLogMsg').style.color = '#006600';
      renderStepsAS();
      goToStepAS(0);
    }

    // ── Comparativo ────────────────────────────────────────
    updateCompareTable(
      resBFS ? { moves: resBFS.path.length, tested: resBFS.tested, time: +timeBFS } : null,
      resAS  ? { moves: resAS.path.length,  tested: resAS.tested,  time: +timeAS  } : null
    );

    if (resBFS) renderMiniBoard('cmpBoardBFS', solution[solution.length - 1].state);
    if (resAS)  renderMiniBoard('cmpBoardAS',  solutionAS[solutionAS.length - 1].state);
    if (resBFS) document.getElementById('cmpMoveBFS').textContent = `${resBFS.path.length} mov • ${resBFS.tested} estados`;
    if (resAS)  document.getElementById('cmpMoveAS').textContent  = `${resAS.path.length} mov • ${resAS.tested} estados`;

    setStatus(
      `BFS: ${resBFS?.path.length ?? '—'} mov | A*: ${resAS?.path.length ?? '—'} mov`,
      `BFS: ${timeBFS}ms | A*: ${timeAS}ms`
    );

    const reduction = resBFS && resAS
      ? ((1 - resAS.tested / resBFS.tested) * 100).toFixed(1)
      : null;
    document.getElementById('balloonDetail').textContent =
      reduction !== null ? `A* reduziu ${reduction}% dos estados!` : '';
    showBalloon();
  }, 20);
}

// ── Tabela comparativa ────────────────────────────────────
function updateCompareTable(bfsData, asData) {
  const tbody = document.getElementById('cmpBody');
  if (!bfsData && !asData) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;padding:12px;">Execute uma busca para ver a comparação.</td></tr>';
    document.getElementById('analysisText').textContent = 'Execute uma busca para ver a análise automática.';
    return;
  }

  const rows = [
    { label: 'Movimentos na solução',  bfs: bfsData?.moves,  as: asData?.moves,  lowerBetter: true },
    { label: 'Estados testados',       bfs: bfsData?.tested, as: asData?.tested, lowerBetter: true },
    { label: 'Tempo de execução (ms)', bfs: bfsData?.time,   as: asData?.time,   lowerBetter: true },
  ];

  tbody.innerHTML = rows.map(r => {
    const bv = r.bfs ?? '—', av = r.as ?? '—';
    const bWin = typeof bv === 'number' && typeof av === 'number' && bv <= av;
    const aWin = typeof bv === 'number' && typeof av === 'number' && av <= bv;
    const badge = bv < av ? '<span class="winner-badge">BFS</span>'
                : av < bv ? '<span class="winner-badge">A*</span>'
                : '<span style="color:#888">Empate</span>';
    return `<tr>
      <td class="metric">${r.label}</td>
      <td class="num ${bv < av ? 'win' : av < bv ? 'lose' : ''}">${bv}</td>
      <td class="num ${av < bv ? 'win' : bv < av ? 'lose' : ''}">${av}</td>
      <td>${badge}</td>
    </tr>`;
  }).join('');

  if (bfsData && asData) {
    const redEstados = ((1 - asData.tested / bfsData.tested) * 100).toFixed(1);
    const redTempo   = ((1 - asData.time   / bfsData.time  ) * 100).toFixed(1);
    document.getElementById('analysisText').innerHTML =
      `O A* com Distância Manhattan explorou <b>${asData.tested}</b> estados contra <b>${bfsData.tested}</b> do BFS — uma redução de <b>${redEstados}%</b>.<br>
       Em tempo, o A* foi ${+redTempo > 0 ? `<b>${redTempo}% mais rápido</b>` : `comparável (${Math.abs(redTempo)}% mais lento)`}.<br>
       Ambos encontraram soluções com <b>${bfsData.moves} movimentos</b> (ótimas e idênticas em tamanho).<br><br>
       <b>Por que o A* explora menos?</b> A heurística Manhattan direciona a busca em direção ao objetivo,
       evitando expandir estados "claramente ruins". O BFS ignora qualquer informação sobre o objetivo
       e expande todos os estados igualmente — ótimo, mas ineficiente.`;
  }
}

// ── Render tabuleiro grande ───────────────────────────────
function renderBig(state, move) {
  const g = document.getElementById('bigPuzzle');
  g.innerHTML = '';
  state.forEach(v => {
    const d = document.createElement('div');
    d.className = 'tile' + (v === 0 ? ' empty' : '');
    d.textContent = v === 0 ? '' : v;
    g.appendChild(d);
  });
  const md = document.getElementById('moveDisplay');
  if (move) { md.textContent = MOVE_LABELS[move] || move.toUpperCase(); md.style.color = '#00ff00'; }
  else      { md.textContent = solution.length > 1 ? '● INÍCIO' : 'AGUARDANDO...'; md.style.color = '#ffff00'; }
}

function renderBigAS(state, move) {
  const g = document.getElementById('bigPuzzleAS');
  g.innerHTML = '';
  state.forEach(v => {
    const d = document.createElement('div');
    d.className = 'tile' + (v === 0 ? ' empty' : '');
    d.textContent = v === 0 ? '' : v;
    g.appendChild(d);
  });
  const md = document.getElementById('moveDisplayAS');
  if (move) { md.textContent = MOVE_LABELS[move] || move.toUpperCase(); md.style.color = '#ff9900'; }
  else      { md.textContent = solutionAS.length > 1 ? '● INÍCIO' : 'AGUARDANDO...'; md.style.color = '#ff9900'; }
}

// ── Render tabuleiro mini (comparativo) ───────────────────
function renderMiniBoard(containerId, state) {
  const g = document.getElementById(containerId);
  g.innerHTML = '';
  state.forEach(v => {
    const d = document.createElement('div');
    d.className = 'tile-mini' + (v === 0 ? ' empty' : '');
    d.textContent = v === 0 ? '' : v;
    g.appendChild(d);
  });
}

// ── Render faixa de passos ────────────────────────────────
function renderSteps() {
  const inner = document.getElementById('stepsInner');
  inner.innerHTML = '';
  solution.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'step-thumb' + (i === currentStep ? ' active' : '');
    div.onclick = () => goToStep(i);
    const grid = s.state.map(v =>
      `<div class="mini-tile${v === 0 ? ' empty' : ''}">${v === 0 ? '' : v}</div>`
    ).join('');
    div.innerHTML = `<div class="mini-grid">${grid}</div><div class="step-lbl">P${i}${s.move ? ' ' + s.move.slice(0, 3).toUpperCase() : ''}</div>`;
    inner.appendChild(div);
  });
}

function renderStepsAS() {
  const inner = document.getElementById('stepsInnerAS');
  inner.innerHTML = '';
  solutionAS.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'step-thumb' + (i === currentStepAS ? ' active' : '');
    div.onclick = () => goToStepAS(i);
    const grid = s.state.map(v =>
      `<div class="mini-tile${v === 0 ? ' empty' : ''}">${v === 0 ? '' : v}</div>`
    ).join('');
    div.innerHTML = `<div class="mini-grid">${grid}</div><div class="step-lbl">P${i}${s.move ? ' ' + s.move.slice(0, 3).toUpperCase() : ''}</div>`;
    inner.appendChild(div);
  });
}

// ── Navegação BFS ─────────────────────────────────────────
function goToStep(idx) {
  if (!solution.length) return;
  currentStep = Math.max(0, Math.min(idx, solution.length - 1));
  const s = solution[currentStep];
  renderBig(s.state, s.move);
  document.getElementById('slider').value = currentStep;
  document.getElementById('stepLabel').textContent = `${currentStep}/${solution.length - 1}`;
  document.querySelectorAll('#stepsInner .step-thumb').forEach((el, i) =>
    el.classList.toggle('active', i === currentStep)
  );
  const active = document.querySelectorAll('#stepsInner .step-thumb')[currentStep];
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}
function stepFwd()  { if (currentStep < solution.length - 1) goToStep(currentStep + 1); }
function stepBack() { if (currentStep > 0) goToStep(currentStep - 1); }
function togglePlay() {
  if (playInterval) { stopPlay(); return; }
  document.getElementById('playBtn').textContent = '⏸ Pause';
  playInterval = setInterval(() => {
    if (currentStep >= solution.length - 1) { stopPlay(); return; }
    stepFwd();
  }, 650);
}
function stopPlay() {
  clearInterval(playInterval); playInterval = null;
  document.getElementById('playBtn').textContent = '▶ Play';
}

// ── Navegação A* ──────────────────────────────────────────
function goToStepAS(idx) {
  if (!solutionAS.length) return;
  currentStepAS = Math.max(0, Math.min(idx, solutionAS.length - 1));
  const s = solutionAS[currentStepAS];
  renderBigAS(s.state, s.move);
  document.getElementById('sliderAS').value = currentStepAS;
  document.getElementById('stepLabelAS').textContent = `${currentStepAS}/${solutionAS.length - 1}`;
  document.querySelectorAll('#stepsInnerAS .step-thumb').forEach((el, i) =>
    el.classList.toggle('active', i === currentStepAS)
  );
  const active = document.querySelectorAll('#stepsInnerAS .step-thumb')[currentStepAS];
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}
function stepFwdAS()  { if (currentStepAS < solutionAS.length - 1) goToStepAS(currentStepAS + 1); }
function stepBackAS() { if (currentStepAS > 0) goToStepAS(currentStepAS - 1); }
function togglePlayAS() {
  if (playIntervalAS) { stopPlayAS(); return; }
  document.getElementById('playBtnAS').textContent = '⏸ Pause';
  playIntervalAS = setInterval(() => {
    if (currentStepAS >= solutionAS.length - 1) { stopPlayAS(); return; }
    stepFwdAS();
  }, 650);
}
function stopPlayAS() {
  clearInterval(playIntervalAS); playIntervalAS = null;
  document.getElementById('playBtnAS').textContent = '▶ Play';
}

// ── Helpers de UI ─────────────────────────────────────────
function setEl(id, val)    { document.getElementById(id).textContent = val; }
function setLog(msg, color) {
  const el = document.getElementById('logMsg');
  el.textContent = msg; el.style.color = color || '#000';
}
function setStatus(l, r) {
  document.getElementById('statusLeft').textContent = l;
  if (r !== undefined) document.getElementById('statusRight').textContent = r;
}
function showBalloon() {
  const b = document.getElementById('balloon');
  b.classList.add('show');
  setTimeout(() => b.classList.remove('show'), 3500);
}
function clearStats() {
  ['statMoves','statTested','statTime','statDepth',
   'asStatMoves','asStatTested','asStatTime','asStatDepth'].forEach(id => setEl(id, '—'));
  document.getElementById('progressBar').style.width   = '0%';
  document.getElementById('asProgressBar').style.width = '0%';
  solution = []; solutionAS = []; currentStep = 0; currentStepAS = 0;
  document.getElementById('stepsInner').innerHTML =
    '<i style="color:#aaa;font-size:11px;line-height:80px;padding:0 12px">Aguardando solução...</i>';
  document.getElementById('stepsInnerAS').innerHTML =
    '<i style="color:#aaa;font-size:11px;line-height:80px;padding:0 12px">Aguardando solução...</i>';
}

function resetAll() {
  stopPlay(); stopPlayAS();
  clearStats();
  document.getElementById('inputState').value = '';
  document.getElementById('presetSel').value  = '';
  document.getElementById('bigPuzzle').innerHTML   = '';
  document.getElementById('bigPuzzleAS').innerHTML = '';
  document.getElementById('moveDisplay').textContent   = 'AGUARDANDO...';
  document.getElementById('moveDisplayAS').textContent = 'AGUARDANDO...';
  document.getElementById('moveDisplay').style.color   = '#ffff00';
  document.getElementById('moveDisplayAS').style.color = '#ff9900';
  document.getElementById('slider').max = 0;   document.getElementById('slider').value = 0;
  document.getElementById('sliderAS').max = 0; document.getElementById('sliderAS').value = 0;
  document.getElementById('stepLabel').textContent   = '0/0';
  document.getElementById('stepLabelAS').textContent = '0/0';
  setLog('Pronto.', '#000');
  document.getElementById('asLogMsg').textContent  = 'Pronto.';
  document.getElementById('asLogMsg').style.color  = '#804000';
  updateCompareTable(null, null);
  document.getElementById('cmpBoardBFS').innerHTML = '';
  document.getElementById('cmpBoardAS').innerHTML  = '';
  document.getElementById('cmpMoveBFS').textContent = '—';
  document.getElementById('cmpMoveAS').textContent  = '—';
  setStatus('Pronto', 'BFS + A* | v2.0 ready');
}

// ── Boot ──────────────────────────────────────────────────
solveAll();