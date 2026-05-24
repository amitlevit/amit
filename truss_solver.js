// ══════════-════════════════════════════════════════════════════
//  TRUSS SOLVER  —  שיטת קשיחות ישירה (Direct Stiffness Method)
//  הרצה:  node truss_solver.js
//  הגדרת הבעיה נמצאת ב:  truss_config.js
// ══════════════════════════════════════════════════════════════

const { NODES, MEMBERS, BOUNDARY, LOADS, ROD_SIDE, YIELD_MPa, E_PA } = require('./truss_config');

// ══════════════════════════════════════════════════════════════
//  פותר — אל תשנה את מה שמתחת לשורה זו
// ══════════════════════════════════════════════════════════════

function solve() {
    const n    = NODES.length;
    const A    = ROD_SIDE * ROD_SIDE;
    const ndof = 2 * n;

    // ── מזהה צמתים רתומים ──────────────────────────────────────
    const fixed = new Set();
    NODES.forEach(([x, y], i) => {
        const pinned =
            (BOUNDARY.x_min !== null && x <= BOUNDARY.x_min) ||
            (BOUNDARY.x_max !== null && x >= BOUNDARY.x_max) ||
            (BOUNDARY.y_min !== null && y <= BOUNDARY.y_min) ||
            (BOUNDARY.y_max !== null && y >= BOUNDARY.y_max);
        if (pinned) { fixed.add(2 * i); fixed.add(2 * i + 1); }
    });

    // ── מטריצת קשיחות גלובלית ─────────────────────────────────
    const K = new Array(ndof * ndof).fill(0);
    const add = (r, c, v) => { K[r * ndof + c] += v; };

    MEMBERS.forEach(([a, b]) => {
        const [x1, y1] = NODES[a];
        const [x2, y2] = NODES[b];
        const dx = x2 - x1, dy = y2 - y1;
        const L  = Math.hypot(dx, dy);
        const c  = dx / L, s = dy / L;
        const k  = E_PA * A / L;
        const [cc, ss, cs] = [c * c, s * s, c * s];
        const km = [
             cc,  cs, -cc, -cs,
             cs,  ss, -cs, -ss,
            -cc, -cs,  cc,  cs,
            -cs, -ss,  cs,  ss,
        ];
        const dofs = [2 * a, 2 * a + 1, 2 * b, 2 * b + 1];
        for (let r = 0; r < 4; r++)
            for (let cl = 0; cl < 4; cl++)
                add(dofs[r], dofs[cl], k * km[r * 4 + cl]);
    });

    // ── וקטור כוחות ────────────────────────────────────────────
    const F = new Array(ndof).fill(0);
    LOADS.forEach(([nd, fx, fy]) => { F[2 * nd] += fx; F[2 * nd + 1] += fy; });

    // ── תנאי שפה (אפס שורה/עמודה + 1 באלכסון) ─────────────────
    fixed.forEach(d => {
        for (let i = 0; i < ndof; i++) K[d * ndof + i] = K[i * ndof + d] = 0;
        K[d * ndof + d] = 1;
        F[d] = 0;
    });

    // ── פתרון מערכת K·u = F ────────────────────────────────────
    const u = gaussianElim(K.slice(), F.slice(), ndof);

    // ── כוחות, מאמצים, מקדמי בטחון ────────────────────────────
    const members = MEMBERS.map(([a, b], idx) => {
        const [x1, y1] = NODES[a];
        const [x2, y2] = NODES[b];
        const dx = x2 - x1, dy = y2 - y1;
        const L  = Math.hypot(dx, dy);
        const c  = dx / L, s = dy / L;
        const elongation = (u[2*b] - u[2*a]) * c + (u[2*b+1] - u[2*a+1]) * s;
        const force      = E_PA * A / L * elongation;       // חיובי = מתח
        const stress_MPa = Math.abs(force) / A / 1e6;
        const SF         = YIELD_MPa / stress_MPa;
        return { idx, a, b, L: L.toFixed(3), force, stress_MPa, SF, type: force >= 0 ? 'מתח' : 'לחץ' };
    });

    // ── ראקציות בצמתים רתומים ─────────────────────────────────
    // כוח על צומת a ממוט [a,b]: F_axial * (כיוון מ-a ל-b)
    const nodeForce = Array.from({length: n}, () => [0, 0]);
    MEMBERS.forEach(([a, b], idx) => {
        const [x1, y1] = NODES[a];
        const [x2, y2] = NODES[b];
        const L = Math.hypot(x2-x1, y2-y1);
        const cx = (x2-x1)/L, cy = (y2-y1)/L;
        const F_axial = members[idx].force;
        // tension: pulls a toward b, pulls b toward a
        nodeForce[a][0] += F_axial * cx;
        nodeForce[a][1] += F_axial * cy;
        nodeForce[b][0] -= F_axial * cx;
        nodeForce[b][1] -= F_axial * cy;
    });
    // ראקציה = -(כוחות מוטות + עומס מורכב)
    const appliedAt = {};
    LOADS.forEach(([nd, fx, fy]) => { appliedAt[nd] = [(appliedAt[nd]?.[0]||0)+fx, (appliedAt[nd]?.[1]||0)+fy]; });
    const reactions = [];
    fixed.forEach(dof => {
        const ni = Math.floor(dof / 2);
        if (!reactions.find(r => r.node === ni)) {
            const app = appliedAt[ni] || [0, 0];
            reactions.push({
                node: ni,
                Rx: -(nodeForce[ni][0] + app[0]),
                Ry: -(nodeForce[ni][1] + app[1]),
            });
        }
    });

    return { u, members, reactions };
}

