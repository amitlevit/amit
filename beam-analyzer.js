const state = {
  beams: [],
  supports: [],
  loads: [],
  nextId: 1,
  selected: null
};

const ui = {
  beamList: document.getElementById('beamList'),
  supportList: document.getElementById('supportList'),
  loadList: document.getElementById('loadList'),
  sceneSvg: document.getElementById('sceneSvg'),
  statusBox: document.getElementById('statusBox'),
  resultBox: document.getElementById('resultBox'),
  resultSummary: document.getElementById('resultSummary'),
  equationsBox: document.getElementById('equationsBox'),
  editPanel: document.getElementById('editPanel'),
  editHint: document.getElementById('editHint'),
  editName: document.getElementById('editName'),
  editX: document.getElementById('editX'),
  editY: document.getElementById('editY'),
  editX2: document.getElementById('editX2'),
  editY2: document.getElementById('editY2'),
  editType: document.getElementById('editType'),
  editMagnitude: document.getElementById('editMagnitude'),
  editAngle: document.getElementById('editAngle'),
  editDirection: document.getElementById('editDirection'),
  applyEditBtn: document.getElementById('applyEditBtn'),
  deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),
  cancelSelectionBtn: document.getElementById('cancelSelectionBtn')
};

function makeId(prefix) {
  return `${prefix}-${state.nextId++}`;
}

function readNumber(id) {
  return Number(document.getElementById(id).value);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return Math.abs(value) < 0.01 ? '0.00' : value.toFixed(2);
}

function point(x, y) {
  return { x, y };
}

function getSelectedItem() {
  if (!state.selected) {
    return null;
  }

  if (state.selected.type === 'beam') {
    const beam = state.beams.find((item) => item.id === state.selected.id);
    if (!beam) {
      return null;
    }
    beam.kind = 'beam';
    return beam;
  }

  if (state.selected.type === 'support') {
    const support = state.supports.find((item) => item.id === state.selected.id);
    if (!support) {
      return null;
    }
    support.kind = 'support';
    return support;
  }

  if (state.selected.type === 'load') {
    const load = state.loads.find((item) => item.id === state.selected.id);
    if (!load) {
      return null;
    }
    load.kind = 'load';
    return load;
  }

  return null;
}

function refreshSelectionPanel() {
  const item = getSelectedItem();

  if (!item) {
    ui.editPanel.style.display = 'none';
    return;
  }

  const safeStart = item.start || point(0, 0);
  const safeEnd = item.end || point(0, 0);
  const safePosition = item.position || point(0, 0);

  ui.editPanel.style.display = 'block';
  ui.editName.value = item.name || '';

  if (item.kind === 'beam') {
    ui.editX.parentElement.style.display = 'block';
    ui.editY.parentElement.style.display = 'block';
    ui.editX2.parentElement.style.display = 'block';
    ui.editY2.parentElement.style.display = 'block';
    ui.editType.parentElement.style.display = 'none';
    ui.editMagnitude.parentElement.style.display = 'none';
    ui.editAngle.parentElement.style.display = 'none';
    ui.editDirection.parentElement.style.display = 'none';

    ui.editX.value = safeStart.x;
    ui.editY.value = safeStart.y;
    ui.editX2.value = safeEnd.x;
    ui.editY2.value = safeEnd.y;
    return;
  }

  if (item.kind === 'support') {
    ui.editX.parentElement.style.display = 'block';
    ui.editY.parentElement.style.display = 'block';
    ui.editX2.parentElement.style.display = 'none';
    ui.editY2.parentElement.style.display = 'none';
    ui.editType.parentElement.style.display = 'block';
    ui.editMagnitude.parentElement.style.display = 'none';
    ui.editAngle.parentElement.style.display = 'none';
    ui.editDirection.parentElement.style.display = 'none';

    ui.editX.value = safePosition.x;
    ui.editY.value = safePosition.y;
    ui.editType.value = item.type || 'pin';
    return;
  }

  ui.editX.parentElement.style.display = 'block';
  ui.editY.parentElement.style.display = 'block';
  ui.editX2.parentElement.style.display = 'none';
  ui.editY2.parentElement.style.display = 'none';
  ui.editType.parentElement.style.display = 'none';
  ui.editMagnitude.parentElement.style.display = 'block';
  ui.editAngle.parentElement.style.display = item.type === 'force' ? 'block' : 'none';
  ui.editDirection.parentElement.style.display = item.type === 'moment' ? 'block' : 'none';

  ui.editX.value = safePosition.x;
  ui.editY.value = safePosition.y;
  ui.editMagnitude.value = item.magnitude ?? 0;
  ui.editAngle.value = item.angle ?? 0;
  ui.editDirection.value = item.direction ?? 'ccw';
}

