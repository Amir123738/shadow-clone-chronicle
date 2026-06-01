import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shadow Clone Survivor" },
      { name: "description", content: "A fast, colorful 2D action survival game with time-shifted shadow clones." },
      { property: "og:title", content: "Shadow Clone Survivor" },
      { property: "og:description", content: "Survive waves of enemies with the help of your past selves." },
    ],
  }),
  component: Game,
});

// ---------- Types ----------
type Vec = { x: number; y: number };
type Input = { up: boolean; down: boolean; left: boolean; right: boolean; shoot: boolean; aim: Vec };
type Frame = { pos: Vec; aim: Vec; shoot: boolean };
type Bullet = { pos: Vec; vel: Vec; life: number; dmg: number; from: "player" | "clone"; color: string };
type Enemy = {
  pos: Vec; vel: Vec; hp: number; maxHp: number; r: number; speed: number;
  dmg: number; color: string; xp: number; coin: number; kind: "grunt" | "fast" | "tank" | "boss";
};
type Pickup = { pos: Vec; kind: "xp" | "coin"; value: number };
type Clone = { frames: Frame[]; idx: number; trail: Vec[] };
type Upgrade = { id: string; name: string; desc: string; apply: () => void };

// ---------- Constants ----------
const W = 960;
const H = 600;
const CLONE_INTERVAL = 15; // seconds
const TICK = 1 / 60;

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function dist(a: Vec, b: Vec) { return Math.hypot(a.x - b.x, a.y - b.y); }
function norm(v: Vec): Vec { const m = Math.hypot(v.x, v.y) || 1; return { x: v.x / m, y: v.y / m }; }

