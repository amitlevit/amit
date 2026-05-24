#!/usr/bin/env node

const http = require('http');
const https = require('https');

const DEFAULT_E_PA = 200e9;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.get(parsed, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`שגיאת HTTP ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`לא ניתן לפענח JSON: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
  });
}

function gaussianElim(K, F, n) {
  for (let col = 0; col < n; col += 1) {
    let maxRow = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(K[row * n + col]) > Math.abs(K[maxRow * n + col])) {
        maxRow = row;
      }
    }

    for (let k = 0; k < n; k += 1) {
      [K[col * n + k], K[maxRow * n + k]] = [K[maxRow * n + k], K[col * n + k]];
    }
    [F[col], F[maxRow]] = [F[maxRow], F[col]];

    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(K[col * n + col]) < 1e-14) {
        continue;
      }
      const factor = K[row * n + col] / K[col * n + col];
      for (let k = col; k < n; k += 1) {
        K[row * n + k] -= factor * K[col * n + k];
      }
      F[row] -= factor * F[col];
    }
  }

  const u = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    if (Math.abs(K[i * n + i]) < 1e-14) {
      u[i] = 0;
      continue;
    }
    let sum = F[i];
    for (let j = i + 1; j < n; j += 1) {
      sum -= K[i * n + j] * u[j];
    }
    u[i] = sum / K[i * n + i];
  }

  return u;
}

function solveProblem(problem) {
  const {
    nodes,
    members,
    boundary,
    loads,
    rodSide,
    yieldMPa,
    E_PA = DEFAULT_E_PA
  } = problem;

  const n = nodes.length;
  const A = rodSide * rodSide;
  const ndof = 2 * n;

  const fixed = new Set();
  nodes.forEach(([x, y], index) => {
    const pinned =
      (boundary.x_min !== null && x <= boundary.x_min) ||
      (boundary.x_max !== null && x >= boundary.x_max) ||
      (boundary.y_min !== null && y <= boundary.y_min) ||
      (boundary.y_max !== null && y >= boundary.y_max);

    if (pinned) {
      fixed.add(2 * index);
      fixed.add(2 * index + 1);
    }
  });

  const K = new Array(ndof * ndof).fill(0);
  const add = (row, col, value) => {
    K[row * ndof + col] += value;
  };

  members.forEach(([a, b]) => {
    const [x1, y1] = nodes[a];
    const [x2, y2] = nodes[b];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const L = Math.hypot(dx, dy);
    const c = dx / L;
    const s = dy / L;
    const k = E_PA * A / L;
    const km = [
      c * c, c * s, -c * c, -c * s,
      c * s, s * s, -c * s, -s * s,
      -c * c, -c * s, c * c, c * s,
      -c * s, -s * s, c * s, s * s
    ];
    const dofs = [2 * a, 2 * a + 1, 2 * b, 2 * b + 1];

    for (let r = 0; r < 4; r += 1) {
      for (let col = 0; col < 4; col += 1) {
        add(dofs[r], dofs[col], k * km[r * 4 + col]);
      }
    }
  });

  const F = new Array(ndof).fill(0);
  loads.forEach(([node, fx, fy]) => {
    F[2 * node] += fx;
    F[2 * node + 1] += fy;
  });

  fixed.forEach((dof) => {
    for (let i = 0; i < ndof; i += 1) {
      K[dof * ndof + i] = 0;
      K[i * ndof + dof] = 0;
    }
    K[dof * ndof + dof] = 1;
    F[dof] = 0;
  });

  const u = gaussianElim(K.slice(), F.slice(), ndof);

  const membersData = members.map(([a, b], idx) => {
    const [x1, y1] = nodes[a];
    const [x2, y2] = nodes[b];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const L = Math.hypot(dx, dy);
    const c = dx / L;
    const s = dy / L;
    const elongation = (u[2 * b] - u[2 * a]) * c + (u[2 * b + 1] - u[2 * a + 1]) * s;
    const force = E_PA * A / L * elongation;
    const stress = Math.abs(force) / A;
    const safetyFactor = stress > 0 ? yieldMPa / (stress / 1e6) : Infinity;

    return {
      idx,
      a,
      b,
      length: L,
      force,
      stress,
      stressMPa: stress / 1e6,
      safetyFactor,
      type: force >= 0 ? 'מתח' : 'לחץ'
    };
  });

  const nodeForce = Array.from({ length: n }, () => [0, 0]);
  members.forEach(([a, b], idx) => {
    const [x1, y1] = nodes[a];
    const [x2, y2] = nodes[b];
    const L = Math.hypot(x2 - x1, y2 - y1);
    const cx = (x2 - x1) / L;
    const cy = (y2 - y1) / L;
    const axial = membersData[idx].force;

    nodeForce[a][0] += axial * cx;
    nodeForce[a][1] += axial * cy;
    nodeForce[b][0] -= axial * cx;
    nodeForce[b][1] -= axial * cy;
  });

  const appliedAt = {};
  loads.forEach(([node, fx, fy]) => {
    appliedAt[node] = [(appliedAt[node]?.[0] || 0) + fx, (appliedAt[node]?.[1] || 0) + fy];
  });

  const reactions = [];
  fixed.forEach((dof) => {
    const node = Math.floor(dof / 2);
    if (!reactions.find((reaction) => reaction.node === node)) {
      const app = appliedAt[node] || [0, 0];
      reactions.push({
        node,
        Rx: -(nodeForce[node][0] + app[0]),
        Ry: -(nodeForce[node][1] + app[1])
      });
    }
  });

  const minSafetyFactor = membersData.reduce((best, member) => {
    return Number.isFinite(member.safetyFactor) && member.safetyFactor < best ? member.safetyFactor : best;
  }, Infinity);

  return {
    displacements: u,
    members: membersData,
    reactions,
    minSafetyFactor
  };
}