function clearSelection() {
  state.selected = null;
  ui.editPanel.style.display = 'none';
}

function setSelected(type, id) {
  state.selected = { type, id };
  refreshSelectionPanel();
}

function handleSceneClick(event) {
  const target = event.target.closest('[data-kind]');

  if (!target) {
    clearSelection();
    return;
  }

  setSelected(target.dataset.kind, target.dataset.id);
}

function deleteSelected() {
  const item = getSelectedItem();

  if (!item) {
    return;
  }

  if (item.kind === 'beam') {
    state.beams = state.beams.filter((beam) => beam.id !== item.id);
  } else if (item.kind === 'support') {
    state.supports = state.supports.filter((support) => support.id !== item.id);
  } else if (item.kind === 'load') {
    state.loads = state.loads.filter((load) => load.id !== item.id);
  }

  clearSelection();
  renderAll();
}

function applyEdit() {
  const item = getSelectedItem();

  if (!item) {
    return;
  }

  if (item.kind === 'beam') {
    item.start = point(Number(ui.editX.value), Number(ui.editY.value));
    item.end = point(Number(ui.editX2.value), Number(ui.editY2.value));
    ui.editHint.textContent = 'קורה עודכנה.';
    renderAll();
    setSelected('beam', item.id);
    return;
  }

  if (item.kind === 'support') {
    item.position = point(Number(ui.editX.value), Number(ui.editY.value));
    item.type = ui.editType.value;
    ui.editHint.textContent = 'סמך עודכן.';
    renderAll();
    setSelected('support', item.id);
    return;
  }

  const magnitude = Number(ui.editMagnitude.value);
  const position = point(Number(ui.editX.value), Number(ui.editY.value));
  const angle = Number(ui.editAngle.value);

  item.position = position;
  item.magnitude = magnitude;

  if (item.type === 'force') {
    item.angle = angle;
    const rad = (angle * Math.PI) / 180;
    item.fx = magnitude * Math.cos(rad);
    item.fy = magnitude * Math.sin(rad);
    ui.editHint.textContent = 'כוח עודכן.';
  } else {
    item.direction = ui.editDirection.value;
    item.moment = item.direction === 'ccw' ? magnitude : -magnitude;
    ui.editHint.textContent = 'מומנט עודכן.';
  }

  renderAll();
  setSelected('load', item.id);
}

function addBeam() {
  const beam = {
    id: makeId('beam'),
    name: `קורה ${state.beams.length + 1}`,
    start: point(readNumber('beamStartX'), readNumber('beamStartY')),
    end: point(readNumber('beamEndX'), readNumber('beamEndY'))
  };

  state.beams.push(beam);
  renderAll();
}

function addSupport() {
  const support = {
    id: makeId('support'),
    name: `סמך ${state.supports.length + 1}`,
    type: document.getElementById('supportType').value,
    position: point(readNumber('supportX'), readNumber('supportY'))
  };

  state.supports.push(support);
  renderAll();
}

function addLoad() {
  const type = document.getElementById('loadType').value;
  const magnitude = readNumber('loadMagnitude');
  const angle = readNumber('loadAngle');
  const dir = document.getElementById('loadDir').value;

  const load = {
    id: makeId('load'),
    name: `עומס ${state.loads.length + 1}`,
    type,
    position: point(readNumber('loadX'), readNumber('loadY'))
  };

  if (type === 'force') {
    const rad = (angle * Math.PI) / 180;
    load.fx = magnitude * Math.cos(rad);
    load.fy = magnitude * Math.sin(rad);
    load.magnitude = magnitude;
    load.angle = angle;
  } else {
    load.moment = dir === 'ccw' ? magnitude : -magnitude;
    load.magnitude = magnitude;
    load.direction = dir;
  }

  state.loads.push(load);
  renderAll();
}