function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [uiState, setUiState] = useState<{
    started: boolean; over: boolean; won: boolean;
    wave: number; score: number; hp: number; maxHp: number;
    xp: number; xpNext: number; level: number;
    coins: number; time: number; cloneTimer: number; clones: number;
    enemiesLeft: number; betweenWaves: boolean; upgrades: Upgrade[];
  }>({
    started: false, over: false, won: false,
    wave: 0, score: 0, hp: 100, maxHp: 100,
    xp: 0, xpNext: 5, level: 1,
    coins: 0, time: 0, cloneTimer: CLONE_INTERVAL, clones: 0,
    enemiesLeft: 0, betweenWaves: false, upgrades: [],
  });

  // Persistent mutable game state (refs to avoid re-render churn)
  const stateRef = useRef({
    player: { pos: { x: W / 2, y: H / 2 } as Vec, r: 14, hp: 100, maxHp: 100 },
    stats: {
      moveSpeed: 220,
      fireRate: 4, // shots/sec
      bulletDmg: 18,
      bulletSpeed: 520,
      doubleBullets: false,
      cloneDmgMult: 1,
    },
    input: { up: false, down: false, left: false, right: false, shoot: false, aim: { x: W / 2, y: H / 2 } as Vec } as Input,
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    pickups: [] as Pickup[],
    clones: [] as Clone[],
    recording: [] as Frame[],
    fireCd: 0,
    cloneFireCd: [] as number[],
    spawnQueue: 0,
    waveActive: false,
    bossSpawned: false,
    time: 0,
    cloneTimer: CLONE_INTERVAL,
    wave: 0,
    score: 0,
    coins: 0,
    xp: 0,
    xpNext: 5,
    level: 1,
    over: false,
    won: false,
    betweenWaves: false,
    pendingUpgrades: null as Upgrade[] | null,
    waveCleared: false,
  });

  const TOTAL_WAVES = 8; // last one = boss

  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.player = { pos: { x: W / 2, y: H / 2 }, r: 14, hp: 100, maxHp: 100 };
    s.stats = { moveSpeed: 220, fireRate: 4, bulletDmg: 18, bulletSpeed: 520, doubleBullets: false, cloneDmgMult: 1 };
    s.bullets = []; s.enemies = []; s.pickups = []; s.clones = []; s.recording = [];
    s.fireCd = 0; s.cloneFireCd = []; s.spawnQueue = 0; s.waveActive = false; s.bossSpawned = false;
    s.time = 0; s.cloneTimer = CLONE_INTERVAL; s.wave = 0; s.score = 0; s.coins = 0;
    s.xp = 0; s.xpNext = 5; s.level = 1; s.over = false; s.won = false;
    s.betweenWaves = false; s.pendingUpgrades = null; s.waveCleared = false;
  }, []);

  const startWave = useCallback(() => {
    const s = stateRef.current;
    s.wave += 1;
    s.waveActive = true;
    s.betweenWaves = false;
    s.waveCleared = false;
    s.bossSpawned = false;
    if (s.wave >= TOTAL_WAVES) {
      // boss wave
      s.spawnQueue = 0;
      spawnBoss();
    } else {
      s.spawnQueue = 6 + s.wave * 4;
    }
  }, []);

  function spawnBoss() {
    const s = stateRef.current;
    const pos = edgeSpawn();
    s.enemies.push({
      pos, vel: { x: 0, y: 0 },
      hp: 1200, maxHp: 1200, r: 38, speed: 70, dmg: 25,
      color: "#ff2e88", xp: 50, coin: 25, kind: "boss",
    });
    s.bossSpawned = true;
  }

  function edgeSpawn(): Vec {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: rand(0, W), y: -20 };
    if (side === 1) return { x: rand(0, W), y: H + 20 };
    if (side === 2) return { x: -20, y: rand(0, H) };
    return { x: W + 20, y: rand(0, H) };
  }

  function spawnEnemy() {
    const s = stateRef.current;
    const r = Math.random();
    const waveBoost = 1 + s.wave * 0.12;
    let e: Enemy;
    if (r < 0.55) {
      e = {
        pos: edgeSpawn(), vel: { x: 0, y: 0 },
        hp: 30 * waveBoost, maxHp: 30 * waveBoost, r: 14, speed: 95,
        dmg: 10, color: "#7cf24a", xp: 1, coin: 1, kind: "grunt",
      };
    } else if (r < 0.85) {
      e = {
        pos: edgeSpawn(), vel: { x: 0, y: 0 },
        hp: 18 * waveBoost, maxHp: 18 * waveBoost, r: 10, speed: 170,
        dmg: 8, color: "#4ad6ff", xp: 2, coin: 1, kind: "fast",
      };
    } else {
      e = {
        pos: edgeSpawn(), vel: { x: 0, y: 0 },
        hp: 90 * waveBoost, maxHp: 90 * waveBoost, r: 20, speed: 60,
        dmg: 18, color: "#ff8a3d", xp: 3, coin: 3, kind: "tank",
      };
    }
    s.enemies.push(e);
  }

  const allUpgrades: Upgrade[] = [
    { id: "fire", name: "Rapid Fire", desc: "+35% fire rate", apply: () => { stateRef.current.stats.fireRate *= 1.35; } },
    { id: "dmg", name: "Sharper Bullets", desc: "+30% damage", apply: () => { stateRef.current.stats.bulletDmg *= 1.3; } },
    { id: "spd", name: "Swift Feet", desc: "+20% move speed", apply: () => { stateRef.current.stats.moveSpeed *= 1.2; } },
    { id: "hp", name: "Vitality", desc: "+30 max HP & heal", apply: () => {
      const p = stateRef.current.player; p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30);
    }},
    { id: "double", name: "Double Shot", desc: "Fire two bullets", apply: () => { stateRef.current.stats.doubleBullets = true; } },
    { id: "clone", name: "Echo Power", desc: "+50% clone damage", apply: () => { stateRef.current.stats.cloneDmgMult *= 1.5; } },
  ];

  const rollUpgrades = useCallback((): Upgrade[] => {
    const pool = [...allUpgrades];
    // avoid offering double-shot twice
    const out: Upgrade[] = [];
    while (out.length < 3 && pool.length > 0) {
      const i = Math.floor(Math.random() * pool.length);
      const u = pool.splice(i, 1)[0];
      if (u.id === "double" && stateRef.current.stats.doubleBullets) continue;
      out.push(u);
    }
    return out;
  }, []);

  const pickUpgrade = (u: Upgrade) => {
    u.apply();
    const s = stateRef.current;
    s.pendingUpgrades = null;
    s.betweenWaves = false;
    startWave();
  };

  const startGame = () => {
    resetGame();
    setUiState((u) => ({ ...u, started: true, over: false, won: false }));
    startWave();
  };

  // Input handling
  useEffect(() => {
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const i = stateRef.current.input;
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") i.up = down;
      else if (k === "s" || k === "arrowdown") i.down = down;
      else if (k === "a" || k === "arrowleft") i.left = down;
      else if (k === "d" || k === "arrowright") i.right = down;
    };
    const kd = onKey(true), ku = onKey(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      stateRef.current.input.aim = { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
    };
    const onDown = () => { stateRef.current.input.shoot = true; };
    const onUp = () => { stateRef.current.input.shoot = false; };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    const fireBullet = (origin: Vec, aim: Vec, from: "player" | "clone") => {
      const s = stateRef.current;
      const dir = norm({ x: aim.x - origin.x, y: aim.y - origin.y });
      if (dir.x === 0 && dir.y === 0) return;
      const dmg = (from === "player" ? s.stats.bulletDmg : s.stats.bulletDmg * 0.7 * s.stats.cloneDmgMult);
      const color = from === "player" ? "#ffe066" : "#b388ff";
      const speed = s.stats.bulletSpeed;
      const make = (dx: number, dy: number) => s.bullets.push({
        pos: { x: origin.x, y: origin.y },
        vel: { x: dx * speed, y: dy * speed },
        life: 1.2, dmg, from, color,
      });
      if (s.stats.doubleBullets) {
        const ang = Math.atan2(dir.y, dir.x);
        const spread = 0.12;
        make(Math.cos(ang - spread), Math.sin(ang - spread));
        make(Math.cos(ang + spread), Math.sin(ang + spread));
      } else {
        make(dir.x, dir.y);
      }
    };

    const step = (dt: number) => {
      const s = stateRef.current;
      if (s.over || s.won || s.betweenWaves) return;

      s.time += dt;

      // Movement
      const i = s.input;
      let dx = (i.right ? 1 : 0) - (i.left ? 1 : 0);
      let dy = (i.down ? 1 : 0) - (i.up ? 1 : 0);
      const mag = Math.hypot(dx, dy);
      if (mag > 0) { dx /= mag; dy /= mag; }
      s.player.pos.x = Math.max(s.player.r, Math.min(W - s.player.r, s.player.pos.x + dx * s.stats.moveSpeed * dt));
      s.player.pos.y = Math.max(s.player.r, Math.min(H - s.player.r, s.player.pos.y + dy * s.stats.moveSpeed * dt));

      // Shooting
      s.fireCd -= dt;
      if (i.shoot && s.fireCd <= 0) {
        fireBullet(s.player.pos, i.aim, "player");
        s.fireCd = 1 / s.stats.fireRate;
      }

      // Record frame (60Hz)
      s.recording.push({ pos: { x: s.player.pos.x, y: s.player.pos.y }, aim: { x: i.aim.x, y: i.aim.y }, shoot: i.shoot && s.fireCd > 0 ? false : i.shoot });

      // Clone timer
      s.cloneTimer -= dt;
      if (s.cloneTimer <= 0) {
        if (s.recording.length > 30) {
          s.clones.push({ frames: s.recording.slice(), idx: 0, trail: [] });
          s.cloneFireCd.push(0);
        }
        s.recording = [];
        s.cloneTimer = CLONE_INTERVAL;
      }

      // Update clones
      for (let c = 0; c < s.clones.length; c++) {
        const cl = s.clones[c];
        const f = cl.frames[cl.idx];
        if (!f) continue;
        s.cloneFireCd[c] -= dt;
        if (f.shoot && s.cloneFireCd[c] <= 0) {
          fireBullet(f.pos, f.aim, "clone");
          s.cloneFireCd[c] = 1 / s.stats.fireRate;
        }
        cl.idx++;
        if (cl.idx >= cl.frames.length) cl.idx = 0; // loop
      }

      // Spawn enemies for non-boss waves
      if (s.waveActive && s.wave < TOTAL_WAVES && s.spawnQueue > 0 && Math.random() < 0.04 + s.wave * 0.005) {
        spawnEnemy();
        s.spawnQueue--;
      }

      // Update enemies
      for (const e of s.enemies) {
        const d = norm({ x: s.player.pos.x - e.pos.x, y: s.player.pos.y - e.pos.y });
        e.pos.x += d.x * e.speed * dt;
        e.pos.y += d.y * e.speed * dt;
        // touch damage
        if (dist(e.pos, s.player.pos) < e.r + s.player.r) {
          s.player.hp -= e.dmg * dt;
        }
      }

      // Bullets
      for (const b of s.bullets) {
        b.pos.x += b.vel.x * dt;
        b.pos.y += b.vel.y * dt;
        b.life -= dt;
        for (const e of s.enemies) {
          if (e.hp <= 0) continue;
          if (dist(b.pos, e.pos) < e.r + 3) {
            e.hp -= b.dmg;
            b.life = 0;
            break;
          }
        }
      }
      s.bullets = s.bullets.filter(b => b.life > 0 && b.pos.x > -20 && b.pos.x < W + 20 && b.pos.y > -20 && b.pos.y < H + 20);

      // Dead enemies => pickups + score
      const survivors: Enemy[] = [];
      for (const e of s.enemies) {
        if (e.hp <= 0) {
          s.score += Math.round(e.maxHp);
          // drop
          for (let k = 0; k < e.xp; k++) s.pickups.push({ pos: { x: e.pos.x + rand(-6, 6), y: e.pos.y + rand(-6, 6) }, kind: "xp", value: 1 });
          for (let k = 0; k < e.coin; k++) s.pickups.push({ pos: { x: e.pos.x + rand(-6, 6), y: e.pos.y + rand(-6, 6) }, kind: "coin", value: 1 });
        } else survivors.push(e);
      }
      s.enemies = survivors;

      // Pickups
      const remPick: Pickup[] = [];
      for (const p of s.pickups) {
        const dd = dist(p.pos, s.player.pos);
        if (dd < 80) {
          const dir = norm({ x: s.player.pos.x - p.pos.x, y: s.player.pos.y - p.pos.y });
          p.pos.x += dir.x * 240 * dt;
          p.pos.y += dir.y * 240 * dt;
        }
        if (dd < s.player.r + 6) {
          if (p.kind === "xp") {
            s.xp += p.value;
            while (s.xp >= s.xpNext) {
              s.xp -= s.xpNext;
              s.level++;
              s.xpNext = Math.round(s.xpNext * 1.4 + 2);
            }
          } else {
            s.coins += p.value;
          }
        } else remPick.push(p);
      }
      s.pickups = remPick;

      // Death
      if (s.player.hp <= 0) {
        s.player.hp = 0;
        s.over = true;
      }

      // Wave clear
      if (s.waveActive && !s.waveCleared) {
        const noQueue = s.wave >= TOTAL_WAVES ? s.bossSpawned : s.spawnQueue <= 0;
        if (noQueue && s.enemies.length === 0) {
          s.waveActive = false;
          s.waveCleared = true;
          if (s.wave >= TOTAL_WAVES) {
            s.won = true;
          } else {
            s.betweenWaves = true;
            s.pendingUpgrades = rollUpgrades();
          }
        }
      }
    };

    const draw = () => {
      const s = stateRef.current;
      // bg
      ctx.fillStyle = "#0b0d1a";
      ctx.fillRect(0, 0, W, H);
      // grid
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // pickups
      for (const p of s.pickups) {
        ctx.fillStyle = p.kind === "xp" ? "#7cf24a" : "#ffd54a";
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // clones
      for (const cl of s.clones) {
        const f = cl.frames[cl.idx];
        if (!f) continue;
        ctx.fillStyle = "rgba(179,136,255,0.55)";
        ctx.beginPath();
        ctx.arc(f.pos.x, f.pos.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(179,136,255,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const ang = Math.atan2(f.aim.y - f.pos.y, f.aim.x - f.pos.x);
        ctx.moveTo(f.pos.x, f.pos.y);
        ctx.lineTo(f.pos.x + Math.cos(ang) * 18, f.pos.y + Math.sin(ang) * 18);
        ctx.stroke();
      }

      // enemies
      for (const e of s.enemies) {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        // hp bar
        const w = e.r * 2;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(e.pos.x - w / 2, e.pos.y - e.r - 8, w, 4);
        ctx.fillStyle = "#ff5d5d";
        ctx.fillRect(e.pos.x - w / 2, e.pos.y - e.r - 8, w * (e.hp / e.maxHp), 4);
      }

      // bullets
      for (const b of s.bullets) {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // player
      const p = s.player;
      ctx.fillStyle = "#ffe066";
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      const ang = Math.atan2(s.input.aim.y - p.pos.y, s.input.aim.x - p.pos.x);
      ctx.beginPath();
      ctx.moveTo(p.pos.x, p.pos.y);
      ctx.lineTo(p.pos.x + Math.cos(ang) * 22, p.pos.y + Math.sin(ang) * 22);
      ctx.stroke();

      // boss bar
      const boss = s.enemies.find(e => e.kind === "boss");
      if (boss) {
        const bw = W * 0.6;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect((W - bw) / 2, 14, bw, 14);
        ctx.fillStyle = "#ff2e88";
        ctx.fillRect((W - bw) / 2, 14, bw * (boss.hp / boss.maxHp), 14);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("SHADOW TYRANT", W / 2, 24);
      }
    };

    const loop = (now: number) => {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      // fixed-ish steps
      let acc = dt;
      while (acc > 0) {
        const t = Math.min(TICK, acc);
        step(t);
        acc -= t;
      }
      draw();

      // sync UI snapshot
      const s = stateRef.current;
      setUiState((u) => {
        const upg = s.pendingUpgrades ?? u.upgrades;
        return {
          ...u,
          wave: s.wave,
          score: s.score,
          hp: Math.max(0, Math.round(s.player.hp)),
          maxHp: s.player.maxHp,
          xp: s.xp,
          xpNext: s.xpNext,
          level: s.level,
          coins: s.coins,
          time: s.time,
          cloneTimer: Math.max(0, s.cloneTimer),
          clones: s.clones.length,
          enemiesLeft: s.enemies.length + s.spawnQueue,
          betweenWaves: s.betweenWaves,
          upgrades: upg,
          over: s.over,
          won: s.won,
        };
      });

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
    };
  }, [rollUpgrades]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#070815] text-white p-4 gap-4">
      <header className="text-center">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-[#ffe066] via-[#ff2e88] to-[#b388ff] bg-clip-text text-transparent">
          Shadow Clone Survivor
        </h1>
        <p className="text-sm text-white/60">WASD to move · Mouse to aim · Click to shoot · Every 15s a shadow clone of your past is born</p>
      </header>

      <div className="relative" style={{ width: "min(96vw, 960px)" }}>
        {/* HUD */}
        <div className="flex flex-wrap items-center gap-3 mb-2 text-xs md:text-sm font-mono">
          <Stat label="Wave" value={`${uiState.wave}/${TOTAL_WAVES}`} />
          <Stat label="Score" value={uiState.score.toString()} />
          <Stat label="Coins" value={uiState.coins.toString()} />
          <Stat label="Lvl" value={uiState.level.toString()} />
          <Stat label="Clones" value={uiState.clones.toString()} />
          <Stat label="Next Clone" value={`${uiState.cloneTimer.toFixed(1)}s`} />
          <Stat label="Time" value={`${uiState.time.toFixed(1)}s`} />
          <Stat label="Enemies" value={uiState.enemiesLeft.toString()} />
        </div>

        {/* HP bar */}
        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-1">
          <div
            className="h-full bg-gradient-to-r from-[#ff5d5d] to-[#ffe066] transition-[width] duration-150"
            style={{ width: `${(uiState.hp / uiState.maxHp) * 100}%` }}
          />
        </div>
        {/* XP bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-[#7cf24a]" style={{ width: `${(uiState.xp / uiState.xpNext) * 100}%` }} />
        </div>

        <div className="relative rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block w-full h-auto cursor-crosshair bg-[#0b0d1a]"
            style={{ aspectRatio: `${W}/${H}` }}
          />

          {!uiState.started && (
            <Overlay>
              <h2 className="text-2xl font-bold mb-2">Ready to survive?</h2>
              <p className="text-white/70 mb-4 max-w-md text-center text-sm">
                Every 15 seconds your last 15 seconds become a shadow clone that fights beside you. Survive {TOTAL_WAVES} waves to defeat the Shadow Tyrant.
              </p>
              <button onClick={startGame} className="px-6 py-3 rounded-lg bg-[#ffe066] text-black font-bold hover:scale-105 transition">
                Start Game
              </button>
            </Overlay>
          )}

          {uiState.started && uiState.betweenWaves && uiState.upgrades.length > 0 && (
            <Overlay>
              <h2 className="text-xl font-bold mb-1">Wave {uiState.wave} cleared!</h2>
              <p className="text-white/60 text-sm mb-4">Pick an upgrade</p>
              <div className="grid md:grid-cols-3 gap-3 w-full max-w-3xl px-4">
                {uiState.upgrades.map((u) => (
                  <button
                    key={u.id + Math.random()}
                    onClick={() => pickUpgrade(u)}
                    className="p-4 rounded-lg bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-[#ffe066] text-left transition"
                  >
                    <div className="font-bold text-[#ffe066]">{u.name}</div>
                    <div className="text-sm text-white/70 mt-1">{u.desc}</div>
                  </button>
                ))}
              </div>
            </Overlay>
          )}

          {uiState.over && (
            <Overlay>
              <h2 className="text-3xl font-black text-[#ff5d5d] mb-2">You fell.</h2>
              <p className="text-white/70 mb-1">Wave reached: {uiState.wave}</p>
              <p className="text-white/70 mb-4">Final score: {uiState.score}</p>
              <button onClick={startGame} className="px-6 py-3 rounded-lg bg-[#ffe066] text-black font-bold hover:scale-105 transition">
                Play Again
              </button>
            </Overlay>
          )}

          {uiState.won && (
            <Overlay>
              <h2 className="text-3xl font-black mb-2 bg-gradient-to-r from-[#ffe066] to-[#b388ff] bg-clip-text text-transparent">Tyrant Slain!</h2>
              <p className="text-white/70 mb-1">Score: {uiState.score} · Coins: {uiState.coins}</p>
              <p className="text-white/70 mb-4">Your clones whisper in approval.</p>
              <button onClick={startGame} className="px-6 py-3 rounded-lg bg-[#ffe066] text-black font-bold hover:scale-105 transition">
                Play Again
              </button>
            </Overlay>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-1 rounded-md bg-white/5 ring-1 ring-white/10">
      <span className="text-white/50">{label}: </span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      {children}
    </div>
  );
}
