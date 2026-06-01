import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import upgFire from "@/assets/upgrades/fire.png";
import upgDmg from "@/assets/upgrades/dmg.png";
import upgSpd from "@/assets/upgrades/spd.png";
import upgHp from "@/assets/upgrades/hp.png";
import upgDouble from "@/assets/upgrades/double.png";
import upgClone from "@/assets/upgrades/clone.png";
import upgHeal from "@/assets/upgrades/heal.png";
import upgBronze from "@/assets/upgrades/bronze.png";
import upgSuperspeed from "@/assets/upgrades/superspeed.png";
import upgFirearrows from "@/assets/upgrades/firearrows.png";
import upgKingshadows from "@/assets/upgrades/kingshadows.png";
import upgHypersonic from "@/assets/upgrades/hypersonic.png";
import upgTornado from "@/assets/upgrades/tornado.png";
import upgDarkness from "@/assets/upgrades/darkness.png";
import upgBigclones from "@/assets/upgrades/bigclones.png";

const UPGRADE_ICONS: Record<string, string> = {
  fire: upgFire, dmg: upgDmg, spd: upgSpd, hp: upgHp, double: upgDouble,
  clone: upgClone, heal: upgHeal, bronze: upgBronze, superspeed: upgSuperspeed,
  firearrows: upgFirearrows, kingshadows: upgKingshadows, hypersonic: upgHypersonic,
  tornado: upgTornado, darkness: upgDarkness, bigclones: upgBigclones,
};

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
  randomDir?: Vec; randomTimer?: number;
};
type Pickup = { pos: Vec; kind: "xp" | "coin" | "shadow"; value: number };
type Clone = { frames: Frame[]; idx: number; trail: Vec[]; healer?: boolean; life?: number };
type SpecialClone = { kind: "electric" | "big"; angle: number; radius: number; orbitSpeed: number; life?: number; fireCd: number };
type Rarity = "common"|"rare"|"superrare"|"epic"|"mythical"|"legendary"|"secret"|"ultra"|"diamond"|"rainbow"|"prismatic"|"vip"|"nebula"|"plantiumplus"|"cosmetic"|"ultranova";
type Skin = { id: string; name: string; price: number; color: string; glow?: string; rainbow?: boolean; rarity: Rarity };

const RARITY_ORDER: Rarity[] = ["common","rare","superrare","epic","mythical","legendary","secret","ultra","diamond","rainbow","prismatic","vip","nebula","plantiumplus","cosmetic","ultranova"];
const RARITY_META: Record<Rarity, { label: string; color: string }> = {
  common:       { label: "Common",        color: "#9ca3af" },
  rare:         { label: "Rare",          color: "#38bdf8" },
  superrare:    { label: "Super Rare",    color: "#22d3ee" },
  epic:         { label: "Epic",          color: "#a78bfa" },
  mythical:     { label: "Mythical",      color: "#f472b6" },
  legendary:    { label: "Legendary",     color: "#ffd54a" },
  secret:       { label: "Secret",        color: "#6b7280" },
  ultra:        { label: "Ultra",         color: "#ff7a18" },
  diamond:      { label: "Diamond",       color: "#7dd3fc" },
  rainbow:      { label: "Rainbow",       color: "#ff5dff" },
  prismatic:    { label: "Prismatic",     color: "#c084fc" },
  vip:          { label: "VIP",           color: "#fde047" },
  nebula:       { label: "Nebula",        color: "#818cf8" },
  plantiumplus: { label: "Plantium Plus", color: "#a3e635" },
  cosmetic:     { label: "Cosmetic",      color: "#f0abfc" },
  ultranova:    { label: "Ultra Nova",    color: "#fff" },
};