function clearAll() {
  state.beams = [];
  state.supports = [];
  state.loads = [];
  state.nextId = 1;
  clearSelection();
  ui.statusBox.style.display = 'none';
  ui.resultBox.style.display = 'none';
  renderAll();
}

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

function normalize(x, y) {
  const len = Math.hypot(x, y);
  if (len === 0) {
    return { x: 0, y: 1 };
  }
  return { x: x / len, y: y / len };
}

function getBeamNearestPoint(point) {
  if (!state.beams.length) {
    return null;
  }

  let best = null;

  for (const beam of state.beams) {
    const sx = beam.start.x;
    const sy = beam.start.y;
    const ex = beam.end.x;
    const ey = beam.end.y;
    const dx = ex - sx;
    const dy = ey - sy;
    const segmentLengthSq = dx * dx + dy * dy;

    let t = 0;
    if (segmentLengthSq > 0) {
      t = ((point.x - sx) * dx + (point.y - sy) * dy) / segmentLengthSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = sx + dx * t;
    const projY = sy + dy * t;
    const dist = Math.hypot(point.x - projX, point.y - projY);

    if (!best || dist < best.distance) {
      best = {
        beam,
        distance: dist,
        projX,
        projY,
        tangent: normalize(dx, dy),
        normal: normalize(-dy, dx)
      };
    }
  }

  return best;
}

function getSupportDirection(support) {
  const nearest = getBeamNearestPoint(support.position);
  if (nearest) {
    return nearest.normal;
  }
  return { x: 0, y: 1 };
}

function getReactionUnknowns() {
  const unknowns = [];

  for (const support of state.supports) {
    const dir = getSupportDirection(support);
    const momentArmX = support.position.x;
    const momentArmY = support.position.y;

    if (support.type === 'roller') {
      unknowns.push({
        supportId: support.id,
        label: `${support.name} Rn`,
        row: [dir.x, dir.y, cross(support.position.x, support.position.y, dir.x, dir.y)]
      });
      continue;
    }

    if (support.type === 'pin') {
      unknowns.push({
        supportId: support.id,
        label: `${support.name} Rx`,
        row: [1, 0, -momentArmY]
      });
      unknowns.push({
        supportId: support.id,
        label: `${support.name} Ry`,
        row: [0, 1, momentArmX]
      });
      continue;
    }

    unknowns.push({
      supportId: support.id,
      label: `${support.name} Rx`,
      row: [1, 0, -momentArmY]
    });
    unknowns.push({
      supportId: support.id,
      label: `${support.name} Ry`,
      row: [0, 1, momentArmX]
    });
    unknowns.push({
      supportId: support.id,
      label: `${support.name} M`,
      row: [0, 0, 1]
    });
  }

  return unknowns;
}

function solveLeastSquares(matrix, rhs) {
  const n = matrix[0].length;

  if (n === 0) {
    return { ok: true, solution: [] };
  }

  const normal = Array.from({ length: n }, () => Array(n).fill(0));
  const normalRhs = Array(n).fill(0);

  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      let sum = 0;
      for (let row = 0; row < 3; row += 1) {
        sum += matrix[row][i] * matrix[row][j];
      }
      normal[i][j] = sum;
    }

    let rhsSum = 0;
    for (let row = 0; row < 3; row += 1) {
      rhsSum += matrix[row][i] * rhs[row];
    }
    normalRhs[i] = rhsSum;
  }

  const regularized = normal.map((row, index) => row.map((value, colIndex) => value + (index === colIndex ? 1e-8 : 0)));
  const solution = solveSystem(regularized, normalRhs);

  if (!solution.ok) {
    return {
      ok: false,
      reason: 'מערכת לא קבועה סטטית או חסרות משוואות בלתי-תלויות לשחזור תגובות.'
    };
  }

  return { ok: true, solution: solution.solution };
}

function externalResultants() {
  let sumFx = 0;
  let sumFy = 0;
  let sumM = 0;

  for (const load of state.loads) {
    if (load.type === 'force') {
      sumFx += load.fx;
      sumFy += load.fy;
      sumM += cross(load.position.x, load.position.y, load.fx, load.fy);
    } else {
      sumM += load.moment;
    }
  }

  return { sumFx, sumFy, sumM };
}

