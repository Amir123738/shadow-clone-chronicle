import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shadow Clone Survivor" },
      { name: "description", content: "A fast, colorful 2D action survival game with time-shifted shadow clones." },
      { property: "og:title", content: "Shadow Clone Survivor" },
      { property: "og:description", content: "Survive 100 waves with the help of your past selves." },
    ],
  }),
  component: Game,
});

// ---------- Types ----------
type Vec = { x: number; y: number };
type Input = { up: boolean; down: boolean; left: boolean; right: boolean; shoot: boolean; aim: Vec };
type Frame = { pos: Vec; aim: Vec; shoot: boolean };
type Bullet = { pos: Vec; vel: Vec; life: number; dmg: number; from: "player" | "clone"; color: string };
type BossId = "super" | "mega" | "hyper" | "plantium" | "final" | "plusplantium" | null;
type Enemy = {
  pos: Vec; vel: Vec; hp: number; maxHp: number; r: number; speed: number; baseSpeed: number;
  dmg: number; baseDmg: number; color: string; xp: number; coin: number;
  kind: "grunt" | "fast" | "tank" | "boss"; bossId?: BossId;
  abilityCds?: Record<string, number>; abilityFlags?: Record<string, boolean>;
};
type Pickup = { pos: Vec; kind: "xp" | "coin" | "shadow"; value: number };
type Clone = { frames: Frame[]; idx: number; trail: Vec[]; healer?: boolean; life?: number };
type Skin = { id: string; name: string; price: number; color: string; glow?: string; rainbow?: boolean };

const SKINS: Skin[] = [
  { id: "violet",   name: "Violet Echo",      price: 0,   color: "#b388ff", glow: "rgba(179,136,255,0.55)" },
  { id: "crimson",  name: "Crimson Wraith",   price: 50,  color: "#ff5d7a", glow: "rgba(255,93,122,0.55)" },
  { id: "emerald",  name: "Emerald Phantom",  price: 120, color: "#4ade80", glow: "rgba(74,222,128,0.55)" },
  { id: "azure",    name: "Azure Spectre",    price: 200, color: "#38bdf8", glow: "rgba(56,189,248,0.55)" },
  { id: "gold",     name: "Golden Specter",   price: 350, color: "#ffd54a", glow: "rgba(255,213,74,0.65)" },
  { id: "inferno",  name: "Inferno Echo",     price: 550, color: "#ff7a18", glow: "rgba(255,122,24,0.75)" },
  { id: "rainbow",  name: "Rainbow Mirage",   price: 900, color: "#ff5dff", glow: "rgba(255,93,255,0.55)", rainbow: true },
];

const SHOP_KEY = "scs_shop_v1";
type ShopSave = { shadowCoins: number; owned: string[]; selected: string };
function loadShop(): ShopSave {
  if (typeof window === "undefined") return { shadowCoins: 0, owned: ["violet"], selected: "violet" };
  try {
    const raw = localStorage.getItem(SHOP_KEY);
    if (raw) { const v = JSON.parse(raw); if (v && Array.isArray(v.owned)) return { shadowCoins: v.shadowCoins||0, owned: v.owned, selected: v.selected||"violet" }; }
  } catch {}
  return { shadowCoins: 0, owned: ["violet"], selected: "violet" };
}
function saveShop(v: ShopSave) { try { localStorage.setItem(SHOP_KEY, JSON.stringify(v)); } catch {} }
type AppliedUpgrade = { id: string; name: string; undo: () => void; redo: () => void };
type Upgrade = { id: string; name: string; desc: string; apply: () => AppliedUpgrade };