const SKINS: Skin[] = [
  // Common (15) — starter + cheap variants
  { id: "violet",       name: "Violet Echo",        rarity: "common", price: 0,   color: "#b388ff", glow: "rgba(179,136,255,0.55)" },
  { id: "ash",          name: "Ash Wisp",           rarity: "common", price: 30,  color: "#9ca3af", glow: "rgba(156,163,175,0.55)" },
  { id: "ember",        name: "Ember Glint",        rarity: "common", price: 50,  color: "#fb923c", glow: "rgba(251,146,60,0.55)" },
  { id: "moss",         name: "Moss Shade",         rarity: "common", price: 75,  color: "#84cc16", glow: "rgba(132,204,22,0.55)" },
  { id: "sky",          name: "Sky Whisper",        rarity: "common", price: 100, color: "#7dd3fc", glow: "rgba(125,211,252,0.55)" },
  { id: "rose",         name: "Rose Mist",          rarity: "common", price: 125, color: "#fda4af", glow: "rgba(253,164,175,0.55)" },
  { id: "sand",         name: "Sand Drift",         rarity: "common", price: 150, color: "#d6c79c", glow: "rgba(214,199,156,0.55)" },
  { id: "teal",         name: "Teal Murmur",        rarity: "common", price: 175, color: "#5eead4", glow: "rgba(94,234,212,0.55)" },
  { id: "plum",         name: "Plum Veil",          rarity: "common", price: 200, color: "#a855f7", glow: "rgba(168,85,247,0.55)" },
  { id: "coral",        name: "Coral Hum",          rarity: "common", price: 225, color: "#fb7185", glow: "rgba(251,113,133,0.55)" },
  { id: "lime",         name: "Lime Spark",         rarity: "common", price: 250, color: "#bef264", glow: "rgba(190,242,100,0.55)" },
  { id: "iron",         name: "Iron Faint",         rarity: "common", price: 275, color: "#6b7280", glow: "rgba(107,114,128,0.55)" },
  { id: "honey",        name: "Honey Drop",         rarity: "common", price: 300, color: "#fcd34d", glow: "rgba(252,211,77,0.55)" },
  { id: "fern",         name: "Fern Glow",          rarity: "common", price: 325, color: "#65a30d", glow: "rgba(101,163,13,0.55)" },
  { id: "lilac",        name: "Lilac Dust",         rarity: "common", price: 350, color: "#c4b5fd", glow: "rgba(196,181,253,0.55)" },

  // Rare (10)
  { id: "crimson",      name: "Crimson Wraith",     rarity: "rare", price: 450,  color: "#ff5d7a", glow: "rgba(255,93,122,0.65)" },
  { id: "emerald",      name: "Emerald Phantom",    rarity: "rare", price: 550,  color: "#4ade80", glow: "rgba(74,222,128,0.65)" },
  { id: "azure",        name: "Azure Spectre",      rarity: "rare", price: 650,  color: "#38bdf8", glow: "rgba(56,189,248,0.65)" },
  { id: "amber",        name: "Amber Phantom",      rarity: "rare", price: 750,  color: "#f59e0b", glow: "rgba(245,158,11,0.65)" },
  { id: "jade",         name: "Jade Hollow",        rarity: "rare", price: 850,  color: "#10b981", glow: "rgba(16,185,129,0.65)" },
  { id: "ruby",         name: "Ruby Pulse",         rarity: "rare", price: 950,  color: "#e11d48", glow: "rgba(225,29,72,0.65)" },
  { id: "sapphire",     name: "Sapphire Vow",       rarity: "rare", price: 1100, color: "#3b82f6", glow: "rgba(59,130,246,0.65)" },
  { id: "topaz",        name: "Topaz Beam",         rarity: "rare", price: 1250, color: "#fbbf24", glow: "rgba(251,191,36,0.65)" },
  { id: "onyx",         name: "Onyx Shade",         rarity: "rare", price: 1400, color: "#1f2937", glow: "rgba(75,85,99,0.75)" },
  { id: "magenta",      name: "Magenta Pulse",      rarity: "rare", price: 1600, color: "#d946ef", glow: "rgba(217,70,239,0.65)" },

  // Super Rare (10)
  { id: "gold",         name: "Golden Specter",     rarity: "superrare", price: 1800, color: "#ffd54a", glow: "rgba(255,213,74,0.75)" },
  { id: "inferno",      name: "Inferno Echo",       rarity: "superrare", price: 2100, color: "#ff7a18", glow: "rgba(255,122,24,0.85)" },
  { id: "frost",        name: "Frost Caller",       rarity: "superrare", price: 2400, color: "#bae6fd", glow: "rgba(186,230,253,0.85)" },
  { id: "venom",        name: "Venom Sigil",        rarity: "superrare", price: 2700, color: "#a3e635", glow: "rgba(163,230,53,0.85)" },
  { id: "stormy",       name: "Storm Bringer",      rarity: "superrare", price: 3000, color: "#60a5fa", glow: "rgba(96,165,250,0.85)" },
  { id: "abyss",        name: "Abyss Walker",       rarity: "superrare", price: 3400, color: "#1e293b", glow: "rgba(99,102,241,0.85)" },
  { id: "solar",        name: "Solar Flare",        rarity: "superrare", price: 3800, color: "#facc15", glow: "rgba(250,204,21,0.9)" },
  { id: "lunar",        name: "Lunar Tide",         rarity: "superrare", price: 4200, color: "#e0e7ff", glow: "rgba(224,231,255,0.85)" },
  { id: "toxic",        name: "Toxic Bloom",        rarity: "superrare", price: 4600, color: "#22c55e", glow: "rgba(34,197,94,0.85)" },
  { id: "ember2",       name: "Cinder Lord",        rarity: "superrare", price: 5000, color: "#dc2626", glow: "rgba(220,38,38,0.9)" },

  // Epic (5)
  { id: "phoenix",      name: "Phoenix Heart",      rarity: "epic", price: 6000,  color: "#ff5722", glow: "rgba(255,87,34,0.9)" },
  { id: "wraithking",   name: "Wraith King",        rarity: "epic", price: 7000,  color: "#7c3aed", glow: "rgba(124,58,237,0.9)" },
  { id: "voidstep",     name: "Void Stepper",       rarity: "epic", price: 8000,  color: "#312e81", glow: "rgba(99,102,241,0.9)" },
  { id: "bloodmoon",    name: "Blood Moon",         rarity: "epic", price: 9000,  color: "#b91c1c", glow: "rgba(185,28,28,0.9)" },
  { id: "stormlord",    name: "Storm Lord",         rarity: "epic", price: 10000, color: "#0ea5e9", glow: "rgba(14,165,233,0.9)" },

  // Mythical (5)
  { id: "myth_drake",   name: "Drake Whisper",      rarity: "mythical", price: 12000, color: "#ec4899", glow: "rgba(236,72,153,0.95)" },
  { id: "myth_titan",   name: "Titan Shard",        rarity: "mythical", price: 14000, color: "#f43f5e", glow: "rgba(244,63,94,0.95)" },
  { id: "myth_oracle",  name: "Oracle Eye",         rarity: "mythical", price: 16000, color: "#a21caf", glow: "rgba(162,28,175,0.95)" },
  { id: "myth_chimera", name: "Chimera Veil",       rarity: "mythical", price: 18000, color: "#f97316", glow: "rgba(249,115,22,0.95)" },
  { id: "myth_kraken",  name: "Kraken Ink",         rarity: "mythical", price: 20000, color: "#0f766e", glow: "rgba(15,118,110,0.95)" },

  // Legendary (6)
  { id: "leg_dragon",   name: "Dragon Sovereign",   rarity: "legendary", price: 24000, color: "#ef4444", glow: "rgba(239,68,68,1)" },
  { id: "leg_archmage", name: "Archmage Aura",      rarity: "legendary", price: 28000, color: "#8b5cf6", glow: "rgba(139,92,246,1)" },
  { id: "leg_seraph",   name: "Seraph Wing",        rarity: "legendary", price: 32000, color: "#fde68a", glow: "rgba(253,230,138,1)" },
  { id: "leg_lich",     name: "Lich Crown",         rarity: "legendary", price: 36000, color: "#14b8a6", glow: "rgba(20,184,166,1)" },
  { id: "leg_phantom",  name: "Phantom King",       rarity: "legendary", price: 40000, color: "#6d28d9", glow: "rgba(109,40,217,1)" },
  { id: "leg_chrono",   name: "Chrono Warden",      rarity: "legendary", price: 45000, color: "#06b6d4", glow: "rgba(6,182,212,1)" },

  // Secret (5)
  { id: "sec_null",     name: "Null Sigil",         rarity: "secret", price: 55000, color: "#111827", glow: "rgba(75,85,99,1)" },
  { id: "sec_eye",      name: "Hidden Eye",         rarity: "secret", price: 65000, color: "#374151", glow: "rgba(156,163,175,0.9)" },
  { id: "sec_ghost",    name: "Ghost Cipher",       rarity: "secret", price: 75000, color: "#9ca3af", glow: "rgba(229,231,235,0.95)" },
  { id: "sec_shroud",   name: "Shroud Walker",      rarity: "secret", price: 85000, color: "#1e1b4b", glow: "rgba(67,56,202,1)" },
  { id: "sec_glyph",    name: "Forbidden Glyph",    rarity: "secret", price: 95000, color: "#7f1d1d", glow: "rgba(220,38,38,1)" },

  // Ultra (5)
  { id: "ult_blaze",    name: "Ultra Blaze",        rarity: "ultra", price: 110000, color: "#f97316", glow: "rgba(249,115,22,1)" },
  { id: "ult_void",     name: "Ultra Void",         rarity: "ultra", price: 130000, color: "#4c1d95", glow: "rgba(124,58,237,1)" },
  { id: "ult_frost",    name: "Ultra Frost",        rarity: "ultra", price: 150000, color: "#22d3ee", glow: "rgba(34,211,238,1)" },
  { id: "ult_storm",    name: "Ultra Storm",        rarity: "ultra", price: 170000, color: "#2563eb", glow: "rgba(37,99,235,1)" },
  { id: "ult_inferno",  name: "Ultra Inferno",      rarity: "ultra", price: 190000, color: "#dc2626", glow: "rgba(220,38,38,1)" },

  // Diamond (5)
  { id: "dia_clear",    name: "Clear Diamond",      rarity: "diamond", price: 220000, color: "#e0f2fe", glow: "rgba(186,230,253,1)" },
  { id: "dia_blue",     name: "Blue Diamond",       rarity: "diamond", price: 260000, color: "#7dd3fc", glow: "rgba(125,211,252,1)" },
  { id: "dia_pink",     name: "Pink Diamond",       rarity: "diamond", price: 300000, color: "#f9a8d4", glow: "rgba(249,168,212,1)" },
  { id: "dia_black",    name: "Black Diamond",      rarity: "diamond", price: 340000, color: "#0f172a", glow: "rgba(148,163,184,1)" },
  { id: "dia_royal",    name: "Royal Diamond",      rarity: "diamond", price: 380000, color: "#a78bfa", glow: "rgba(167,139,250,1)" },

  // Rainbow (5)
  { id: "rainbow",      name: "Rainbow Mirage",     rarity: "rainbow", price: 450000, color: "#ff5dff", glow: "rgba(255,93,255,0.8)", rainbow: true },
  { id: "rain_arc",     name: "Rainbow Arc",        rarity: "rainbow", price: 520000, color: "#ff8fff", glow: "rgba(255,143,255,0.8)", rainbow: true },
  { id: "rain_prism",   name: "Rainbow Prism",      rarity: "rainbow", price: 600000, color: "#bb88ff", glow: "rgba(187,136,255,0.85)", rainbow: true },
  { id: "rain_burst",   name: "Rainbow Burst",      rarity: "rainbow", price: 700000, color: "#88ffea", glow: "rgba(136,255,234,0.85)", rainbow: true },
  { id: "rain_aurora",  name: "Rainbow Aurora",     rarity: "rainbow", price: 800000, color: "#ffdd66", glow: "rgba(255,221,102,0.85)", rainbow: true },

  // Prismatic (5)
  { id: "prism_shard",  name: "Prismatic Shard",    rarity: "prismatic", price: 950000,  color: "#c084fc", glow: "rgba(192,132,252,1)", rainbow: true },
  { id: "prism_core",   name: "Prismatic Core",     rarity: "prismatic", price: 1100000, color: "#f0abfc", glow: "rgba(240,171,252,1)", rainbow: true },
  { id: "prism_wave",   name: "Prismatic Wave",     rarity: "prismatic", price: 1300000, color: "#67e8f9", glow: "rgba(103,232,249,1)", rainbow: true },
  { id: "prism_flare",  name: "Prismatic Flare",    rarity: "prismatic", price: 1500000, color: "#fef08a", glow: "rgba(254,240,138,1)", rainbow: true },
  { id: "prism_storm",  name: "Prismatic Storm",    rarity: "prismatic", price: 1700000, color: "#fca5a5", glow: "rgba(252,165,165,1)", rainbow: true },

  // VIP (4)
  { id: "vip_gold",     name: "VIP Gold",           rarity: "vip", price: 2000000, color: "#fde047", glow: "rgba(253,224,71,1)" },
  { id: "vip_plat",     name: "VIP Platinum",       rarity: "vip", price: 2400000, color: "#e5e7eb", glow: "rgba(229,231,235,1)" },
  { id: "vip_obsidian", name: "VIP Obsidian",       rarity: "vip", price: 2800000, color: "#0b0b12", glow: "rgba(255,213,74,0.9)" },
  { id: "vip_crown",    name: "VIP Crown",          rarity: "vip", price: 3200000, color: "#fbbf24", glow: "rgba(251,191,36,1)" },

  // Nebula (4)
  { id: "neb_drift",    name: "Nebula Drift",       rarity: "nebula", price: 4000000, color: "#818cf8", glow: "rgba(129,140,248,1)", rainbow: true },
  { id: "neb_pulse",    name: "Nebula Pulse",       rarity: "nebula", price: 4800000, color: "#c084fc", glow: "rgba(192,132,252,1)", rainbow: true },
  { id: "neb_storm",    name: "Nebula Storm",       rarity: "nebula", price: 5600000, color: "#f472b6", glow: "rgba(244,114,182,1)", rainbow: true },
  { id: "neb_void",     name: "Nebula Void",        rarity: "nebula", price: 6400000, color: "#1e1b4b", glow: "rgba(124,58,237,1)", rainbow: true },

  // Plantium Plus (3)
  { id: "pp_bloom",     name: "Plantium Bloom",     rarity: "plantiumplus", price: 8000000,  color: "#a3e635", glow: "rgba(163,230,53,1)" },
  { id: "pp_overlord",  name: "Plantium Overlord",  rarity: "plantiumplus", price: 10000000, color: "#ffe066", glow: "rgba(255,224,102,1)" },
  { id: "pp_sovereign", name: "Plantium Sovereign", rarity: "plantiumplus", price: 12000000, color: "#84cc16", glow: "rgba(132,204,22,1)", rainbow: true },

  // Cosmetic (2)
  { id: "cos_halo",     name: "Cosmetic Halo",      rarity: "cosmetic", price: 16000000, color: "#f0abfc", glow: "rgba(240,171,252,1)" },
  { id: "cos_crown",    name: "Cosmetic Crown",     rarity: "cosmetic", price: 20000000, color: "#fbcfe8", glow: "rgba(251,207,232,1)", rainbow: true },

  // Ultra Nova (1)
  { id: "ultranova",    name: "Ultra Nova",         rarity: "ultranova", price: 50000000, color: "#ffffff", glow: "rgba(255,255,255,1)", rainbow: true },
];