function solveSystem(matrix, rhs) {
  const n = matrix[0].length;
  const m = matrix.length;

  if (n === 0) {
    return { ok: true, solution: [] };
  }

  if (m !== n) {
    return { ok: false, reason: 'מערכת לא קבועה סטטית: מספר המשוואות אינו תואם למספר הנעלמים.' };
  }

  const aug = matrix.map((row, rowIndex) => row.slice().concat(rhs[rowIndex]));
  let pivotRow = 0;
  const pivots = [];

  for (let col = 0; col < n && pivotRow < m; col += 1) {
    let pivot = pivotRow;
    let maxAbs = Math.abs(aug[pivot][col]);

    for (let r = pivotRow + 1; r < m; r += 1) {
      const absVal = Math.abs(aug[r][col]);
      if (absVal > maxAbs) {
        maxAbs = absVal;
        pivot = r;
      }
    }

    if (Math.abs(aug[pivot][col]) < 1e-9) {
      continue;
    }

    [aug[pivotRow], aug[pivot]] = [aug[pivot], aug[pivotRow]];
    const pivotValue = aug[pivotRow][col];

    for (let j = col; j <= n; j += 1) {
      aug[pivotRow][j] /= pivotValue;
    }

    for (let r = 0; r < m; r += 1) {
      if (r === pivotRow) continue;
      const factor = aug[r][col];
      if (Math.abs(factor) < 1e-9) continue;

      for (let j = col; j <= n; j += 1) {
        aug[r][j] -= factor * aug[pivotRow][j];
      }
    }

    pivots.push(col);
    pivotRow += 1;
  }

  for (let r = 0; r < m; r += 1) {
    const allZero = aug[r].slice(0, n).every((value) => Math.abs(value) < 1e-9);
    if (allZero && Math.abs(aug[r][n]) > 1e-8) {
      return { ok: false, reason: 'המערכת אינה עקבית עם שיווי המשקל.' };
    }
  }

  if (pivots.length < n) {
    return { ok: false, reason: 'אי-יכולת למצוא מערכת בלתי-תלויה של משוואות' };
  }

  const solution = Array(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    const pivotCol = pivots[i];
    solution[pivotCol] = aug[i][n];
  }

  return { ok: true, solution };
}

function solveReactions() {
  const unknowns = getReactionUnknowns();

  if (!state.supports.length) {
    return {
      ok: false,
      message: 'אין סמכים במערכת. הוסיפו סמך לפני חישוב תגובות.'
    };
  }

  const resultants = externalResultants();
  const matrix = [
    unknowns.map((u) => u.row[0]),
    unknowns.map((u) => u.row[1]),
    unknowns.map((u) => u.row[2])
  ];
  const rhs = [-resultants.sumFx, -resultants.sumFy, -resultants.sumM];

  const isIndeterminate = unknowns.length > 3;
  const solution = isIndeterminate ? solveLeastSquares(matrix, rhs) : solveSystem(matrix, rhs);

  if (!solution.ok) {
    return {
      ok: false,
      message: solution.reason
    };
  }

  const supportMap = new Map();
  for (const support of state.supports) {
    supportMap.set(support.id, {
      name: support.name,
      type: support.type,
      rx: 0,
      ry: 0,
      moment: 0,
      scalar: 0,
      direction: getSupportDirection(support)
    });
  }

  unknowns.forEach((unknown, index) => {
    const value = solution.solution[index];
    const support = supportMap.get(unknown.supportId);

    if (support.type === 'roller') {
      support.scalar += value;
      support.rx += value * support.direction.x;
      support.ry += value * support.direction.y;
      return;
    }

    if (unknown.label.endsWith('Rx')) {
      support.rx += value;
      return;
    }

    if (unknown.label.endsWith('Ry')) {
      support.ry += value;
      return;
    }

    support.moment += value;
  });

  return {
    ok: true,
    indeterminate: isIndeterminate,
    supportMap,
    equations: {
      sumFx: resultants.sumFx,
      sumFy: resultants.sumFy,
      sumM: resultants.sumM
    }
  };
}

