/**
 * AIM – Stress Test
 * =================
 * מדמה את כל 22 השחקנים מתחברים דרך WebSocket ושולחים כוחות:
 *   AIM  → רודף אחרי ה-GOAL הקרוב ביותר של הצוות השני
 *   GOAL → בורח מה-AIM הקרוב ביותר של הצוות השני
 * מודד תגובות שרת, שגיאות ועקביות.
 *
 * שימוש:  node stress_test.js [server_url] [duration_ms]
 * דוגמה:  node stress_test.js http://192.168.60.104:5817 30000
 */
'use strict';

const http  = require('http');
const https = require('https');
const { WebSocket } = require('ws');

const SERVER   = process.argv[2] || 'http://192.168.60.104:5817';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function adminAction(action) {
    return new Promise((resolve) => {
        const ws = new WebSocket(SERVER.replace(/^http/, 'ws') + '/');
        const done = () => { try { ws.close(); } catch {} resolve(); };
        const t = setTimeout(done, 5000);
        ws.on('open', () => ws.send(JSON.stringify({ type: 'admin', password: 'admin156234', action })));
        ws.on('message', () => { clearTimeout(t); setTimeout(done, 100); });
        ws.on('error',   () => { clearTimeout(t); resolve(); });
    });
}

const PLAYERS = [
    { name: 'AMITL',     code: '0637670123' },
    // { name: 'SHLOMI',   code: '' },
    // { name: 'MIKI',     code: '' },
    // { name: 'MIKI2',    code: '' },
    // { name: 'KEREN',    code: '' },
    // { name: 'ARIA',     code: '' },
    // { name: 'YOSSI',    code: '' },
    // { name: 'ARON',     code: '' },
    // { name: 'ROSS',     code: '' },
    // { name: 'RAZ',      code: '' },
    // { name: 'ASCHCHAR', code: '' },
    // { name: 'SHAI',     code: '' },
    // { name: 'TOMER',    code: '' },
    // { name: 'DORON',    code: '' },
    // { name: 'YAMIT',    code: '' },
    // { name: 'INBAL',    code: '' },
    // { name: 'NOAM',     code: '' },
    // { name: 'SAMUAL',   code: '' },
    // { name: 'GUY',      code: '' },
    // { name: 'DANIEL',   code: '' },
    // { name: 'AMITL',    code: '' },
    // { name: 'ARIAL',    code: '' },
];

// Max force magnitudes (must not exceed server limits)
const MAX_AIM_F  = 440;
const MAX_GOAL_F = 290;
const MAP_W = 2280;
const MAP_H = 1190;

// ── Counters ─────────────────────────────────────────────────────────────────
let cmdSent = 0, errCount = 0;

// ── HTTP GET ──────────────────────────────────────────────────────────────────
function httpGet(url) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        lib.get(url, { timeout: 5000 }, (res) => {
            let buf = ''; res.on('data', c => { buf += c; });
            res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(null); } });
        }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
    });
}

// ── Admin command (start game) ────────────────────────────────────────────────
function adminStart() {
    return new Promise((resolve) => {
        const ws = new WebSocket(SERVER.replace(/^http/, 'ws') + '/');
        const done = () => { try { ws.close(); } catch {} resolve(); };
        const t = setTimeout(done, 4000);
        ws.on('open', () => ws.send(JSON.stringify({ type: 'admin', password: 'admin156234', action: 'start' })));
        ws.on('message', () => { clearTimeout(t); done(); });
        ws.on('error',   () => { clearTimeout(t); resolve(); });
    });
}

// ── Force strategy ────────────────────────────────────────────────────────────
function getPosition(entity) {
    if (!entity) return { x: 0, y: 0 };
    return entity.pos ? { x: entity.pos.x, y: entity.pos.y } : { x: entity.x, y: entity.y };
}

function getVelocity(entity) {
    if (!entity) return { x: 0, y: 0 };
    return entity.vel ? { x: entity.vel.x, y: entity.vel.y } : { x: entity.vx, y: entity.vy };
}

function vecAdd(a, b) {
    return { x: (a.x || 0) + (b.x || 0), y: (a.y || 0) + (b.y || 0) };
}

function vecSub(a, b) {
    return { x: (a.x || 0) - (b.x || 0), y: (a.y || 0) - (b.y || 0) };
}

function vecScale(v, s) {
    return { x: v.x * s, y: v.y * s };
}

function vecLen(v) {
    return Math.hypot(v.x, v.y);
}

function vecDot(a, b) {
    return (a.x || 0) * (b.x || 0) + (a.y || 0) * (b.y || 0);
}