// ---------- Constants ----------
const W = 960;
const H = 600;
const CLONE_INTERVAL = 15;
const TICK = 1 / 60;
const TOTAL_WAVES = 100;
const BOSS_WAVES: Record<number, BossId> = { 15: "super", 30: "mega", 50: "hyper", 75: "plantium", 100: "plusplantium" };
const BOSS_NAMES: Record<string, string> = {
  super: "SHADOW TYRANT", mega: "VOID REAPER", hyper: "CHRONO LICH",
  plantium: "MEGAPLANTIUM OVERLORD", final: "OMEGA ANNIHILATOR",
  plusplantium: "PLUSPLANTIUM — THE ABSOLUTE",
};

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
    blur: number; frozen: boolean; stolen: { name: string; time: number } | null;
    bossName: string | null;
    shadowCoins: number;
  }>({
    started: false, over: false, won: false,
    wave: 0, score: 0, hp: 100, maxHp: 100,
    xp: 0, xpNext: 5, level: 1,
    coins: 0, time: 0, cloneTimer: CLONE_INTERVAL, clones: 0,
    enemiesLeft: 0, betweenWaves: false, upgrades: [],
    blur: 0, frozen: false, stolen: null, bossName: null,
    shadowCoins: 0,
  });

  const [shop, setShop] = useState<ShopSave>({ shadowCoins: 0, owned: ["violet"], selected: "violet" });
  const [shopOpen, setShopOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const shopRef = useRef(shop);
  useEffect(() => { setShop(loadShop()); setHydrated(true); }, []);
  useEffect(() => { shopRef.current = shop; if (hydrated) saveShop(shop); }, [shop, hydrated]);

  const stateRef = useRef({
    player: { pos: { x: W / 2, y: H / 2 } as Vec, r: 14, hp: 100, maxHp: 100 },
    stats: {
      moveSpeed: 220, fireRate: 4, bulletDmg: 18, bulletSpeed: 520,
      doubleBullets: false, cloneDmgMult: 1,
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
    appliedUpgrades: [] as AppliedUpgrade[],
    // ability effects
    blurTime: 0,
    freezeTime: 0,
    pullTime: 0,
    stolenUpgrade: null as AppliedUpgrade | null,
    stolenTimer: 0,
    // player buffs
    shieldTime: 0,
    speedBoostTime: 0,
    fireArrowTime: 0,
    fireTrail: [] as { x: number; y: number; life: number }[],
    // wave history for revive
    lastWaveEnemyCount: 0,
  });

  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.player = { pos: { x: W / 2, y: H / 2 }, r: 14, hp: 100, maxHp: 100 };
    s.stats = { moveSpeed: 220, fireRate: 4, bulletDmg: 18, bulletSpeed: 520, doubleBullets: false, cloneDmgMult: 1 };
    s.bullets = []; s.enemies = []; s.pickups = []; s.clones = []; s.recording = [];
    s.fireCd = 0; s.cloneFireCd = []; s.spawnQueue = 0; s.waveActive = false; s.bossSpawned = false;
    s.time = 0; s.cloneTimer = CLONE_INTERVAL; s.wave = 0; s.score = 0; s.coins = 0;
    s.xp = 0; s.xpNext = 5; s.level = 1; s.over = false; s.won = false;
    s.betweenWaves = false; s.pendingUpgrades = null; s.waveCleared = false;
    s.appliedUpgrades = [];
    s.blurTime = 0; s.freezeTime = 0; s.pullTime = 0;
    s.stolenUpgrade = null; s.stolenTimer = 0;
    s.shieldTime = 0; s.speedBoostTime = 0; s.fireArrowTime = 0; s.fireTrail = [];
    s.lastWaveEnemyCount = 0;
  }, []);

  function edgeSpawn(): Vec {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: rand(0, W), y: -20 };
    if (side === 1) return { x: rand(0, W), y: H + 20 };
    if (side === 2) return { x: -20, y: rand(0, H) };
    return { x: W + 20, y: rand(0, H) };
  }

  function spawnGrunt() {
    const s = stateRef.current;
    const waveBoost = 1 + s.wave * 0.15;
    const r = Math.random();
    let e: Enemy;
    if (r < 0.55) {
      e = { pos: edgeSpawn(), vel: { x: 0, y: 0 },
        hp: 55 * waveBoost, maxHp: 55 * waveBoost, r: 14, speed: 110 + s.wave * 1.2, baseSpeed: 110 + s.wave * 1.2,
        dmg: 16 + s.wave * 0.4, baseDmg: 16 + s.wave * 0.4, color: "#7cf24a", xp: 1, coin: 1, kind: "grunt" };
    } else if (r < 0.85) {
      e = { pos: edgeSpawn(), vel: { x: 0, y: 0 },
        hp: 32 * waveBoost, maxHp: 32 * waveBoost, r: 10, speed: 195 + s.wave * 1.5, baseSpeed: 195 + s.wave * 1.5,
        dmg: 13 + s.wave * 0.3, baseDmg: 13 + s.wave * 0.3, color: "#4ad6ff", xp: 2, coin: 1, kind: "fast" };
    } else {
      e = { pos: edgeSpawn(), vel: { x: 0, y: 0 },
        hp: 170 * waveBoost, maxHp: 170 * waveBoost, r: 20, speed: 75 + s.wave * 0.6, baseSpeed: 75 + s.wave * 0.6,
        dmg: 28 + s.wave * 0.6, baseDmg: 28 + s.wave * 0.6, color: "#ff8a3d", xp: 3, coin: 3, kind: "tank" };
    }
    s.enemies.push(e);
  }

  function spawnBossFor(id: BossId) {
    const s = stateRef.current;
    if (!id) return;
    let hp = 14000, dmg = 60, sp = 125, r = 48, color = "#ff2e88", guards = 8;
    if (id === "mega") { hp = 28000; dmg = 80; sp = 145; r = 54; color = "#a000ff"; guards = 12; }
    if (id === "hyper") { hp = 50000; dmg = 100; sp = 160; r = 60; color = "#00e5ff"; guards = 16; }
    if (id === "plantium") { hp = 85000; dmg = 130; sp = 175; r = 68; color = "#7cf24a"; guards = 20; }
    if (id === "final") { hp = 160000; dmg = 170; sp = 195; r = 80; color = "#ff0040"; guards = 26; }
    if (id === "plusplantium") { hp = 320000; dmg = 220; sp = 210; r = 92; color = "#ffe066"; guards = 36; }
    s.enemies.push({
      pos: edgeSpawn(), vel: { x: 0, y: 0 },
      hp, maxHp: hp, r, speed: sp, baseSpeed: sp, dmg, baseDmg: dmg,
      color, xp: 120, coin: 80, kind: "boss", bossId: id,
      abilityCds: { pull: 5, freeze: 8, steal: 12, revive: 10, blur: 15, hasten: 20, empower: 25 },
      abilityFlags: {},
    });
    for (let k = 0; k < guards; k++) {
      s.enemies.push({
        pos: edgeSpawn(), vel: { x: 0, y: 0 },
        hp: 280, maxHp: 280, r: 14, speed: 230, baseSpeed: 230,
        dmg: 24, baseDmg: 24, color: "#ff7ab8", xp: 4, coin: 2, kind: "fast",
      });
    }
    s.bossSpawned = true;
  }

  const startWave = useCallback(() => {
    const s = stateRef.current;
    s.wave += 1;
    s.waveActive = true;
    s.betweenWaves = false;
    s.waveCleared = false;
    s.bossSpawned = false;
    const bossId = BOSS_WAVES[s.wave] ?? null;
    if (bossId) {
      s.spawnQueue = 0;
      spawnBossFor(bossId);
      s.lastWaveEnemyCount = 1;
    } else {
      const count = 8 + Math.floor(s.wave * 2.2);
      s.spawnQueue = count;
      s.lastWaveEnemyCount = count;
    }
  }, []);

  const allUpgrades: Upgrade[] = [
    { id: "fire", name: "Rapid Fire", desc: "+35% fire rate", apply: () => {
        const s = stateRef.current; const prev = s.stats.fireRate;
        s.stats.fireRate *= 1.35;
        const newV = s.stats.fireRate;
        return { id: "fire", name: "Rapid Fire",
          undo: () => { s.stats.fireRate = prev; }, redo: () => { s.stats.fireRate = newV; } };
      } },
    { id: "dmg", name: "Sharper Bullets", desc: "+30% damage", apply: () => {
        const s = stateRef.current; const prev = s.stats.bulletDmg;
        s.stats.bulletDmg *= 1.3; const n = s.stats.bulletDmg;
        return { id: "dmg", name: "Sharper Bullets", undo: () => { s.stats.bulletDmg = prev; }, redo: () => { s.stats.bulletDmg = n; } };
      } },
    { id: "spd", name: "Swift Feet", desc: "+20% move speed", apply: () => {
        const s = stateRef.current; const prev = s.stats.moveSpeed;
        s.stats.moveSpeed *= 1.2; const n = s.stats.moveSpeed;
        return { id: "spd", name: "Swift Feet", undo: () => { s.stats.moveSpeed = prev; }, redo: () => { s.stats.moveSpeed = n; } };
      } },
    { id: "hp", name: "Vitality", desc: "+30 max HP & heal", apply: () => {
        const p = stateRef.current.player; const prevMax = p.maxHp;
        p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30);
        return { id: "hp", name: "Vitality", undo: () => { p.maxHp = prevMax; p.hp = Math.min(p.hp, p.maxHp); }, redo: () => { p.maxHp = prevMax + 30; } };
      } },
    { id: "double", name: "Double Shot", desc: "Fire two bullets", apply: () => {
        const s = stateRef.current; const prev = s.stats.doubleBullets;
        s.stats.doubleBullets = true;
        return { id: "double", name: "Double Shot", undo: () => { s.stats.doubleBullets = prev; }, redo: () => { s.stats.doubleBullets = true; } };
      } },
    { id: "clone", name: "Echo Power", desc: "+50% clone damage", apply: () => {
        const s = stateRef.current; const prev = s.stats.cloneDmgMult;
        s.stats.cloneDmgMult *= 1.5; const n = s.stats.cloneDmgMult;
        return { id: "clone", name: "Echo Power", undo: () => { s.stats.cloneDmgMult = prev; }, redo: () => { s.stats.cloneDmgMult = n; } };
      } },
    { id: "heal", name: "HEAL ME!", desc: "Spawn a healer clone that heals you for 5s", apply: () => {
        const s = stateRef.current;
        s.clones.push({ frames: [], idx: 0, trail: [], healer: true, life: 5 });
        s.cloneFireCd.push(0);
        return { id: "heal", name: "HEAL ME!", undo: () => {}, redo: () => {
          s.clones.push({ frames: [], idx: 0, trail: [], healer: true, life: 5 });
          s.cloneFireCd.push(0);
        } };
      } },
    { id: "bronze", name: "Bronze Defence", desc: "Shield reduces enemy damage by 45% for 20s", apply: () => {
        const s = stateRef.current; s.shieldTime = Math.max(s.shieldTime, 20);
        return { id: "bronze", name: "Bronze Defence", undo: () => {}, redo: () => { s.shieldTime = Math.max(s.shieldTime, 20); } };
      } },
    { id: "superspeed", name: "Super Speed", desc: "+500% move speed & fire trail for 5s", apply: () => {
        const s = stateRef.current; s.speedBoostTime = Math.max(s.speedBoostTime, 5);
        return { id: "superspeed", name: "Super Speed", undo: () => {}, redo: () => { s.speedBoostTime = Math.max(s.speedBoostTime, 5); } };
      } },
    { id: "firearrows", name: "Fire Arrows", desc: "Shots deal +50% damage as fire for 25s", apply: () => {
        const s = stateRef.current; s.fireArrowTime = Math.max(s.fireArrowTime, 25);
        return { id: "firearrows", name: "Fire Arrows", undo: () => {}, redo: () => { s.fireArrowTime = Math.max(s.fireArrowTime, 25); } };
      } },
  ];

  const rollUpgrades = useCallback((): Upgrade[] => {
    const pool = [...allUpgrades];
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
    const applied = u.apply();
    const s = stateRef.current;
    s.appliedUpgrades.push(applied);
    s.pendingUpgrades = null;
    s.betweenWaves = false;
    startWave();
  };

  const startGame = () => {
    resetGame();
    setUiState((u) => ({ ...u, started: true, over: false, won: false, blur: 0, frozen: false, stolen: null, bossName: null }));
    startWave();
  };

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
      const fireMul = s.fireArrowTime > 0 ? 1.5 : 1;
      const dmg = (from === "player" ? s.stats.bulletDmg * fireMul : s.stats.bulletDmg * 0.45 * s.stats.cloneDmgMult * fireMul);
      const color = s.fireArrowTime > 0 ? "#ff7a18" : (from === "player" ? "#ffe066" : "#b388ff");
      const speed = s.stats.bulletSpeed;
      const make = (dx: number, dy: number) => s.bullets.push({
        pos: { x: origin.x, y: origin.y }, vel: { x: dx * speed, y: dy * speed },
        life: 1.2, dmg, from, color,
      });
      if (s.stats.doubleBullets) {
        const ang = Math.atan2(dir.y, dir.x);
        const spread = 0.12;
        make(Math.cos(ang - spread), Math.sin(ang - spread));
        make(Math.cos(ang + spread), Math.sin(ang + spread));
      } else { make(dir.x, dir.y); }
    };

    const runBossAbilities = (boss: Enemy, dt: number) => {
      const s = stateRef.current;
      const cds = boss.abilityCds!;
      const flags = boss.abilityFlags!;
      const id = boss.bossId;
      // shared: pull (mega, plantium, final)
      const isPP = id === "plusplantium";
      if (id === "mega" || id === "plantium" || id === "final" || isPP) {
        cds.pull -= dt;
        if (cds.pull <= 0) {
          s.pullTime = isPP ? 1.6 : 1.2;
          cds.pull = isPP ? 4 : id === "final" ? 6 : 8;
        }
      }
      if (id === "hyper" || id === "plantium" || id === "final" || isPP) {
        cds.freeze -= dt;
        if (cds.freeze <= 0) {
          s.freezeTime = isPP ? 3 : 2.5;
          s.player.hp -= boss.dmg * (isPP ? 0.8 : 0.6);
          cds.freeze = isPP ? 9 : id === "final" ? 12 : 15;
        }
      }
      if (id === "hyper" || id === "final" || isPP) {
        cds.steal -= dt;
        if (cds.steal <= 0 && !s.stolenUpgrade && s.appliedUpgrades.length > 0) {
          const idx = Math.floor(Math.random() * s.appliedUpgrades.length);
          const stolen = s.appliedUpgrades[idx];
          stolen.undo();
          s.stolenUpgrade = stolen;
          s.stolenTimer = isPP ? 35 : 25;
          cds.steal = isPP ? 22 : 30;
        }
      }
      if (id === "plantium" || id === "final" || isPP) {
        cds.revive -= dt;
        if (cds.revive <= 0) {
          const n = isPP ? Math.max(8, s.lastWaveEnemyCount) : Math.max(4, Math.floor(s.lastWaveEnemyCount * 0.5));
          for (let k = 0; k < n; k++) spawnGrunt();
          cds.revive = isPP ? 18 : 25;
        }
        cds.blur -= dt;
        if (cds.blur <= 0) { s.blurTime = isPP ? 9 : 6; cds.blur = isPP ? 14 : 18; }
        if (!flags.hastened) { cds.hasten -= dt; if (cds.hasten <= 0) { boss.speed = boss.baseSpeed * (isPP ? 1.8 : 1.5); flags.hastened = true; } }
        if (!flags.empowered) { cds.empower -= dt; if (cds.empower <= 0) { boss.dmg = boss.baseDmg * (isPP ? 1.5 : 1.25); flags.empowered = true; } }
      }
    };

    const step = (dt: number) => {
      const s = stateRef.current;
      if (s.over || s.won || s.betweenWaves) return;

      s.time += dt;

      // tick effect timers
      if (s.blurTime > 0) s.blurTime = Math.max(0, s.blurTime - dt);
      if (s.freezeTime > 0) s.freezeTime = Math.max(0, s.freezeTime - dt);
      if (s.pullTime > 0) s.pullTime = Math.max(0, s.pullTime - dt);
      if (s.stolenUpgrade) {
        s.stolenTimer -= dt;
        if (s.stolenTimer <= 0) { s.stolenUpgrade.redo(); s.stolenUpgrade = null; }
      }

      const frozen = s.freezeTime > 0;

      // Movement
      const i = s.input;
      if (!frozen) {
        let dx = (i.right ? 1 : 0) - (i.left ? 1 : 0);
        let dy = (i.down ? 1 : 0) - (i.up ? 1 : 0);
        const mag = Math.hypot(dx, dy);
        if (mag > 0) { dx /= mag; dy /= mag; }
        s.player.pos.x += dx * s.stats.moveSpeed * dt;
        s.player.pos.y += dy * s.stats.moveSpeed * dt;
      }

      // Pull effect
      if (s.pullTime > 0) {
        const boss = s.enemies.find(e => e.kind === "boss");
        if (boss) {
          const d = norm({ x: boss.pos.x - s.player.pos.x, y: boss.pos.y - s.player.pos.y });
          s.player.pos.x += d.x * 380 * dt;
          s.player.pos.y += d.y * 380 * dt;
        }
      }
      s.player.pos.x = Math.max(s.player.r, Math.min(W - s.player.r, s.player.pos.x));
      s.player.pos.y = Math.max(s.player.r, Math.min(H - s.player.r, s.player.pos.y));

      // Shooting
      s.fireCd -= dt;
      if (!frozen && i.shoot && s.fireCd <= 0) {
        fireBullet(s.player.pos, i.aim, "player");
        s.fireCd = 1 / s.stats.fireRate;
      }

      // Record
      if (!frozen) s.recording.push({ pos: { x: s.player.pos.x, y: s.player.pos.y }, aim: { x: i.aim.x, y: i.aim.y }, shoot: i.shoot });

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

      // Update clones (healer + normal)
      const cloneSurvive: boolean[] = [];
      for (let c = 0; c < s.clones.length; c++) {
        const cl = s.clones[c];
        if (cl.healer) {
          cl.life = (cl.life ?? 0) - dt;
          // heal pulse
          s.player.hp = Math.min(s.player.maxHp, s.player.hp + 14 * dt);
          cloneSurvive.push((cl.life ?? 0) > 0);
        } else {
          const f = cl.frames[cl.idx];
          if (f) {
            s.cloneFireCd[c] -= dt;
            if (f.shoot && s.cloneFireCd[c] <= 0) {
              fireBullet(f.pos, f.aim, "clone");
              s.cloneFireCd[c] = 1 / (s.stats.fireRate * 0.4);
            }
            cl.idx++;
            if (cl.idx >= cl.frames.length) cl.idx = 0;
          }
          cloneSurvive.push(true);
        }
      }
      const newClones: Clone[] = []; const newCds: number[] = [];
      for (let c = 0; c < s.clones.length; c++) if (cloneSurvive[c]) { newClones.push(s.clones[c]); newCds.push(s.cloneFireCd[c]); }
      s.clones = newClones; s.cloneFireCd = newCds;

      // Spawn waves
      const isBossWave = !!BOSS_WAVES[s.wave];
      if (s.waveActive && !isBossWave && s.spawnQueue > 0 && Math.random() < 0.04 + s.wave * 0.003) {
        spawnGrunt(); s.spawnQueue--;
      }

      // Enemies
      for (const e of s.enemies) {
        if (!frozen || e.kind === "boss") {
          const d = norm({ x: s.player.pos.x - e.pos.x, y: s.player.pos.y - e.pos.y });
          e.pos.x += d.x * e.speed * dt;
          e.pos.y += d.y * e.speed * dt;
        }
        if (e.kind === "boss" && e.abilityCds) runBossAbilities(e, dt);
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
            e.hp -= b.dmg; b.life = 0; break;
          }
        }
      }
      s.bullets = s.bullets.filter(b => b.life > 0 && b.pos.x > -20 && b.pos.x < W + 20 && b.pos.y > -20 && b.pos.y < H + 20);

      // Dead => drops
      const survivors: Enemy[] = [];
      for (const e of s.enemies) {
        if (e.hp <= 0) {
          s.score += Math.round(e.maxHp);
          for (let k = 0; k < e.xp; k++) s.pickups.push({ pos: { x: e.pos.x + rand(-6, 6), y: e.pos.y + rand(-6, 6) }, kind: "xp", value: 1 });
          for (let k = 0; k < e.coin; k++) s.pickups.push({ pos: { x: e.pos.x + rand(-6, 6), y: e.pos.y + rand(-6, 6) }, kind: "coin", value: 1 });
          // Shadow Coins: ~8% drop from normal enemies, guaranteed big drop from bosses
          const shadowDrop = e.kind === "boss" ? 25 + Math.floor(e.maxHp / 4000) : (Math.random() < 0.08 ? 1 : 0);
          for (let k = 0; k < shadowDrop; k++) s.pickups.push({ pos: { x: e.pos.x + rand(-10, 10), y: e.pos.y + rand(-10, 10) }, kind: "shadow", value: 1 });
        } else survivors.push(e);
      }
      s.enemies = survivors;

      // Pickups
      const remPick: Pickup[] = [];
      for (const p of s.pickups) {
        const dd = dist(p.pos, s.player.pos);
        if (dd < 80) {
          const dir = norm({ x: s.player.pos.x - p.pos.x, y: s.player.pos.y - p.pos.y });
          p.pos.x += dir.x * 240 * dt; p.pos.y += dir.y * 240 * dt;
        }
        if (dd < s.player.r + 6) {
          if (p.kind === "xp") {
            s.xp += p.value;
            while (s.xp >= s.xpNext) { s.xp -= s.xpNext; s.level++; s.xpNext = Math.round(s.xpNext * 1.4 + 2); }
          } else if (p.kind === "shadow") {
            setShop((sv) => ({ ...sv, shadowCoins: sv.shadowCoins + p.value }));
          } else { s.coins += p.value; }
        } else remPick.push(p);
      }
      s.pickups = remPick;

      if (s.player.hp <= 0) { s.player.hp = 0; s.over = true; }

      // Wave clear
      if (s.waveActive && !s.waveCleared) {
        const noQueue = isBossWave ? s.bossSpawned : s.spawnQueue <= 0;
        if (noQueue && s.enemies.length === 0) {
          s.waveActive = false; s.waveCleared = true;
          // Wave clear bonus: 10 Shadow Coins
          setShop((sv) => ({ ...sv, shadowCoins: sv.shadowCoins + 10 }));
          if (s.wave >= TOTAL_WAVES) {
            s.won = true;
          } else {
            // restore stolen on wave clear
            if (s.stolenUpgrade) { s.stolenUpgrade.redo(); s.stolenUpgrade = null; }
            s.betweenWaves = true;
            s.pendingUpgrades = rollUpgrades();
          }
        }
      }
    };

    const draw = () => {
      const s = stateRef.current;
      ctx.fillStyle = "#0b0d1a";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      for (const p of s.pickups) {
        if (p.kind === "shadow") {
          ctx.fillStyle = "#b388ff";
          ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "bold 7px system-ui"; ctx.textAlign = "center";
          ctx.fillText("S", p.pos.x, p.pos.y + 2.5);
        } else {
          ctx.fillStyle = p.kind === "xp" ? "#7cf24a" : "#ffd54a";
          ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 4, 0, Math.PI * 2); ctx.fill();
        }
      }

      const skin = SKINS.find(sk => sk.id === shopRef.current.selected) ?? SKINS[0];
      let skinColor = skin.color;
      let skinGlow = skin.glow ?? "rgba(179,136,255,0.55)";
      if (skin.rainbow) {
        const hue = (s.time * 120) % 360;
        skinColor = `hsl(${hue},90%,65%)`;
        skinGlow = `hsla(${hue},90%,65%,0.55)`;
      }
      for (const cl of s.clones) {
        if (cl.healer) {
          const px = s.player.pos.x, py = s.player.pos.y - 26;
          ctx.fillStyle = "rgba(124,242,74,0.65)";
          ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
          ctx.fillText("+", px, py + 4);
        } else {
          const f = cl.frames[cl.idx]; if (!f) continue;
          ctx.fillStyle = skinGlow;
          ctx.beginPath(); ctx.arc(f.pos.x, f.pos.y, 12, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = skinColor; ctx.lineWidth = 2;
          const ang = Math.atan2(f.aim.y - f.pos.y, f.aim.x - f.pos.x);
          ctx.beginPath(); ctx.moveTo(f.pos.x, f.pos.y);
          ctx.lineTo(f.pos.x + Math.cos(ang) * 18, f.pos.y + Math.sin(ang) * 18); ctx.stroke();
        }
      }

      for (const e of s.enemies) {
        ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y, e.r, 0, Math.PI * 2); ctx.fill();
        const w = e.r * 2;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(e.pos.x - w / 2, e.pos.y - e.r - 8, w, 4);
        ctx.fillStyle = "#ff5d5d";
        ctx.fillRect(e.pos.x - w / 2, e.pos.y - e.r - 8, w * (e.hp / e.maxHp), 4);
      }

      for (const b of s.bullets) {
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, 4, 0, Math.PI * 2); ctx.fill();
      }

      const p = s.player;
      ctx.fillStyle = "#ffe066";
      ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
      const ang = Math.atan2(s.input.aim.y - p.pos.y, s.input.aim.x - p.pos.x);
      ctx.beginPath(); ctx.moveTo(p.pos.x, p.pos.y);
      ctx.lineTo(p.pos.x + Math.cos(ang) * 22, p.pos.y + Math.sin(ang) * 22); ctx.stroke();

      const boss = s.enemies.find(e => e.kind === "boss");
      if (boss) {
        const bw = W * 0.6;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect((W - bw) / 2, 14, bw, 14);
        ctx.fillStyle = boss.color;
        ctx.fillRect((W - bw) / 2, 14, bw * (boss.hp / boss.maxHp), 14);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
        ctx.fillText(BOSS_NAMES[boss.bossId ?? "super"] ?? "BOSS", W / 2, 24);
      }

      if (s.freezeTime > 0) {
        ctx.fillStyle = "rgba(0,229,255,0.18)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#00e5ff"; ctx.font = "bold 28px system-ui"; ctx.textAlign = "center";
        ctx.fillText("TIME FROZEN", W / 2, H / 2);
      }
      if (s.pullTime > 0) {
        ctx.strokeStyle = "rgba(160,0,255,0.6)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 30 + s.pullTime * 30, 0, Math.PI * 2); ctx.stroke();
      }
    };

    const loop = (now: number) => {
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.05) dt = 0.05;
      let acc = dt;
      while (acc > 0) { const t = Math.min(TICK, acc); step(t); acc -= t; }
      draw();

      const s = stateRef.current;
      setUiState((u) => {
        if (s.over) {
          return { ...u, started: false, over: false, wave: s.wave, score: s.score };
        }
        const upg = s.pendingUpgrades ?? u.upgrades;
        const boss = s.enemies.find(e => e.kind === "boss");
        return {
          ...u,
          wave: s.wave, score: s.score,
          hp: Math.max(0, Math.round(s.player.hp)), maxHp: s.player.maxHp,
          xp: s.xp, xpNext: s.xpNext, level: s.level,
          coins: s.coins, time: s.time,
          cloneTimer: Math.max(0, s.cloneTimer),
          clones: s.clones.length,
          enemiesLeft: s.enemies.length + s.spawnQueue,
          betweenWaves: s.betweenWaves, upgrades: upg,
          over: s.over, won: s.won,
          blur: s.blurTime, frozen: s.freezeTime > 0,
          stolen: s.stolenUpgrade ? { name: s.stolenUpgrade.name, time: s.stolenTimer } : null,
          bossName: boss ? (BOSS_NAMES[boss.bossId ?? "super"] ?? null) : null,
          shadowCoins: shopRef.current.shadowCoins,
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
        <p className="text-sm text-white/60">WASD · Mouse aim · Click to shoot · Survive 100 waves</p>
      </header>

      <div className="relative" style={{ width: "min(96vw, 960px)" }}>
        <div className="flex flex-wrap items-center gap-3 mb-2 text-xs md:text-sm font-mono">
          <Stat label="Wave" value={`${uiState.wave}/${TOTAL_WAVES}`} />
          <Stat label="Score" value={uiState.score.toString()} />
          <Stat label="Coins" value={uiState.coins.toString()} />
          <Stat label="Shadow ◆" value={uiState.shadowCoins.toString()} />
          <Stat label="Lvl" value={uiState.level.toString()} />
          <Stat label="Clones" value={uiState.clones.toString()} />
          <Stat label="Next Clone" value={`${uiState.cloneTimer.toFixed(1)}s`} />
          <Stat label="Time" value={`${uiState.time.toFixed(1)}s`} />
          <Stat label="Enemies" value={uiState.enemiesLeft.toString()} />
          {uiState.stolen && <Stat label="STOLEN" value={`${uiState.stolen.name} (${uiState.stolen.time.toFixed(0)}s)`} />}
        </div>

        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-1">
          <div className="h-full bg-gradient-to-r from-[#ff5d5d] to-[#ffe066] transition-[width] duration-150"
            style={{ width: `${(uiState.hp / uiState.maxHp) * 100}%` }} />
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-[#7cf24a]" style={{ width: `${(uiState.xp / uiState.xpNext) * 100}%` }} />
        </div>

        <div className="relative rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
          <canvas
            ref={canvasRef} width={W} height={H}
            className="block w-full h-auto cursor-crosshair bg-[#0b0d1a]"
            style={{ aspectRatio: `${W}/${H}`, filter: uiState.blur > 0 ? `blur(${Math.min(8, uiState.blur * 1.4)}px)` : undefined, transition: "filter 0.2s" }}
          />

          {!uiState.started && !shopOpen && (
            <Overlay>
              {uiState.wave > 0 && (
                <div className="text-center mb-4">
                  <h2 className="text-3xl font-black text-[#ff5d5d] mb-1">You fell.</h2>
                  <p className="text-white/70 text-sm">Wave reached: {uiState.wave} · Score: {uiState.score}</p>
                </div>
              )}
              <h2 className="text-2xl font-bold mb-2">Ready to survive?</h2>
              <p className="text-white/70 mb-4 max-w-md text-center text-sm">
                100 waves. Bosses at 15, 30, 50, 75, and 100 with brutal abilities. Every 15s your past becomes a clone that fights with you.
              </p>
              <div className="flex gap-3">
                <button onClick={startGame} className="px-6 py-3 rounded-lg bg-[#ffe066] text-black font-bold hover:scale-105 transition">
                  Start Game
                </button>
                <button onClick={() => setShopOpen(true)} className="px-6 py-3 rounded-lg bg-[#b388ff] text-black font-bold hover:scale-105 transition">
                  Shop ◆ {shop.shadowCoins}
                </button>
              </div>
            </Overlay>
          )}

          {shopOpen && (
            <Overlay>
              <div className="w-full max-w-3xl px-4 max-h-full overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-2xl font-black bg-gradient-to-r from-[#b388ff] to-[#ffe066] bg-clip-text text-transparent">Shadow Shop</h2>
                  <div className="text-sm font-mono">Shadow Coins: <span className="text-[#b388ff] font-bold">◆ {shop.shadowCoins}</span></div>
                </div>
                <p className="text-white/60 text-xs mb-3">Earn Shadow Coins by defeating enemies (bosses drop big). Skins change your shadow clones' look.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {SKINS.map((sk) => {
                    const owned = shop.owned.includes(sk.id);
                    const selected = shop.selected === sk.id;
                    const canBuy = !owned && shop.shadowCoins >= sk.price;
                    return (
                      <div key={sk.id} className={`p-3 rounded-lg ring-1 ${selected ? "ring-[#ffe066] bg-white/10" : "ring-white/10 bg-white/5"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full" style={{ background: sk.color, boxShadow: `0 0 14px ${sk.glow ?? sk.color}` }} />
                          <div className="font-bold text-sm">{sk.name}</div>
                        </div>
                        <div className="text-xs text-white/60 mb-2">{sk.price === 0 ? "Starter" : `◆ ${sk.price}`}</div>
                        {owned ? (
                          <button
                            disabled={selected}
                            onClick={() => setShop((v) => ({ ...v, selected: sk.id }))}
                            className="w-full px-2 py-1.5 rounded text-xs font-bold bg-[#ffe066] text-black disabled:bg-white/20 disabled:text-white/60"
                          >
                            {selected ? "Equipped" : "Equip"}
                          </button>
                        ) : (
                          <button
                            disabled={!canBuy}
                            onClick={() => setShop((v) => ({ ...v, shadowCoins: v.shadowCoins - sk.price, owned: [...v.owned, sk.id], selected: sk.id }))}
                            className="w-full px-2 py-1.5 rounded text-xs font-bold bg-[#b388ff] text-black disabled:bg-white/10 disabled:text-white/40"
                          >
                            {canBuy ? "Buy & Equip" : `Need ◆${sk.price - shop.shadowCoins}`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end mt-4">
                  <button onClick={() => setShopOpen(false)} className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-bold text-sm">Close</button>
                </div>
              </div>
            </Overlay>
          )}

          {uiState.started && uiState.betweenWaves && uiState.upgrades.length > 0 && (
            <Overlay>
              <h2 className="text-xl font-bold mb-1">Wave {uiState.wave} cleared!</h2>
              <p className="text-white/60 text-sm mb-4">Pick an upgrade</p>
              <div className="grid md:grid-cols-3 gap-3 w-full max-w-3xl px-4">
                {uiState.upgrades.map((u, idx) => (
                  <button
                    key={`${uiState.wave}-${idx}-${u.id}`}
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


          {uiState.won && (
            <Overlay>
              <h2 className="text-3xl font-black mb-2 bg-gradient-to-r from-[#ffe066] to-[#b388ff] bg-clip-text text-transparent">Omega Slain!</h2>
              <p className="text-white/70 mb-1">Score: {uiState.score} · Coins: {uiState.coins}</p>
              <p className="text-white/70 mb-4">All 100 waves survived.</p>
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