function renderList(container, items, kind) {
  container.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'item';
    empty.innerHTML = `<strong>${kind === 'beams' ? 'אין קורות עדיין' : kind === 'supports' ? 'אין סמכים עדיין' : 'אין עומסים עדיין'}</strong>`;
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'item';

    if (kind === 'beams') {
      wrapper.innerHTML = `<strong>${item.name}</strong><small>התחלה (${formatNumber(item.start.x)}, ${formatNumber(item.start.y)})</small><small>סיום (${formatNumber(item.end.x)}, ${formatNumber(item.end.y)})</small>`;
    }

    if (kind === 'supports') {
      wrapper.innerHTML = `<strong>${item.name}</strong><small>סוג: ${item.type}</small><small>נ位置 (${formatNumber(item.position.x)}, ${formatNumber(item.position.y)})</small>`;
    }

    if (kind === 'loads') {
      if (item.type === 'force') {
        wrapper.innerHTML = `<strong>${item.name}</strong><small>כוח: ${formatNumber(item.magnitude)} N, זווית ${formatNumber(item.angle)}°</small><small>נקודה (${formatNumber(item.position.x)}, ${formatNumber(item.position.y)})</small>`;
      } else {
        wrapper.innerHTML = `<strong>${item.name}</strong><small>מומנט: ${formatNumber(item.magnitude)} N·m, ${item.direction === 'ccw' ? 'נגד כיוון השעון' : 'עם כיוון השעון'}</small><small>נקודה (${formatNumber(item.position.x)}, ${formatNumber(item.position.y)})</small>`;
      }
    }

    container.appendChild(wrapper);
  });
}

function getSceneBounds() {
  const all = [];

  for (const beam of state.beams) {
    all.push(beam.start, beam.end);
  }
  for (const support of state.supports) {
    all.push(support.position);
  }
  for (const load of state.loads) {
    all.push(load.position);
  }

  if (!all.length) {
    return {
      minX: -1,
      maxX: 1,
      minY: -1,
      maxY: 1
    };
  }

  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxY = Math.max(...all.map((p) => p.y));

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return {
    minX: minX - width * 0.2 - 0.5,
    maxX: maxX + width * 0.2 + 0.5,
    minY: minY - height * 0.2 - 0.5,
    maxY: maxY + height * 0.2 + 0.5
  };
}

function project(point, bounds) {
  const width = 1000;
  const height = 560;
  const padX = 80;
  const padY = 70;
  const scaleX = (width - padX * 2) / (bounds.maxX - bounds.minX);
  const scaleY = (height - padY * 2) / (bounds.maxY - bounds.minY);
  const scale = Math.min(scaleX, scaleY, 1.5);

  const x = padX + (point.x - bounds.minX) * scale;
  const y = height - padY - (point.y - bounds.minY) * scale;
  return { x, y };
}

function drawArrow(container, from, to, color, label) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return;
  }

  const angle = Math.atan2(dy, dx);
  const headLen = 12;
  const headAngle = Math.PI / 7;

  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  marker.setAttribute('d', `M ${to.x} ${to.y} L ${to.x - headLen * Math.cos(angle - headAngle)} ${to.y - headLen * Math.sin(angle - headAngle)} M ${to.x} ${to.y} L ${to.x - headLen * Math.cos(angle + headAngle)} ${to.y - headLen * Math.sin(angle + headAngle)}`);
  marker.setAttribute('stroke', color);
  marker.setAttribute('stroke-width', '2.5');
  marker.setAttribute('fill', 'none');

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', from.x);
  line.setAttribute('y1', from.y);
  line.setAttribute('x2', to.x);
  line.setAttribute('y2', to.y);
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '2.5');
  line.setAttribute('stroke-linecap', 'round');

  container.appendChild(line);
  container.appendChild(marker);

  if (label) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', (from.x + to.x) / 2);
    text.setAttribute('y', (from.y + to.y) / 2 - 12);
    text.setAttribute('fill', '#e2e8f0');
    text.setAttribute('font-size', '13');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = label;
    container.appendChild(text);
  }
}