type Accessory = { id: string; name: string; color: string; glow: string };
const ACCESSORIES: Accessory[] = [
  { id: "white_hat", name: "White Hat", color: "#ffffff", glow: "rgba(255,255,255,0.85)" },
];

const SHOP_KEY = "scs_shop_v2";
type ShopSave = { shadowCoins: number; owned: string[]; selected: string; accessories: string[]; equippedAccessory: string | null };
const DEFAULT_SHOP: ShopSave = { shadowCoins: 0, owned: ["violet"], selected: "violet", accessories: [], equippedAccessory: null };
function loadShop(): ShopSave {
  if (typeof window === "undefined") return { ...DEFAULT_SHOP };
  try {
    const raw = localStorage.getItem(SHOP_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (v && Array.isArray(v.owned)) return {
        shadowCoins: v.shadowCoins || 0,
        owned: v.owned,
        selected: v.selected || "violet",
        accessories: Array.isArray(v.accessories) ? v.accessories : [],
        equippedAccessory: v.equippedAccessory ?? null,
      };
    }
    // migrate legacy
    const legacy = localStorage.getItem("scs_shop_v1");
    if (legacy) {
      const v = JSON.parse(legacy);
      if (v && Array.isArray(v.owned)) return { shadowCoins: v.shadowCoins||0, owned: v.owned, selected: v.selected||"violet", accessories: [], equippedAccessory: null };
    }
  } catch {}
  return { ...DEFAULT_SHOP };
}
function saveShop(v: ShopSave) { try { localStorage.setItem(SHOP_KEY, JSON.stringify(v)); } catch {} }