function gaussianElim(K, F, n) {
    for (let col = 0; col < n; col++) {
        // pivot
        let maxRow = col;
        for (let row = col + 1; row < n; row++)
            if (Math.abs(K[row * n + col]) > Math.abs(K[maxRow * n + col])) maxRow = row;
        // swap
        for (let k = 0; k < n; k++) {
            [K[col * n + k], K[maxRow * n + k]] = [K[maxRow * n + k], K[col * n + k]];
        }
        [F[col], F[maxRow]] = [F[maxRow], F[col]];
        // eliminate
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(K[col * n + col]) < 1e-14) continue;
            const f = K[row * n + col] / K[col * n + col];
            for (let k = col; k < n; k++) K[row * n + k] -= f * K[col * n + k];
            F[row] -= f * F[col];
        }
    }
    // back-substitution
    const u = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        if (Math.abs(K[i * n + i]) < 1e-14) { u[i] = 0; continue; }
        let sum = F[i];
        for (let j = i + 1; j < n; j++) sum -= K[i * n + j] * u[j];
        u[i] = sum / K[i * n + i];
    }
    return u;
}

// ══════════════════════════════════════════════════════════════
//  הדפסת תוצאות
// ══════════════════════════════════════════════════════════════

const { u, members, reactions } = solve();
const A_mm2 = (ROD_SIDE * 1000) ** 2;

console.log('\n══════════════════════════════════════════════════');
console.log('  תוצאות ניתוח מסבך');
console.log('══════════════════════════════════════════════════');
console.log(`  חתך:    ${ROD_SIDE * 1000} מ"מ × ${ROD_SIDE * 1000} מ"מ   (A = ${A_mm2.toFixed(2)} מ"מ²)`);
console.log(`  חומר:   E = ${(E_PA/1e9).toFixed(0)} GPa  |  σ_y = ${YIELD_MPa} MPa`);
console.log(`  עומסים: ${LOADS.map(([n,fx,fy])=>`צומת ${n} [${NODES[n]}]: (${fx}, ${fy}) N`).join('  ')}`);
console.log('──────────────────────────────────────────────────');
console.log('  קורה │ צמתים       │   אורך   │    כוח    │  מאמץ   │  SF   │ סוג');
console.log('──────────────────────────────────────────────────');

let minSF = Infinity;
members.forEach(({ idx, a, b, L, force, stress_MPa, SF, type }) => {
    const sfStr     = isFinite(SF) ? SF.toFixed(3) : '∞';
    const forceStr  = force.toFixed(1).padStart(9);
    const stressStr = stress_MPa.toFixed(3).padStart(8);
    const nodeDesc  = `${a}[${NODES[a]}]→${b}[${NODES[b]}]`;
    console.log(`    ${String(idx).padEnd(4)} │ ${nodeDesc.padEnd(19)} │ ${L.padStart(7)} מ │${forceStr} N │${stressStr} MPa │ ${sfStr.padStart(5)} │ ${type}`);
    if (isFinite(SF) && SF < minSF) minSF = SF;
});

console.log('──────────────────────────────────────────────────');
const safe = minSF >= 1;
console.log(`  SF מינימלי = ${minSF.toFixed(3)}   ${safe ? '✓  מסבך בטוח' : '✗  מסבך נכשל!'}`);

console.log('\n══════════════════════════════════════════════════');
console.log('  ראקציות ריתום');
console.log('══════════════════════════════════════════════════');
console.log('  צומת │  קואורדינטות  │    Rx      │    Ry');
console.log('──────────────────────────────────────────────────');
let sumRx = 0, sumRy = 0;
reactions.forEach(({ node, Rx, Ry }) => {
    console.log(`    ${String(node).padEnd(4)} │ [${NODES[node]}]`.padEnd(24) + `│ ${Rx.toFixed(2).padStart(10)} N │ ${Ry.toFixed(2).padStart(10)} N`);
    sumRx += Rx; sumRy += Ry;
});
console.log('──────────────────────────────────────────────────');
console.log(`  סכום ראקציות:`.padEnd(24) + `  ${sumRx.toFixed(2).padStart(10)} N    ${sumRy.toFixed(2).padStart(10)} N`);
const totalLoad = LOADS.reduce((s,[,fx,fy])=>[s[0]+fx,s[1]+fy],[0,0]);
console.log(`  סכום עומסים:`.padEnd(24) + `  ${totalLoad[0].toFixed(2).padStart(10)} N    ${totalLoad[1].toFixed(2).padStart(10)} N`);
console.log(`  שיווי משקל:  ΣFx=${(sumRx+totalLoad[0]).toFixed(4)}  ΣFy=${(sumRy+totalLoad[1]).toFixed(4)}  ${Math.abs(sumRx+totalLoad[0])<0.01 && Math.abs(sumRy+totalLoad[1])<0.01?'✓':'✗'}`);
console.log('══════════════════════════════════════════════════\n');