function drawSupport(support, bounds) {
  const p = project(support.position, bounds);
  const selected = state.selected?.type === 'support' && state.selected?.id === support.id;
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('data-kind', 'support');
  group.setAttribute('data-id', support.id);
  group.setAttribute('style', 'cursor:pointer');

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', p.x);
  circle.setAttribute('cy', p.y);
  circle.setAttribute('r', 10);
  circle.setAttribute('fill', selected ? '#fde68a' : '#f59e0b');
  circle.setAttribute('stroke', '#ffffff');
  circle.setAttribute('stroke-width', '2');

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', p.x + 14);
  text.setAttribute('y', p.y - 12);
  text.setAttribute('fill', selected ? '#fff7ed' : '#fef3c7');
  text.setAttribute('font-size', '13');
  text.textContent = support.name;

  group.appendChild(circle);
  group.appendChild(text);

  if (support.type === 'roller') {
    const dir = getSupportDirection(support);
    const n = project({ x: support.position.x + dir.x * 0.75, y: support.position.y + dir.y * 0.75 }, bounds);
    drawArrow(group, p, n, selected ? '#fde68a' : '#f59e0b', 'R');
  }

  if (support.type === 'fixed') {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', p.x - 12);
    rect.setAttribute('y', p.y - 12);
    rect.setAttribute('width', 24);
    rect.setAttribute('height', 24);
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', selected ? '#fde68a' : '#f59e0b');
    rect.setAttribute('stroke-width', '2');
    group.appendChild(rect);
  }

  if (support.type === 'pin') {
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', p.x - 10);
    line1.setAttribute('y1', p.y - 12);
    line1.setAttribute('x2', p.x + 10);
    line1.setAttribute('y2', p.y - 12);
    line1.setAttribute('stroke', selected ? '#fde68a' : '#f59e0b');
    line1.setAttribute('stroke-width', '2');
    group.appendChild(line1);
  }

  ui.sceneSvg.appendChild(group);
}

function drawBeam(beam, bounds) {
  const start = project(beam.start, bounds);
  const end = project(beam.end, bounds);
  const selected = state.selected?.type === 'beam' && state.selected?.id === beam.id;

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('data-kind', 'beam');
  group.setAttribute('data-id', beam.id);
  group.setAttribute('style', 'cursor:pointer');

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', start.x);
  line.setAttribute('y1', start.y);
  line.setAttribute('x2', end.x);
  line.setAttribute('y2', end.y);
  line.setAttribute('stroke', selected ? '#facc15' : '#38bdf8');
  line.setAttribute('stroke-width', selected ? '6' : '4');
  line.setAttribute('stroke-linecap', 'round');

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', (start.x + end.x) / 2);
  text.setAttribute('y', (start.y + end.y) / 2 - 14);
  text.setAttribute('fill', selected ? '#fff7ed' : '#bae6fd');
  text.setAttribute('font-size', '13');
  text.setAttribute('text-anchor', 'middle');
  text.textContent = beam.name;

  group.appendChild(line);
  group.appendChild(text);
  ui.sceneSvg.appendChild(group);
}

function drawLoad(load, bounds) {
  const p = project(load.position, bounds);
  const selected = state.selected?.type === 'load' && state.selected?.id === load.id;
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('data-kind', 'load');
  group.setAttribute('data-id', load.id);
  group.setAttribute('style', 'cursor:pointer');

  if (load.type === 'force') {
    const arrowEnd = {
      x: p.x + load.fx * 12,
      y: p.y - load.fy * 12
    };
    drawArrow(group, p, arrowEnd, selected ? '#fda4af' : '#fb7185', 'F');
  } else {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', p.x);
    circle.setAttribute('cy', p.y);
    circle.setAttribute('r', 12);
    circle.setAttribute('fill', selected ? '#e879f9' : '#c084fc');
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '2');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', p.x);
    text.setAttribute('y', p.y + 5);
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('font-size', '12');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = 'M';

    group.appendChild(circle);
    group.appendChild(text);
  }

  ui.sceneSvg.appendChild(group);
}

function renderScene() {
  ui.sceneSvg.innerHTML = '';

  const bounds = getSceneBounds();
  const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  grid.setAttribute('opacity', '0.14');

  for (let x = Math.floor(bounds.minX); x <= Math.ceil(bounds.maxX); x += 1) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const start = project({ x, y: bounds.minY }, bounds);
    const end = project({ x, y: bounds.maxY }, bounds);
    line.setAttribute('x1', start.x);
    line.setAttribute('y1', start.y);
    line.setAttribute('x2', end.x);
    line.setAttribute('y2', end.y);
    line.setAttribute('stroke', '#cbd5e1');
    line.setAttribute('stroke-width', '1');
    grid.appendChild(line);
  }

  for (let y = Math.floor(bounds.minY); y <= Math.ceil(bounds.maxY); y += 1) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const start = project({ x: bounds.minX, y }, bounds);
    const end = project({ x: bounds.maxX, y }, bounds);
    line.setAttribute('x1', start.x);
    line.setAttribute('y1', start.y);
    line.setAttribute('x2', end.x);
    line.setAttribute('y2', end.y);
    line.setAttribute('stroke', '#cbd5e1');
    line.setAttribute('stroke-width', '1');
    grid.appendChild(line);
  }

  ui.sceneSvg.appendChild(grid);

  state.beams.forEach((beam) => drawBeam(beam, bounds));
  state.supports.forEach((support) => drawSupport(support, bounds));
  state.loads.forEach((load) => drawLoad(load, bounds));
}