function printResults(problem, result) {
  const areaMm2 = (problem.rodSide * 1000) ** 2;
  const safe = Number.isFinite(result.minSafetyFactor) && result.minSafetyFactor >= 1;

  console.log('\n══════════════════════════════════════════════════');
  console.log('  תוצאות ניתוח מסבך');
  console.log('══════════════════════════════════════════════════');
  console.log(`  חתך: ${problem.rodSide * 1000} מ"מ × ${problem.rodSide * 1000} מ"מ   (A = ${areaMm2.toFixed(2)} מ"מ²)`);
  console.log(`  חומר: E = ${(problem.E_PA || DEFAULT_E_PA) / 1e9} GPa | σ_y = ${problem.yieldMPa} MPa`);
  console.log('──────────────────────────────────────────────────');
  console.log('  מוט │ צמתים              │   אורך   │    כוח    │  מאמץ   │  SF   │ סוג');
  console.log('──────────────────────────────────────────────────');

  result.members.forEach((member) => {
    const sfStr = Number.isFinite(member.safetyFactor) ? member.safetyFactor.toFixed(3) : '∞';
    const forceStr = member.force.toFixed(1).padStart(9);
    const stressStr = member.stressMPa.toFixed(3).padStart(8);
    const nodeDesc = `${member.a}[${problem.nodes[member.a]}]→${member.b}[${problem.nodes[member.b]}]`;
    console.log(`    ${String(member.idx).padEnd(4)} │ ${nodeDesc.padEnd(19)} │ ${member.length.toFixed(3).padStart(7)} מ │${forceStr} N │${stressStr} MPa │ ${sfStr.padStart(5)} │ ${member.type}`);
  });

  console.log('──────────────────────────────────────────────────');
  console.log(`  SF מינימלי = ${Number.isFinite(result.minSafetyFactor) ? result.minSafetyFactor.toFixed(3) : '∞'}   ${safe ? '✓  מסבך בטוח' : '✗  מסבך לא בטוח'}`);

  console.log('\n══════════════════════════════════════════════════');
  console.log('  ראקציות ריתום');
  console.log('══════════════════════════════════════════════════');
  console.log('  צומת │  קואורדינטות  │    Rx      │    Ry');
  console.log('──────────────────────────────────────────────────');

  result.reactions.forEach(({ node, Rx, Ry }) => {
    console.log(`    ${String(node).padEnd(4)} │ [${problem.nodes[node]}]`.padStart(24) + `│ ${Rx.toFixed(2).padStart(10)} N │ ${Ry.toFixed(2).padStart(10)} N`);
  });

  console.log('──────────────────────────────────────────────────');
  console.log('  מקדם ביטחון למסבך: ' + (Number.isFinite(result.minSafetyFactor) ? result.minSafetyFactor.toFixed(3) : '∞'));
  console.log('══════════════════════════════════════════════════\n');

  console.log(JSON.stringify({
    minSafetyFactor: Number.isFinite(result.minSafetyFactor) ? Number(result.minSafetyFactor.toFixed(6)) : null,
    safe,
    reactions: result.reactions,
    members: result.members.map((member) => ({
      idx: member.idx,
      safetyFactor: Number.isFinite(member.safetyFactor) ? Number(member.safetyFactor.toFixed(6)) : null,
      stressMPa: Number(member.stressMPa.toFixed(6)),
      force: Number(member.force.toFixed(6)),
      type: member.type
    }))
  }, null, 2));
}

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error('שימוש: node solve_remote_truss.js <url>');
    process.exit(1);
  }

  try {
    const rawProblem = await fetchJson(url);

    const problem = {
      nodes: rawProblem.nodes,
      members: rawProblem.members,
      boundary: rawProblem.boundary,
      loads: rawProblem.loads,
      rodSide: rawProblem.rodSide,
      yieldMPa: rawProblem.yieldMPa,
      E_PA: rawProblem.E_PA || DEFAULT_E_PA
    };

    const result = solveProblem(problem);
    printResults(problem, result);
  } catch (error) {
    console.error(`שגיאה: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { fetchJson, solveProblem };

if (require.main === module) {
  main();
}
