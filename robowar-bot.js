/*
 * robowar-bot.js
 *
 * Drop this script on the page (or paste it into the browser console) to let
 * a bot play Robowar using a greedy BFS cost-benefit strategy.
 *
 * Usage:
 *   <script src="/robowar-bot.js"></script>
 *   <script>
 *     window.robowarBot.configure({
 *       authCode: 'YOUR_AUTH_CODE',
 *       botName: 'YOUR_ROBOT_NAME',
 *     });
 *     window.robowarBot.start();
 *   </script>
 *
 * If you do not know your bot name yet, leave botName empty and the script
 * will fall back to the first robot in the state payload.
 */

(() => {
  const GRID_W = 38;
  const GRID_H = 25;
  const GRID_SIZE = GRID_W * GRID_H;

  const DIRECTIONS = [
    { move: 'UP',    dx: 0,  dy: 1 },
    { move: 'RIGHT', dx: 1,  dy: 0 },
    { move: 'DOWN',  dx: 0,  dy: -1 },
    { move: 'LEFT',  dx: -1, dy: 0 },
  ];

  const root = typeof window !== 'undefined' ? window : globalThis;

  const defaultConfig = {
    authCode: '',
    botName: '',
    wsUrl: null,
    reconnectDelay: 2000,
  };

  const state = {
    ws: null,
    connected: false,
    config: { ...defaultConfig },
    currentStep: -1,
    lastMove: 'STAY',
    currentRobot: null,
    obstacleMap: new Uint8Array(GRID_SIZE),
    robotOccupancy: new Uint8Array(GRID_SIZE),
    visited: new Uint8Array(GRID_SIZE),
    parent: new Int32Array(GRID_SIZE),
    firstMove: new Uint8Array(GRID_SIZE),
    queue: new Int32Array(GRID_SIZE),
    running: false,
  };

  function buildWsUrl() {
    if (state.config.wsUrl) {
      return state.config.wsUrl;
    }

    if (typeof location !== 'undefined' && location.host) {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${location.host}`;
    }

    return 'ws://localhost';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function idx(x, y) {
    return y * GRID_W + x;
  }

  function isInside(x, y) {
    return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
  }

  function isObstacle(x, y) {
    return state.obstacleMap[idx(x, y)] === 1;
  }

  function isBlocked(x, y) {
    return isObstacle(x, y) || state.robotOccupancy[idx(x, y)] === 1;
  }

  function updateRobotOccupancy(robots, selfName) {
    state.robotOccupancy.fill(0);

    for (let i = 0; i < robots.length; i += 1) {
      const robot = robots[i];
      if (!robot || robot.name === selfName) {
        continue;
      }

      if (isInside(robot.x, robot.y)) {
        state.robotOccupancy[idx(robot.x, robot.y)] = 1;
      }
    }
  }

  function resetSearchBuffers() {
    state.visited.fill(0);
    state.parent.fill(-1);
    state.firstMove.fill(0);
  }

  function bfsDistanceAndFirstMove(startX, startY, targetX, targetY) {
    const targetIdx = idx(targetX, targetY);

    resetSearchBuffers();

    const queue = state.queue;
    let head = 0;
    let tail = 1;
    const startIdx = idx(startX, startY);

    queue[0] = startIdx;
    state.visited[startIdx] = 1;

    while (head < tail) {
      const current = queue[head++];
      if (current === targetIdx) {
        break;
      }

      const cx = current % GRID_W;
      const cy = (current / GRID_W) | 0;

      for (let i = 0; i < 4; i += 1) {
        const nx = cx + DIRECTIONS[i].dx;
        const ny = cy + DIRECTIONS[i].dy;

        if (!isInside(nx, ny)) {
          continue;
        }

        if (isBlocked(nx, ny)) {
          continue;
        }

        const nidx = idx(nx, ny);
        if (state.visited[nidx]) {
          continue;
        }

        state.visited[nidx] = 1;
        state.parent[nidx] = current;
        state.firstMove[nidx] = i;
        queue[tail++] = nidx;
      }
    }

    if (!state.visited[targetIdx]) {
      return -1;
    }

    let steps = 0;
    let cursor = targetIdx;

    while (cursor !== startIdx) {
      const parentIdx = state.parent[cursor];
      if (parentIdx < 0) {
        return -1;
      }
      cursor = parentIdx;
      steps += 1;
    }

    return steps;
  }

  function chooseMoveFromPrize(startX, startY, prize) {
    const distance = bfsDistanceAndFirstMove(startX, startY, prize.x, prize.y);

    if (distance <= 0) {
      return { move: 'STAY', distance: 0, score: Infinity };
    }

    let cursor = idx(prize.x, prize.y);
    const startIdx = idx(startX, startY);

    while (cursor !== startIdx) {
      const parentIdx = state.parent[cursor];
      if (parentIdx < 0) {
        return { move: 'STAY', distance: -1, score: -Infinity };
      }

      const next = state.firstMove[cursor];
      if (parentIdx === startIdx) {
        return { move: DIRECTIONS[next].move, distance, score: prize.value / distance };
      }

      cursor = parentIdx;
    }

    return { move: 'STAY', distance, score: prize.value / distance };
  }

  function selectBestTarget(robot, prizes) {
    if (!prizes.length) {
      return null;
    }

    let best = null;

    for (let i = 0; i < prizes.length; i += 1) {
      const prize = prizes[i];
      const candidate = chooseMoveFromPrize(robot.x, robot.y, prize);

      if (candidate.distance < 0) {
        continue;
      }

      if (!best || candidate.score > best.score) {
        best = {
          prize,
          distance: candidate.distance,
          move: candidate.move,
          score: candidate.score,
        };
      }
    }

    return best;
  }

  function updateObstacleMap(obstacles) {
    state.obstacleMap.fill(0);
    for (let i = 0; i < obstacles.length; i += 1) {
      const [x, y] = obstacles[i];
      if (isInside(x, y)) {
        state.obstacleMap[idx(x, y)] = 1;
      }
    }
  }

  function resolveRobotName(robots) {
    const configuredName = (state.config.botName || '').trim();

    if (configuredName) {
      const match = robots.find((robot) => robot.name === configuredName);
      if (match) {
        return match;
      }
      console.warn(`[robowar-bot] configured botName "${configuredName}" not found, falling back to the first robot.`);
    }

    if (robots.length) {
      return robots[0];
    }

    return null;
  }

  function sendMove(move) {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    state.ws.send(JSON.stringify({ type: 'cmd', move }));
    state.lastMove = move;
    return true;
  }

  function authIfNeeded() {
    if (!state.config.authCode) {
      return;
    }

    state.ws.send(JSON.stringify({ type: 'auth', code: state.config.authCode }));
  }

  function connect() {
    if (state.running && state.ws && state.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = buildWsUrl();
    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
      state.connected = true;
      authIfNeeded();
      console.info('[robowar-bot] WebSocket connected:', wsUrl);
    };

    state.ws.onmessage = (event) => {
      let payload;

      try {
        payload = JSON.parse(event.data);
      } catch (error) {
        console.warn('[robowar-bot] Received non-JSON message.', error);
        return;
      }

      if (payload.type !== 'state') {
        return;
      }

      const { step, robots, obstacles, prizes } = payload;

      if (typeof step === 'number' && step <= state.currentStep) {
        return;
      }

      state.currentStep = step;
      updateObstacleMap(obstacles || []);
      const robot = resolveRobotName(robots || []);

      if (!robot) {
        return;
      }

      updateRobotOccupancy(robots || [], robot.name);
      state.currentRobot = robot;

      const bestTarget = selectBestTarget(robot, prizes || []);
      const move = bestTarget ? bestTarget.move : 'STAY';

      if (!move || move === 'STAY') {
        sendMove('STAY');
        return;
      }

      sendMove(move);
    };

    state.ws.onclose = () => {
      state.connected = false;
      console.warn('[robowar-bot] WebSocket closed; reconnecting in', state.config.reconnectDelay, 'ms');
      setTimeout(() => {
        if (state.running) {
          connect();
        }
      }, state.config.reconnectDelay);
    };

    state.ws.onerror = () => {
      if (state.ws && state.ws.readyState !== WebSocket.OPEN) {
        state.ws.close();
      }
    };
  }

  const botApi = {
    configure(nextConfig = {}) {
      state.config = {
        ...state.config,
        ...nextConfig,
      };

      if (state.running) {
        if (state.ws) {
          state.ws.close();
        }
        connect();
      }

      return state.config;
    },

    start() {
      state.running = true;
      connect();
      return state;
    },

    stop() {
      state.running = false;
      if (state.ws) {
        state.ws.close();
      }
    },

    getState() {
      return { ...state };
    },
  };

  root.robowarBot = botApi;
})();