function vecNorm(v) {
    const len = vecLen(v);
    if (!len) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
}

function vecSetMag(v, magnitude) {
    const len = vecLen(v);
    if (!len) return { x: 0, y: 0 };
    return { x: (v.x / len) * magnitude, y: (v.y / len) * magnitude };
}

function predictPosition(entity, ticks) {
    const pos = getPosition(entity);
    const vel = getVelocity(entity);
    return { x: pos.x + vel.x * ticks, y: pos.y + vel.y * ticks };
}

function wallRepulsion(pos) {
    const margin = 170;
    const force = { x: 0, y: 0 };

    const leftDistance = pos.x - margin;
    const rightDistance = (MAP_W - pos.x) - margin;
    const topDistance = pos.y - margin;
    const bottomDistance = (MAP_H - pos.y) - margin;

    if (leftDistance < 0) {
        const strength = Math.pow((Math.abs(leftDistance) / margin), 2) * 3200;
        force.x += strength;
    }
    if (rightDistance < 0) {
        const strength = Math.pow((Math.abs(rightDistance) / margin), 2) * 3200;
        force.x -= strength;
    }
    if (topDistance < 0) {
        const strength = Math.pow((Math.abs(topDistance) / margin), 2) * 3200;
        force.y += strength;
    }
    if (bottomDistance < 0) {
        const strength = Math.pow((Math.abs(bottomDistance) / margin), 2) * 3200;
        force.y -= strength;
    }

    const edgeBias = Math.min(pos.x, MAP_W - pos.x, pos.y, MAP_H - pos.y);
    if (edgeBias < 240) {
        const center = { x: MAP_W / 2, y: MAP_H / 2 };
        const centerPull = vecSub(center, pos);
        const centerScale = Math.max(0, (240 - edgeBias) / 240);
        force.x += centerPull.x * 0.06 * centerScale;
        force.y += centerPull.y * 0.06 * centerScale;
    }

    return force;
}

function findCoordinatedGoal(myEntity, allEntities, goals) {
    if (!Array.isArray(allEntities) || !goals.length) return null;

    let bestGoal = null;
    let bestScore = -Infinity;

    for (const ally of allEntities) {
        if (!ally || ally.id === myEntity.id || ally.team !== myEntity.team || ally.type !== 'aim') continue;

        const allyVel = getVelocity(ally);
        const allySpeed = vecLen(allyVel);
        if (allySpeed < 8) continue;

        const allyDir = vecNorm(allyVel);
        if (!allyDir.x && !allyDir.y) continue;

        for (const goal of goals) {
            const toGoal = vecSub(getPosition(goal), getPosition(ally));
            const distance = vecLen(toGoal);
            if (distance < 1) continue;

            const goalDir = vecNorm(toGoal);
            const alignment = vecDot(allyDir, goalDir);
            if (alignment < 0.35) continue;

            const closeness = 1 - Math.min(distance / 600, 1);
            const score = alignment * 1.8 + closeness * 0.8;
            if (score > bestScore) {
                bestScore = score;
                bestGoal = goal;
            }
        }
    }

    return bestGoal;
}