function showStatus(message, tone) {
  ui.statusBox.style.display = 'block';
  ui.statusBox.textContent = message;
  ui.statusBox.className = tone === 'ok' ? 'status-ok' : tone === 'warn' ? 'status-warn' : 'status-error';
}

function renderResults(result) {
  if (!result.ok) {
    ui.resultBox.style.display = 'block';
    ui.resultSummary.innerHTML = '<div class="result-item"><strong>מצב</strong><div class="value">לא ניתן חישוב</div></div>';
    ui.equationsBox.innerHTML = `<strong>הודעה:</strong> ${result.message}`;
    return;
  }

  ui.resultBox.style.display = 'block';
  ui.resultSummary.innerHTML = '';

  result.supportMap.forEach((support) => {
    const item = document.createElement('div');
    item.className = 'result-item';

    const rx = formatNumber(support.rx);
    const ry = formatNumber(support.ry);
    const moment = formatNumber(support.moment);

    if (support.type === 'roller') {
      item.innerHTML = `<strong>${support.name}</strong><div class="value">R = ${formatNumber(support.scalar)} N</div><div>Rx = ${rx} N, Ry = ${ry} N</div>`;
    } else if (support.type === 'pin') {
      item.innerHTML = `<strong>${support.name}</strong><div class="value">Rx = ${rx} N, Ry = ${ry} N</div><div>מומנט = ${moment} N·m</div>`;
    } else {
      item.innerHTML = `<strong>${support.name}</strong><div class="value">Rx = ${rx} N, Ry = ${ry} N</div><div>Mz = ${moment} N·m</div>`;
    }

    ui.resultSummary.appendChild(item);
  });

  const eqText = `ΣFx = ${formatNumber(result.equations.sumFx)} N, ΣFy = ${formatNumber(result.equations.sumFy)} N, ΣM = ${formatNumber(result.equations.sumM)} N·m`;
  const note = result.indeterminate
    ? '<div><strong>הערה:</strong> מערכת לא קבועה סטטית — הוצג פתרון מינימום-נורמה תחת שיווי משקל.</div>'
    : '';
  ui.equationsBox.innerHTML = `<strong>שיווי משקל:</strong> ${eqText}${note}`;
}

function applySolution(solution) {
  if (solution.ok) {
    const status = solution.indeterminate
      ? 'מערכת לא קבועה סטטית: חושב פתרון מינימום-נורמה על פי שיווי משקל.'
      : 'תגובות חושבו בהצלחה על פי שיווי משקל סטטי.';
    showStatus(status, solution.indeterminate ? 'warn' : 'ok');
    renderResults(solution);
    return;
  }

  showStatus(solution.message, 'warn');
  renderResults(solution);
}

function renderAll() {
  renderList(ui.beamList, state.beams, 'beams');
  renderList(ui.supportList, state.supports, 'supports');
  renderList(ui.loadList, state.loads, 'loads');
  renderScene();
  refreshSelectionPanel();

  applySolution(solveReactions());
}

function bindEvents() {
  document.getElementById('addBeamBtn').addEventListener('click', addBeam);
  document.getElementById('addSupportBtn').addEventListener('click', addSupport);
  document.getElementById('addLoadBtn').addEventListener('click', addLoad);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  ui.sceneSvg.addEventListener('click', handleSceneClick);
  ui.applyEditBtn.addEventListener('click', applyEdit);
  ui.deleteSelectedBtn.addEventListener('click', deleteSelected);
  ui.cancelSelectionBtn.addEventListener('click', clearSelection);
  document.getElementById('solveBtn').addEventListener('click', () => {
    applySolution(solveReactions());
  });
}

bindEvents();
renderAll();