type WheelReward = { id: string; label: string; color: string; weight: number; apply: (s: ShopSave) => { next: ShopSave; msg: string } };
const SPIN_COST = 1000;
function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
const WHEEL_REWARDS: WheelReward[] = [
  { id: "c250",  label: "250 ◆",   color: "#9ca3af", weight: 50, apply: (s) => ({ next: { ...s, shadowCoins: s.shadowCoins + 250 }, msg: "+250 Shadow Coins" }) },
  { id: "c500",  label: "500 ◆",   color: "#60a5fa", weight: 25, apply: (s) => ({ next: { ...s, shadowCoins: s.shadowCoins + 500 }, msg: "+500 Shadow Coins" }) },
  { id: "hat",   label: "White Hat", color: "#ffffff", weight: 10, apply: (s) => {
      if (s.accessories.includes("white_hat")) return { next: { ...s, shadowCoins: s.shadowCoins + 500 }, msg: "White Hat (duplicate) → +500 ◆" };
      return { next: { ...s, accessories: [...s.accessories, "white_hat"] }, msg: "Unlocked accessory: White Hat!" };
    } },
  { id: "c1000", label: "1000 ◆",  color: "#a855f7", weight: 5,  apply: (s) => ({ next: { ...s, shadowCoins: s.shadowCoins + 1000 }, msg: "+1000 Shadow Coins" }) },
  { id: "leg",   label: "Legendary Skin", color: "#fde68a", weight: 5, apply: (s) => {
      const pool = SKINS.filter(sk => sk.rarity === "legendary" && !s.owned.includes(sk.id));
      if (pool.length === 0) return { next: { ...s, shadowCoins: s.shadowCoins + 5000 }, msg: "All Legendaries owned → +5000 ◆" };
      const sk = pickRandom(pool);
      return { next: { ...s, owned: [...s.owned, sk.id] }, msg: `Legendary Skin: ${sk.name}!` };
    } },
  { id: "2epic", label: "2 Epic Skins", color: "#ec4899", weight: 4, apply: (s) => {
      const owned = new Set(s.owned);
      const pool = SKINS.filter(sk => sk.rarity === "epic" && !owned.has(sk.id));
      const picks: string[] = [];
      const got: string[] = [];
      let bonus = 0;
      for (let i = 0; i < 2; i++) {
        const avail = pool.filter(p => !picks.includes(p.id));
        if (avail.length === 0) { bonus += 2500; continue; }
        const sk = pickRandom(avail); picks.push(sk.id); got.push(sk.name);
      }
      return { next: { ...s, owned: [...s.owned, ...picks], shadowCoins: s.shadowCoins + bonus }, msg: got.length ? `Epic Skins: ${got.join(", ")}${bonus?` +${bonus} ◆`:""}` : `All Epics owned → +${bonus} ◆` };
    } },
  { id: "rain",  label: "Rainbow Skin", color: "#ff5dff", weight: 0.5, apply: (s) => {
      const pool = SKINS.filter(sk => sk.rarity === "rainbow" && !s.owned.includes(sk.id));
      if (pool.length === 0) return { next: { ...s, shadowCoins: s.shadowCoins + 50000 }, msg: "All Rainbows owned → +50000 ◆" };
      const sk = pickRandom(pool);
      return { next: { ...s, owned: [...s.owned, sk.id] }, msg: `RAINBOW Skin: ${sk.name}!` };
    } },
  { id: "c10000", label: "10000 ◆", color: "#ffe066", weight: 0.5, apply: (s) => ({ next: { ...s, shadowCoins: s.shadowCoins + 10000 }, msg: "JACKPOT! +10000 Shadow Coins" }) },
];
const WHEEL_TOTAL_WEIGHT = WHEEL_REWARDS.reduce((a, r) => a + r.weight, 0);
function rollWheel(): WheelReward {
  let r = Math.random() * WHEEL_TOTAL_WEIGHT;
  for (const w of WHEEL_REWARDS) { if ((r -= w.weight) <= 0) return w; }
  return WHEEL_REWARDS[0];
}
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

  const [shop, setShop] = useState<ShopSave>({ ...DEFAULT_SHOP });
  const [shopOpen, setShopOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelMsg, setWheelMsg] = useState<string | null>(null);
  const [wheelRevealOpen, setWheelRevealOpen] = useState(false);
  const [wheelRevealReward, setWheelRevealReward] = useState<WheelReward | null>(null);
  const wheelTimeoutRef = useRef<number | null>(null);
  const pendingRewardRef = useRef<WheelReward | null>(null);

  const finishSpin = useCallback((reward: WheelReward) => {
    setShop((cur) => {
      const { next, msg } = reward.apply({ ...cur, shadowCoins: cur.shadowCoins });
      setWheelMsg(msg);
      setWheelRevealReward(reward);
      setWheelRevealOpen(true);
      toast.success(msg, { duration: 4000 });
      return next;
    });
    setWheelSpinning(false);
  }, []);

  const spinWheel = useCallback(() => {
    if (wheelSpinning) return;
    setShop((sv) => {
      if (sv.shadowCoins < SPIN_COST) { setWheelMsg(`Need ◆${SPIN_COST - sv.shadowCoins} more`); return sv; }
      const reward = rollWheel();
      const idx = WHEEL_REWARDS.indexOf(reward);
      const slice = 360 / WHEEL_REWARDS.length;
      const target = 360 * 6 + (360 - (idx * slice + slice / 2));
      setWheelSpinning(true);
      setWheelMsg(null);
      setWheelRevealOpen(false);
      setWheelAngle((prev) => prev + target);
      pendingRewardRef.current = reward;
      wheelTimeoutRef.current = window.setTimeout(() => {
        pendingRewardRef.current = null;
        finishSpin(reward);
      }, 4200);
      return { ...sv, shadowCoins: sv.shadowCoins - SPIN_COST };
    });
  }, [wheelSpinning, finishSpin]);

  const skipWheel = useCallback(() => {
    if (wheelTimeoutRef.current) {
      window.clearTimeout(wheelTimeoutRef.current);
      wheelTimeoutRef.current = null;
    }
    const reward = pendingRewardRef.current;
    pendingRewardRef.current = null;
    if (reward) finishSpin(reward);
  }, [finishSpin]);

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
    // new abilities
    kingShadowTime: 0,
    hyperTime: 0,
    tornadoTime: 0,
    darknessTime: 0,
    shadowAttackCd: 0,
    specialClones: [] as SpecialClone[],
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
    s.kingShadowTime = 0; s.hyperTime = 0; s.tornadoTime = 0; s.darknessTime = 0;
    s.shadowAttackCd = 0; s.specialClones = [];
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
    { id: "kingshadows", name: "King of Shadows", desc: "Two orbiting clones shoot electric arrows for 15s", apply: () => {
        const s = stateRef.current;
        const spawn = () => {
          s.kingShadowTime = Math.max(s.kingShadowTime, 15);
          s.specialClones.push({ kind: "electric", angle: 0,         radius: 46, orbitSpeed: 2.2, life: 15, fireCd: 0.2 });
          s.specialClones.push({ kind: "electric", angle: Math.PI,   radius: 46, orbitSpeed: 2.2, life: 15, fireCd: 0.2 });
        };
        spawn();
        return { id: "kingshadows", name: "King of Shadows", undo: () => {}, redo: spawn };
      } },
    { id: "hypersonic", name: "Hypersonic Killer", desc: "+100% attack speed and x2 damage for 12s", apply: () => {
        const s = stateRef.current; s.hyperTime = Math.max(s.hyperTime, 12);
        return { id: "hypersonic", name: "Hypersonic Killer", undo: () => {}, redo: () => { s.hyperTime = Math.max(s.hyperTime, 12); } };
      } },
    { id: "tornado", name: "Quick Tornado", desc: "Tornado pushes enemies & heals 5% HP/s for 10s", apply: () => {
        const s = stateRef.current; s.tornadoTime = Math.max(s.tornadoTime, 10);
        return { id: "tornado", name: "Quick Tornado", undo: () => {}, redo: () => { s.tornadoTime = Math.max(s.tornadoTime, 10); } };
      } },
    { id: "darkness", name: "Aura of Darkness", desc: "Enemies wander; shadows strike them for 15s", apply: () => {
        const s = stateRef.current; s.darknessTime = Math.max(s.darknessTime, 15);
        return { id: "darkness", name: "Aura of Darkness", undo: () => {}, redo: () => { s.darknessTime = Math.max(s.darknessTime, 15); } };
      } },
    { id: "bigclones", name: "CLONES CLOOOONES!!!", desc: "Spawn 3 BIG orbiting clones (+50% damage)", apply: () => {
        const s = stateRef.current;
        const spawn = () => {
          for (let k = 0; k < 3; k++) {
            s.specialClones.push({ kind: "big", angle: (k * Math.PI * 2) / 3, radius: 58, orbitSpeed: 1.4, fireCd: 0.3 });
          }
        };
        spawn();
        return { id: "bigclones", name: "CLONES CLOOOONES!!!", undo: () => {}, redo: spawn };
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
      const fireMul = (s.fireArrowTime > 0 ? 1.5 : 1) * (s.hyperTime > 0 ? 2 : 1);
      const dmg = (from === "player" ? s.stats.bulletDmg * fireMul : s.stats.bulletDmg * 0.45 * s.stats.cloneDmgMult * fireMul);
      const color = s.hyperTime > 0 ? "#ff2e88" : (s.fireArrowTime > 0 ? "#ff7a18" : (from === "player" ? "#ffe066" : "#b388ff"));
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
          s.player.hp -= boss.dmg * (isPP ? 0.8 : 0.6) * (s.shieldTime > 0 ? 0.55 : 1);
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
      if (s.shieldTime > 0) s.shieldTime = Math.max(0, s.shieldTime - dt);
      if (s.speedBoostTime > 0) s.speedBoostTime = Math.max(0, s.speedBoostTime - dt);
      if (s.fireArrowTime > 0) s.fireArrowTime = Math.max(0, s.fireArrowTime - dt);
      if (s.kingShadowTime > 0) s.kingShadowTime = Math.max(0, s.kingShadowTime - dt);
      if (s.hyperTime > 0) s.hyperTime = Math.max(0, s.hyperTime - dt);
      if (s.tornadoTime > 0) s.tornadoTime = Math.max(0, s.tornadoTime - dt);
      if (s.darknessTime > 0) s.darknessTime = Math.max(0, s.darknessTime - dt);
      // age fire trail
      for (const t of s.fireTrail) t.life -= dt;
      s.fireTrail = s.fireTrail.filter(t => t.life > 0);
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
        const speedMul = s.speedBoostTime > 0 ? 6 : 1;
        const prevX = s.player.pos.x, prevY = s.player.pos.y;
        s.player.pos.x += dx * s.stats.moveSpeed * speedMul * dt;
        s.player.pos.y += dy * s.stats.moveSpeed * speedMul * dt;
        if (s.speedBoostTime > 0 && (dx !== 0 || dy !== 0)) {
          s.fireTrail.push({ x: prevX, y: prevY, life: 0.6 });
        }
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
        s.fireCd = 1 / (s.stats.fireRate * (s.hyperTime > 0 ? 2 : 1));
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

      // Helper: nearest live enemy
      const nearestEnemy = (from: Vec): Enemy | null => {
        let best: Enemy | null = null; let bd = Infinity;
        for (const e of s.enemies) {
          if (e.hp <= 0) continue;
          const d = dist(e.pos, from);
          if (d < bd) { bd = d; best = e; }
        }
        return best;
      };

      // Special clones (King of Shadows electric + CLONES CLOOOONES big)
      for (const sc of s.specialClones) {
        sc.angle += sc.orbitSpeed * dt;
        if (sc.life !== undefined) sc.life -= dt;
        sc.fireCd -= dt;
        const sx = s.player.pos.x + Math.cos(sc.angle) * sc.radius;
        const sy = s.player.pos.y + Math.sin(sc.angle) * sc.radius;
        if (sc.fireCd <= 0) {
          const target = nearestEnemy({ x: sx, y: sy });
          if (target) {
            const d = norm({ x: target.pos.x - sx, y: target.pos.y - sy });
            const isElectric = sc.kind === "electric";
            s.bullets.push({
              pos: { x: sx, y: sy },
              vel: { x: d.x * 620, y: d.y * 620 },
              life: 1.2,
              dmg: isElectric ? 42 : s.stats.bulletDmg * 1.5 * s.stats.cloneDmgMult,
              from: "clone",
              color: isElectric ? "#7df9ff" : "#ff66ff",
            });
            sc.fireCd = isElectric ? 0.35 : 0.45;
          }
        }
      }
      s.specialClones = s.specialClones.filter(sc => sc.life === undefined || sc.life > 0);

      // Tornado: push enemies & heal
      if (s.tornadoTime > 0) {
        s.player.hp = Math.min(s.player.maxHp, s.player.hp + s.player.maxHp * 0.05 * dt);
        for (const e of s.enemies) {
          const d = dist(e.pos, s.player.pos);
          if (d < 110 && e.kind !== "boss") {
            const dir = norm({ x: e.pos.x - s.player.pos.x, y: e.pos.y - s.player.pos.y });
            e.pos.x += dir.x * 240 * dt;
            e.pos.y += dir.y * 240 * dt;
          }
        }
      }

      // Darkness: shadow strikes
      if (s.darknessTime > 0) {
        s.shadowAttackCd -= dt;
        if (s.shadowAttackCd <= 0) {
          const target = nearestEnemy(s.player.pos);
          if (target) {
            const d = norm({ x: target.pos.x - s.player.pos.x, y: target.pos.y - s.player.pos.y });
            s.bullets.push({
              pos: { x: s.player.pos.x, y: s.player.pos.y },
              vel: { x: d.x * 560, y: d.y * 560 },
              life: 1.5, dmg: 55, from: "clone", color: "#7c3aed",
            });
            s.shadowAttackCd = 0.22;
          }
        }
      }

      // Spawn waves
      const isBossWave = !!BOSS_WAVES[s.wave];
      if (s.waveActive && !isBossWave && s.spawnQueue > 0 && Math.random() < 0.04 + s.wave * 0.003) {
        spawnGrunt(); s.spawnQueue--;
      }

      // Enemies
      const darkActive = s.darknessTime > 0;
      for (const e of s.enemies) {
        if (!frozen || e.kind === "boss") {
          if (darkActive && e.kind !== "boss") {
            e.randomTimer = (e.randomTimer ?? 0) - dt;
            if (!e.randomDir || (e.randomTimer ?? 0) <= 0) {
              const a = Math.random() * Math.PI * 2;
              e.randomDir = { x: Math.cos(a), y: Math.sin(a) };
              e.randomTimer = 0.5 + Math.random() * 0.7;
            }
            e.pos.x += e.randomDir.x * e.speed * 0.6 * dt;
            e.pos.y += e.randomDir.y * e.speed * 0.6 * dt;
            e.pos.x = Math.max(20, Math.min(W - 20, e.pos.x));
            e.pos.y = Math.max(20, Math.min(H - 20, e.pos.y));
          } else {
            const d = norm({ x: s.player.pos.x - e.pos.x, y: s.player.pos.y - e.pos.y });
            e.pos.x += d.x * e.speed * dt;
            e.pos.y += d.y * e.speed * dt;
          }
        }
        if (e.kind === "boss" && e.abilityCds) runBossAbilities(e, dt);
        if (dist(e.pos, s.player.pos) < e.r + s.player.r) {
          s.player.hp -= e.dmg * dt * (s.shieldTime > 0 ? 0.55 : 1);
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

      // Special clones (electric / big)
      for (const sc of s.specialClones) {
        const sx = s.player.pos.x + Math.cos(sc.angle) * sc.radius;
        const sy = s.player.pos.y + Math.sin(sc.angle) * sc.radius;
        const isElec = sc.kind === "electric";
        const r = isElec ? 11 : 22;
        ctx.fillStyle = isElec ? "rgba(125,249,255,0.45)" : "rgba(255,102,255,0.45)";
        ctx.beginPath(); ctx.arc(sx, sy, r + 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = isElec ? "#7df9ff" : "#ff66ff";
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = isElec ? "#e0fbff" : "#ffd6ff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, r + 2, 0, Math.PI * 2); ctx.stroke();
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

      // Fire trail (super speed)
      for (const t of s.fireTrail) {
        const a = Math.max(0, t.life / 0.6);
        ctx.fillStyle = `rgba(255,${Math.floor(120 + 100 * a)},24,${a * 0.7})`;
        ctx.beginPath(); ctx.arc(t.x, t.y, 10 * a + 3, 0, Math.PI * 2); ctx.fill();
      }

      const p = s.player;
      ctx.fillStyle = "#ffe066";
      ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.r, 0, Math.PI * 2); ctx.fill();
      // Shield ring (bronze defence)
      if (s.shieldTime > 0) {
        ctx.strokeStyle = "rgba(205,127,50,0.9)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.r + 6 + Math.sin(s.time * 6) * 1.5, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(255,200,120,0.4)"; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.r + 9, 0, Math.PI * 2); ctx.stroke();
      }
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
      // Tornado
      if (s.tornadoTime > 0) {
        for (let i = 0; i < 4; i++) {
          const baseA = s.time * 7 + i * (Math.PI / 2);
          const rad = 70 + Math.sin(s.time * 4 + i) * 18;
          ctx.strokeStyle = `rgba(186,230,253,${0.55 - i * 0.1})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, rad, baseA, baseA + Math.PI * 1.3); ctx.stroke();
        }
        ctx.fillStyle = "rgba(125,211,252,0.08)";
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 100, 0, Math.PI * 2); ctx.fill();
      }
      // Darkness aura
      if (s.darknessTime > 0) {
        const grad = ctx.createRadialGradient(p.pos.x, p.pos.y, 20, p.pos.x, p.pos.y, 320);
        grad.addColorStop(0, "rgba(124,58,237,0.0)");
        grad.addColorStop(1, "rgba(10,5,30,0.55)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(124,58,237,0.5)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 180 + Math.sin(s.time * 3) * 6, 0, Math.PI * 2); ctx.stroke();
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
                <button onClick={() => setInventoryOpen(true)} className="px-6 py-3 rounded-lg bg-[#7dd3fc] text-black font-bold hover:scale-105 transition">
                  Inventory
                </button>
              </div>
            </Overlay>
          )}

          {inventoryOpen && (
            <Overlay>
              <div className="w-full max-w-3xl px-4 max-h-full overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-2xl font-black bg-gradient-to-r from-[#7dd3fc] to-[#b388ff] bg-clip-text text-transparent">Inventory</h2>
                  <div className="text-xs text-white/60">{shop.owned.length} skins · {shop.accessories.length} accessories</div>
                </div>

                <div className="mb-5">
                  <div className="text-xs font-black uppercase tracking-widest text-[#7dd3fc] mb-2">Accessories</div>
                  {shop.accessories.length === 0 ? (
                    <div className="text-white/50 text-sm">No accessories yet. Try the Wheel of Fortune in the Shop!</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {ACCESSORIES.filter(a => shop.accessories.includes(a.id)).map(a => {
                        const eq = shop.equippedAccessory === a.id;
                        return (
                          <div key={a.id} className={`p-3 rounded-lg ring-1 ${eq ? "ring-[#ffe066] bg-white/10" : "ring-white/10 bg-white/5"}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 rounded" style={{ background: a.color, boxShadow: `0 0 14px ${a.glow}` }} />
                              <div className="font-bold text-sm">{a.name}</div>
                            </div>
                            <button
                              onClick={() => setShop(v => ({ ...v, equippedAccessory: eq ? null : a.id }))}
                              className="w-full px-2 py-1.5 rounded text-xs font-bold bg-[#ffe066] text-black"
                            >{eq ? "Unequip" : "Equip"}</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {RARITY_ORDER.map((rar) => {
                  const items = SKINS.filter(s => s.rarity === rar && shop.owned.includes(s.id));
                  if (items.length === 0) return null;
                  const meta = RARITY_META[rar];
                  return (
                    <div key={rar} className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-1 flex-1 rounded" style={{ background: `linear-gradient(90deg, ${meta.color}, transparent)` }} />
                        <div className="text-xs font-black uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}</div>
                        <div className="text-[10px] text-white/40">{items.length}</div>
                        <div className="h-1 flex-1 rounded" style={{ background: `linear-gradient(270deg, ${meta.color}, transparent)` }} />
                      </div>
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                        {items.map(sk => {
                          const sel = shop.selected === sk.id;
                          return (
                            <button key={sk.id} onClick={() => setShop(v => ({ ...v, selected: sk.id }))}
                              className={`p-2 rounded-lg ring-1 text-left ${sel ? "ring-[#ffe066] bg-white/10" : "ring-white/10 bg-white/5 hover:bg-white/10"}`}>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full" style={{ background: sk.color, boxShadow: `0 0 10px ${sk.glow ?? sk.color}` }} />
                                <div className="text-[11px] font-bold truncate">{sk.name}</div>
                              </div>
                              {sel && <div className="text-[10px] text-[#ffe066] mt-1">Equipped</div>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-end mt-4">
                  <button onClick={() => setInventoryOpen(false)} className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-bold text-sm">Close</button>
                </div>
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
                {RARITY_ORDER.map((rar) => {
                  const items = SKINS.filter(s => s.rarity === rar);
                  if (items.length === 0) return null;
                  const meta = RARITY_META[rar];
                  return (
                    <div key={rar} className="mb-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-1 flex-1 rounded" style={{ background: `linear-gradient(90deg, ${meta.color}, transparent)` }} />
                        <div className="text-xs font-black uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}</div>
                        <div className="text-[10px] text-white/40">{items.length}</div>
                        <div className="h-1 flex-1 rounded" style={{ background: `linear-gradient(270deg, ${meta.color}, transparent)` }} />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {items.map((sk) => {
                          const owned = shop.owned.includes(sk.id);
                          const selected = shop.selected === sk.id;
                          const canBuy = !owned && shop.shadowCoins >= sk.price;
                          return (
                            <div key={sk.id} className={`p-3 rounded-lg ring-1 ${selected ? "ring-[#ffe066] bg-white/10" : "ring-white/10 bg-white/5"}`} style={{ boxShadow: `inset 0 0 0 1px ${meta.color}22` }}>
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-full" style={{ background: sk.color, boxShadow: `0 0 14px ${sk.glow ?? sk.color}` }} />
                                <div className="font-bold text-sm leading-tight">{sk.name}</div>
                              </div>
                              <div className="text-xs text-white/60 mb-2">{sk.price === 0 ? "Starter" : `◆ ${sk.price.toLocaleString()}`}</div>
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
                                  {canBuy ? "Buy & Equip" : `Need ◆${(sk.price - shop.shadowCoins).toLocaleString()}`}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {/* Wheel of Fortune */}
                <div className="mt-6 p-4 rounded-xl ring-1 ring-[#ffe066]/30 bg-gradient-to-br from-[#1a0f2e] to-[#0b0d1a]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-black bg-gradient-to-r from-[#ffe066] to-[#ff5dff] bg-clip-text text-transparent">Wheel of Fortune</h3>
                      <p className="text-[11px] text-white/50">1 spin = ◆ {SPIN_COST.toLocaleString()}</p>
                    </div>
                    <button
                      onClick={spinWheel}
                      disabled={wheelSpinning || shop.shadowCoins < SPIN_COST}
                      className="px-5 py-2.5 rounded-lg bg-[#ffe066] text-black font-black hover:scale-105 transition disabled:bg-white/10 disabled:text-white/40 disabled:scale-100"
                    >
                      {wheelSpinning ? "Spinning…" : `SPIN (◆${SPIN_COST})`}
                    </button>
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex flex-col items-center" style={{ width: 220 }}>
                      <div className="relative" style={{ width: 220, height: 220 }}>
                        {/* pointer */}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10" style={{ width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "16px solid #ffe066" }} />
                        <div
                          className="rounded-full ring-2 ring-[#ffe066]/60 shadow-2xl"
                          style={{
                            width: 220, height: 220,
                            background: `conic-gradient(${WHEEL_REWARDS.map((r, i) => {
                              const slice = 360 / WHEEL_REWARDS.length;
                              return `${r.color} ${i*slice}deg ${(i+1)*slice}deg`;
                            }).join(",")})`,
                            transform: `rotate(${wheelAngle}deg)`,
                            transition: wheelSpinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.21, 1)" : undefined,
                          }}
                        >
                          {WHEEL_REWARDS.map((r, i) => {
                            const slice = 360 / WHEEL_REWARDS.length;
                            const angle = i * slice + slice / 2;
                            return (
                              <div key={r.id} className="absolute left-1/2 top-1/2 origin-left text-[9px] font-black text-black/80 whitespace-nowrap pointer-events-none"
                                style={{ transform: `rotate(${angle - 90}deg) translateX(20px)` }}>
                                {r.label}
                              </div>
                            );
                          })}
                        </div>
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#0b0d1a] ring-2 ring-[#ffe066]" />
                      </div>
                      {wheelSpinning && (
                        <button
                          onClick={skipWheel}
                          className="mt-3 px-4 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-xs font-bold text-white/80 transition"
                        >
                          Skip ▶▶
                        </button>
                      )}
                    </div>
                    <div className="flex-1 w-full">
                      <div className="text-[11px] text-white/60 mb-2 font-bold uppercase tracking-wider">Rewards & Odds</div>
                      <ul className="text-xs space-y-1">
                        {WHEEL_REWARDS.map(r => (
                          <li key={r.id} className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded" style={{ background: r.color }} />
                            <span className="flex-1">{r.label}</span>
                            <span className="text-white/50">{((r.weight / WHEEL_TOTAL_WEIGHT) * 100).toFixed(r.weight < 1 ? 1 : 0)}%</span>
                          </li>
                        ))}
                      </ul>
                      {wheelMsg && (
                        <div className="mt-3 p-2 rounded bg-[#ffe066]/10 ring-1 ring-[#ffe066]/40 text-[#ffe066] text-sm font-bold text-center">
                          {wheelMsg}
                        </div>
                      )}
                    </div>
                  </div>
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

          {wheelRevealOpen && wheelRevealReward && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-[fade-in_0.3s_ease-out]">
              <div className="relative flex flex-col items-center animate-[scale-in_0.5s_ease-out]">
                <div className="absolute inset-0 -m-10 rounded-full opacity-40 animate-pulse" style={{ background: `radial-gradient(circle, ${wheelRevealReward.color} 0%, transparent 70%)` }} />
                <div className="mb-2 text-sm font-black uppercase tracking-[0.2em] text-white/60">You Won</div>
                <div className="text-4xl md:text-5xl font-black text-center mb-6 px-4" style={{ color: wheelRevealReward.color, textShadow: `0 0 30px ${wheelRevealReward.color}88, 0 0 60px ${wheelRevealReward.color}44` }}>
                  {wheelRevealReward.label}
                </div>
                <div className="flex gap-2 mb-8">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: wheelRevealReward.color, animationDelay: `${i * 0.15}s`, animationDuration: '1.2s' }} />
                  ))}
                </div>
                <button
                  onClick={() => setWheelRevealOpen(false)}
                  className="px-8 py-3 rounded-xl bg-white text-black font-black text-lg hover:scale-105 transition shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                >
                  Claim Reward
                </button>
              </div>
            </div>
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