function computeForce(myEntity, allEntities) {
    const myPos = getPosition(myEntity);
    const myVel = getVelocity(myEntity);
    const enemies = Array.isArray(allEntities) ? allEntities.filter(e => e && e.team !== myEntity.team) : [];

    if (!enemies.length) {
        return { x: 0, y: 0 };
    }

    if (myEntity.type === 'aim') {
        const goals = enemies.filter(e => e.type === 'goal');
        if (!goals.length) return { x: 0, y: 0 };

        const coordinatedGoal = findCoordinatedGoal(myEntity, allEntities, goals);
        const targetGoal = coordinatedGoal || goals.reduce((best, candidate) => {
            const bestDist = vecLen(vecSub(getPosition(best), myPos));
            const candidateDist = vecLen(vecSub(getPosition(candidate), myPos));
            return candidateDist < bestDist ? candidate : best;
        });

        const target = predictPosition(targetGoal, 5);
        const desired = vecSub(target, myPos);
        return vecSetMag(desired, MAX_AIM_F);
    }

    const threats = enemies.filter(e => e.type === 'aim');
    if (!threats.length) {
        return vecSetMag(wallRepulsion(myPos), MAX_GOAL_F);
    }

    let repulsion = { x: 0, y: 0 };
    const predictionTicks = 6;

    for (const threat of threats) {
        const threatPos = getPosition(threat);
        const threatVel = getVelocity(threat);
        const predictedPos = predictPosition(threat, predictionTicks);
        const rel = vecSub(predictedPos, myPos);
        const dist = Math.max(vecLen(rel), 40);
        const awayDir = vecNorm(vecSub(myPos, predictedPos));

        if (!awayDir.x && !awayDir.y) continue;

        const speed = vecLen(threatVel);
        const threatDir = vecNorm(threatVel);
        const approachFactor = Math.max(0, -vecDot(awayDir, threatDir));
        const radiusFactor = Math.max(0, 1 - (dist / 360));
        const strength = (17000 / (dist * dist)) * (1.2 + approachFactor * 1.5 + radiusFactor * 0.8);

        repulsion = vecAdd(repulsion, vecScale(awayDir, strength));

        const tangent = { x: -awayDir.y, y: awayDir.x };
        const tangentBias = vecDot(tangent, threatDir);
        repulsion = vecAdd(repulsion, vecScale(tangent, strength * tangentBias * 0.12));
    }

    const allySpacing = allEntities.filter(e => e && e.team === myEntity.team && e.id !== myEntity.id);
    for (const ally of allySpacing) {
        const allyPos = getPosition(ally);
        const rel = vecSub(myPos, allyPos);
        const dist = Math.max(vecLen(rel), 80);
        if (dist < 200) {
            const dir = vecNorm(rel);
            repulsion = vecAdd(repulsion, vecScale(dir, 1800 / (dist * dist)));
        }
    }

    const wallForce = wallRepulsion(myPos);
    const centerAttraction = vecScale(vecSub({ x: MAP_W / 2, y: MAP_H / 2 }, myPos), 0.08);

    let total = vecAdd(repulsion, wallForce);
    total = vecAdd(total, centerAttraction);

    const speed = vecLen(myVel);
    if (speed > 0.5) {
        const totalNorm = vecNorm(total);
        const velNorm = vecNorm(myVel);
        const alignment = vecDot(totalNorm, velNorm);

        if (alignment > 0.55) {
            total = vecAdd(total, vecScale(velNorm, -speed * 0.09));
        } else if (alignment < -0.1) {
            total = vecAdd(total, vecScale(totalNorm, speed * 0.05));
        }

        const edge = Math.min(myPos.x, MAP_W - myPos.x, myPos.y, MAP_H - myPos.y);
        if (edge < 180) {
            total = vecAdd(total, vecScale(velNorm, -speed * 0.035));
        }
    }

    return vecSetMag(total, MAX_GOAL_F);
}

// ── Connect one player (resolves when game ends or connection drops) ─────────
function connectPlayer(player) {
    return new Promise((resolve) => {
        const ws     = new WebSocket(SERVER.replace(/^http/, 'ws') + '/');
        let myName   = null;
        let alive    = true;

        const close = () => { alive = false; try { ws.close(); } catch {} resolve(); };
        // Safety: never hang more than 10 min per round
        const safety = setTimeout(close, 10 * 60 * 1000);

        ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', code: player.code })));

        ws.on('message', (raw) => {
            if (!alive) return;
            let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }

            if (msg.type === 'auth_result') {
                if (!msg.ok) { errCount++; clearTimeout(safety); close(); return; }
                myName = msg.name;
                return;
            }
            if (msg.type === 'game_over') { clearTimeout(safety); close(); return; }

            if (msg.type === 'state') {
                if (!myName || !msg.entities) return;
                const me = msg.entities.find(e => e.name === myName);
                if (!me) return;
                const force = computeForce(me, msg.entities);
                ws.send(JSON.stringify({ type: 'cmd', entityId: me.id, force }));
                cmdSent++;
            }
        });

        ws.on('error', () => { errCount++; clearTimeout(safety); close(); });
        ws.on('close', () => { clearTimeout(safety); close(); });
    });
}

// ── Main (infinite loop) ──────────────────────────────────────────────────────
async function main() {
    console.log(`[AIM stress] server=${SERVER}  (infinite loop — Ctrl+C to stop)`);
    try { await httpGet(`${SERVER}/api/state`); }
    catch (e) { console.error('Cannot reach server:', e.message); process.exit(1); }

    let round = 0;
    while (true) {
        round++;
        console.log(`\n--- Round ${round} ---`);
        cmdSent = 0; errCount = 0;

        await adminAction('reset');
        await sleep(300);
        await adminAction('start');
        await sleep(500);

        await Promise.all(PLAYERS.map(p => connectPlayer(p)));
        console.log(`  Round ${round} ended  cmds=${cmdSent}  errors=${errCount}`);
        await sleep(1500);
    }
}
main();
