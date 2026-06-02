import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { startMusic, stopMusic, playWave50Alarm } from "@/lib/gameMusic";
import { AuthGate, loadProfile, saveProfile } from "@/lib/playerAuth";

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
import upgDragonbreath from "@/assets/upgrades/dragonbreath.png";
import upgBigexplosion from "@/assets/upgrades/bigexplosion.png";
import upgRadiation from "@/assets/upgrades/radiation.png";
import upgBlackhole from "@/assets/upgrades/blackhole.png";
import upgSlowtime from "@/assets/upgrades/slowtime.png";

const UPGRADE_ICONS: Record<string, string> = {
  fire: upgFire, dmg: upgDmg, spd: upgSpd, hp: upgHp, double: upgDouble,
  clone: upgClone, heal: upgHeal, bronze: upgBronze, superspeed: upgSuperspeed,
  firearrows: upgFirearrows, kingshadows: upgKingshadows, hypersonic: upgHypersonic,
  tornado: upgTornado, darkness: upgDarkness, bigclones: upgBigclones,
  dragonbreath: upgDragonbreath, bigexplosion: upgBigexplosion,
  radiation: upgRadiation, blackhole: upgBlackhole, slowtime: upgSlowtime,
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
  component: GameRoute,
});

function GameRoute() {
  return (
    <AuthGate>
      {({ user, signOut, nickname }) => (
        <Game userId={user.id} nickname={nickname} signOut={signOut} />
      )}
    </AuthGate>
  );
}


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
type Rarity = "common"|"rare"|"superrare"|"epic"|"mythical"|"legendary"|"secret"|"ultra"|"diamond"|"rainbow"|"prismatic"|"vip"|"nebula"|"plantiumplus"|"cosmetic"|"ultranova"|"admin";
type Skin = { id: string; name: string; price: number; color: string; glow?: string; rainbow?: boolean; rarity: Rarity };

const RARITY_ORDER: Rarity[] = ["common","rare","superrare","epic","mythical","legendary","secret","ultra","diamond","rainbow","prismatic","vip","nebula","plantiumplus","cosmetic","ultranova","admin"];
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
  admin:        { label: "Admin",         color: "#ff0033" },
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

  // Admin (1) — exclusive
  { id: "admin",        name: "Admin",              rarity: "admin", price: 1000000, color: "#ff0033", glow: "rgba(255,0,51,1)" },
];

type AccessoryRarity = "super_rare" | "epic" | "mythical" | "legendary" | "secret" | "ultra" | "diamond";
type Accessory = { id: string; name: string; color: string; glow: string; rarity?: AccessoryRarity; price?: number };
const ACCESSORIES: Accessory[] = [
  { id: "white_hat",      name: "White Hat",      color: "#ffffff", glow: "rgba(255,255,255,0.85)" },
  { id: "admin_hat",      name: "Admin Hat",      color: "#ff0033", glow: "rgba(255,0,51,1)" },
  { id: "admin_jacket",   name: "Admin Jacket",   color: "#ff0033", glow: "rgba(255,0,51,1)" },

  { id: "bronze_hat",     name: "Bronze Hat",     color: "#cd7f32", glow: "rgba(205,127,50,0.85)" },
  { id: "red_hat",        name: "Red Hat",        color: "#ef4444", glow: "rgba(239,68,68,0.85)",   rarity: "super_rare", price: 25000 },
  { id: "blue_hat",       name: "Blue Hat",       color: "#3b82f6", glow: "rgba(59,130,246,0.85)",  rarity: "super_rare", price: 25000 },
  { id: "gold_hat",       name: "Gold Hat",       color: "#fbbf24", glow: "rgba(251,191,36,0.9)",   rarity: "epic",       price: 100000 },
  { id: "diamond_hat",    name: "Diamond Hat",    color: "#67e8f9", glow: "rgba(103,232,249,0.95)", rarity: "mythical",   price: 500000 },
  { id: "jacket",         name: "Jacket",         color: "#a78bfa", glow: "rgba(167,139,250,0.85)", rarity: "legendary",  price: 1000000 },
  { id: "gold_jacket",    name: "Gold Jacket",    color: "#f59e0b", glow: "rgba(245,158,11,0.95)",  rarity: "legendary",  price: 2500000 },
  { id: "diamond_jacket", name: "Diamond Jacket", color: "#22d3ee", glow: "rgba(34,211,238,1)",     rarity: "secret",     price: 10000000 },
  { id: "crystal_hat",    name: "Crystal Hat",    color: "#e0e7ff", glow: "rgba(224,231,255,1)",    rarity: "ultra",      price: 25000000 },
  { id: "vip_jacket",     name: "VIP Jacket",     color: "#ff5dff", glow: "rgba(255,93,255,1)",     rarity: "diamond",    price: 100000000 },
];
const ACC_RARITY_ORDER: AccessoryRarity[] = ["super_rare", "epic", "mythical", "legendary", "secret", "ultra", "diamond"];
const ACC_RARITY_META: Record<AccessoryRarity, { label: string; color: string }> = {
  super_rare: { label: "Super Rare", color: "#60a5fa" },
  epic:       { label: "Epic",       color: "#a855f7" },
  mythical:   { label: "Mythical",   color: "#ec4899" },
  legendary:  { label: "Legendary",  color: "#fde68a" },
  secret:     { label: "Secret",     color: "#22d3ee" },
  ultra:      { label: "Ultra",      color: "#ffffff" },
  diamond:    { label: "Diamond",    color: "#ff5dff" },
};

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

// ---------- Tasks ----------
type TaskMetric = "kills" | "wavesCleared" | "shadowEarned";
type TaskTemplate = { id: string; metric: TaskMetric; target: number; reward: number; label: string };
const TASK_TEMPLATES: TaskTemplate[] = [
  { id: "kill_50",   metric: "kills",        target: 50,   reward: 150,  label: "Kill 50 enemies" },
  { id: "kill_200",  metric: "kills",        target: 200,  reward: 400,  label: "Kill 200 enemies" },
  { id: "kill_500",  metric: "kills",        target: 500,  reward: 900,  label: "Kill 500 enemies" },
  { id: "clear_5",   metric: "wavesCleared", target: 5,    reward: 200,  label: "Clear 5 waves" },
  { id: "clear_20",  metric: "wavesCleared", target: 20,   reward: 600,  label: "Clear 20 waves" },
  { id: "clear_50",  metric: "wavesCleared", target: 50,   reward: 1500, label: "Clear 50 waves" },
  { id: "shadow_500",  metric: "shadowEarned", target: 500,  reward: 300,  label: "Earn 500 Shadow Coins" },
  { id: "shadow_2000", metric: "shadowEarned", target: 2000, reward: 1000, label: "Earn 2,000 Shadow Coins" },
];
type ActiveTask = { id: string; baseline: number; claimed: boolean };
type LifetimeStats = { kills: number; wavesCleared: number; shadowEarned: number; wins100Streak: number };
const DEFAULT_LIFETIME: LifetimeStats = { kills: 0, wavesCleared: 0, shadowEarned: 0, wins100Streak: 0 };
const LIFETIME_KEY = "scs_lifetime_v1";
const TASKS_KEY = "scs_tasks_v1";
const ELITE_TARGET = 10;
function loadLifetime(): LifetimeStats {
  if (typeof window === "undefined") return { ...DEFAULT_LIFETIME };
  try { const raw = localStorage.getItem(LIFETIME_KEY); if (raw) return { ...DEFAULT_LIFETIME, ...JSON.parse(raw) }; } catch {}
  return { ...DEFAULT_LIFETIME };
}
function saveLifetime(v: LifetimeStats) { try { localStorage.setItem(LIFETIME_KEY, JSON.stringify(v)); } catch {} }
function loadTasks(): ActiveTask[] | null {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(TASKS_KEY); if (raw) return JSON.parse(raw); } catch {}
  return null;
}
function saveTasks(v: ActiveTask[]) { try { localStorage.setItem(TASKS_KEY, JSON.stringify(v)); } catch {} }
function rollTasks(lt: LifetimeStats): ActiveTask[] {
  const shuffled = [...TASK_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, 3);
  return shuffled.map(t => ({ id: t.id, baseline: lt[t.metric], claimed: false }));
}



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
function randomColor() {
  const h = Math.floor(Math.random() * 360);
  const s = 30 + Math.floor(Math.random() * 40);
  const l = 12 + Math.floor(Math.random() * 16);
  return `hsl(${h} ${s}% ${l}%)`;
}

function Game({ userId, nickname, signOut }: { userId: string; nickname: string; signOut: () => Promise<void> }) {
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
    waveWarning: number;
  }>({
    started: false, over: false, won: false,
    wave: 0, score: 0, hp: 100, maxHp: 100,
    xp: 0, xpNext: 5, level: 1,
    coins: 0, time: 0, cloneTimer: CLONE_INTERVAL, clones: 0,
    enemiesLeft: 0, betweenWaves: false, upgrades: [],
    blur: 0, frozen: false, stolen: null, bossName: null,
    shadowCoins: 0,
    waveWarning: 0,
  });

  const [shop, setShop] = useState<ShopSave>({ ...DEFAULT_SHOP });
  const [shopOpen, setShopOpen] = useState(false);
  const [accShopOpen, setAccShopOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [lifetime, setLifetime] = useState<LifetimeStats>(() => loadLifetime());
  const lifetimeRef = useRef(lifetime);
  const [tasks, setTasks] = useState<ActiveTask[]>(() => {
    const lt = typeof window !== "undefined" ? loadLifetime() : DEFAULT_LIFETIME;
    const existing = loadTasks();
    if (existing && existing.length === 3) return existing;
    const fresh = rollTasks(lt);
    if (typeof window !== "undefined") saveTasks(fresh);
    return fresh;
  });
  useEffect(() => { lifetimeRef.current = lifetime; saveLifetime(lifetime); }, [lifetime]);
  useEffect(() => { saveTasks(tasks); }, [tasks]);
  const bumpLifetime = useCallback((patch: Partial<LifetimeStats>) => {
    setLifetime((lt) => {
      const next = { ...lt };
      (Object.keys(patch) as (keyof LifetimeStats)[]).forEach((k) => {
        next[k] = (lt[k] ?? 0) + (patch[k] ?? 0);
      });
      return next;
    });
  }, []);
  const setLifetimeAbs = useCallback((patch: Partial<LifetimeStats>) => {
    setLifetime((lt) => ({ ...lt, ...patch }));
  }, []);
  const rerollTasks = useCallback(() => {
    setTasks(rollTasks(lifetimeRef.current));
  }, []);
  const claimTask = useCallback((taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    const def = TASK_TEMPLATES.find(d => d.id === taskId);
    if (!t || !def || t.claimed) return;
    const progress = (lifetimeRef.current[def.metric] ?? 0) - t.baseline;
    if (progress < def.target) return;
    const cur = shopRef.current;
    const next = { ...cur, shadowCoins: cur.shadowCoins + def.reward };
    shopRef.current = next; setShop(next);
    setTasks(ts => ts.map(x => x.id === taskId ? { ...x, claimed: true } : x));
    toast.success(`Task complete! +${def.reward} Shadow Coins`);
  }, [tasks]);
  const claimElite = useCallback(() => {
    if (lifetimeRef.current.wins100Streak < ELITE_TARGET) return;
    const cur = shopRef.current;
    const ownsSkin = cur.owned.includes("admin");
    const hasHat = cur.accessories.includes("admin_hat");
    const hasJacket = cur.accessories.includes("admin_jacket");
    if (ownsSkin && hasHat && hasJacket) return;
    const accessories = [...cur.accessories];
    if (!hasHat) accessories.push("admin_hat");
    if (!hasJacket) accessories.push("admin_jacket");
    const next: ShopSave = {
      ...cur,
      owned: ownsSkin ? cur.owned : [...cur.owned, "admin"],
      accessories,
      selected: "admin",
      equippedAccessory: "admin_hat",
    };
    shopRef.current = next; setShop(next);
    toast.success("THE Elite Shadow Gamer! Admin skin, Admin Hat & Admin Jacket unlocked!", { duration: 8000 });
  }, []);

  const [wheelAngle, setWheelAngle] = useState(0);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelMsg, setWheelMsg] = useState<string | null>(null);
  const [wheelRevealOpen, setWheelRevealOpen] = useState(false);
  const [wheelRevealReward, setWheelRevealReward] = useState<WheelReward | null>(null);
  const wheelTimeoutRef = useRef<number | null>(null);
  const pendingRewardRef = useRef<WheelReward | null>(null);

  const finishSpin = useCallback((reward: WheelReward) => {
    const cur = shopRef.current;
    const { next, msg } = reward.apply({ ...cur });
    shopRef.current = next;
    setShop(next);
    setWheelMsg(msg);
    setWheelRevealReward(reward);
    setWheelRevealOpen(true);
    toast.success(msg, { duration: 4000 });
    setWheelSpinning(false);
  }, []);

  const spinWheel = useCallback(() => {
    if (wheelSpinning) return;
    const sv = shopRef.current;
    if (sv.shadowCoins < SPIN_COST) { setWheelMsg(`Need ◆${SPIN_COST - sv.shadowCoins} more`); return; }
    const reward = rollWheel();
    const idx = WHEEL_REWARDS.indexOf(reward);
    const slice = 360 / WHEEL_REWARDS.length;
    const target = 360 * 6 + (360 - (idx * slice + slice / 2));
    setWheelSpinning(true);
    setWheelMsg(null);
    setWheelRevealOpen(false);
    setWheelAngle((prev) => prev + target);
    const afterCost = { ...sv, shadowCoins: sv.shadowCoins - SPIN_COST };
    shopRef.current = afterCost;
    setShop(afterCost);
    pendingRewardRef.current = reward;
    wheelTimeoutRef.current = window.setTimeout(() => {
      pendingRewardRef.current = null;
      finishSpin(reward);
    }, 4200);
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
  const saveTimerRef = useRef<number | null>(null);

  // Load from cloud on mount / user change
  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    loadProfile(userId).then((p) => {
      if (cancelled) return;
      if (p) {
        const next: ShopSave = {
          shadowCoins: p.shadow_coins,
          owned: p.owned.length ? p.owned : ["violet"],
          selected: p.selected || "violet",
          accessories: p.accessories,
          equippedAccessory: p.equipped_accessory,
        };
        shopRef.current = next;
        setShop(next);
      } else {
        shopRef.current = { ...DEFAULT_SHOP };
        setShop({ ...DEFAULT_SHOP });
      }
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [userId]);

  // Debounced cloud save on every change
  useEffect(() => {
    shopRef.current = shop;
    if (!hydrated) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveProfile(userId, {
        shadow_coins: shop.shadowCoins,
        owned: shop.owned,
        selected: shop.selected,
        accessories: shop.accessories,
        equipped_accessory: shop.equippedAccessory,
      });
    }, 600);
    return () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); };
  }, [shop, hydrated, userId]);



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
    wonRewardGiven: false,
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
    // new instant/timed abilities
    dragonBreathTime: 0,
    dragonBreathCd: 0,
    radiationWaves: [] as { r: number; maxR: number; hit: WeakSet<Enemy> }[],
    blackholeTime: 0,
    blackholePos: { x: W / 2, y: H / 2 } as Vec,
    slowTime: 0,
    explosionFx: [] as { x: number; y: number; r: number; maxR: number; life: number }[],
    // wave history for revive
    lastWaveEnemyCount: 0,
    bgColor: "#0b0d1a" as string,
    waveWarningTimer: 0,
  });

  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.player = { pos: { x: W / 2, y: H / 2 }, r: 14, hp: 100, maxHp: 100 };
    s.stats = { moveSpeed: 220, fireRate: 4, bulletDmg: 18, bulletSpeed: 520, doubleBullets: false, cloneDmgMult: 1 };
    s.bullets = []; s.enemies = []; s.pickups = []; s.clones = []; s.recording = [];
    s.fireCd = 0; s.cloneFireCd = []; s.spawnQueue = 0; s.waveActive = false; s.bossSpawned = false;
    s.time = 0; s.cloneTimer = CLONE_INTERVAL; s.wave = 0; s.score = 0; s.coins = 0;
    s.xp = 0; s.xpNext = 5; s.level = 1; s.over = false; s.won = false; s.wonRewardGiven = false;
    s.betweenWaves = false; s.pendingUpgrades = null; s.waveCleared = false;
    s.appliedUpgrades = [];
    s.blurTime = 0; s.freezeTime = 0; s.pullTime = 0;
    s.stolenUpgrade = null; s.stolenTimer = 0;
    s.shieldTime = 0; s.speedBoostTime = 0; s.fireArrowTime = 0; s.fireTrail = [];
    s.kingShadowTime = 0; s.hyperTime = 0; s.tornadoTime = 0; s.darknessTime = 0;
    s.shadowAttackCd = 0; s.specialClones = [];
    s.dragonBreathTime = 0; s.dragonBreathCd = 0; s.radiationWaves = [];
    s.blackholeTime = 0; s.blackholePos = { x: W / 2, y: H / 2 }; s.slowTime = 0;
    s.explosionFx = [];
    s.lastWaveEnemyCount = 0;
    s.bgColor = "#0b0d1a";
    s.waveWarningTimer = 0;
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
    // Wave 50+ surge: enemies get +500% HP and +250% damage
    const hardHp = s.wave >= 50 ? 6 : 1;
    const hardDmg = s.wave >= 50 ? 3.5 : 1;
    // Wave 50+ also spawns occasional "mega" enemies that are 5x stronger
    const isMega = s.wave >= 50 && Math.random() < 0.18;
    const megaHp = isMega ? 5 : 1;
    const megaDmg = isMega ? 5 : 1;
    const megaR = isMega ? 1.7 : 1;
    const r = Math.random();
    let e: Enemy;
    if (r < 0.55) {
      const hp = 55 * waveBoost * hardHp * megaHp;
      e = { pos: edgeSpawn(), vel: { x: 0, y: 0 },
        hp, maxHp: hp, r: 14 * megaR, speed: 110 + s.wave * 1.2, baseSpeed: 110 + s.wave * 1.2,
        dmg: (16 + s.wave * 0.4) * hardDmg * megaDmg, baseDmg: (16 + s.wave * 0.4) * hardDmg * megaDmg,
        color: isMega ? "#ff3df0" : "#7cf24a", xp: isMega ? 5 : 1, coin: isMega ? 5 : 1, kind: "grunt" };
    } else if (r < 0.85) {
      const hp = 32 * waveBoost * hardHp * megaHp;
      e = { pos: edgeSpawn(), vel: { x: 0, y: 0 },
        hp, maxHp: hp, r: 10 * megaR, speed: 195 + s.wave * 1.5, baseSpeed: 195 + s.wave * 1.5,
        dmg: (13 + s.wave * 0.3) * hardDmg * megaDmg, baseDmg: (13 + s.wave * 0.3) * hardDmg * megaDmg,
        color: isMega ? "#ff3df0" : "#4ad6ff", xp: isMega ? 10 : 2, coin: isMega ? 5 : 1, kind: "fast" };
    } else {
      const hp = 170 * waveBoost * hardHp * megaHp;
      e = { pos: edgeSpawn(), vel: { x: 0, y: 0 },
        hp, maxHp: hp, r: 20 * megaR, speed: 75 + s.wave * 0.6, baseSpeed: 75 + s.wave * 0.6,
        dmg: (28 + s.wave * 0.6) * hardDmg * megaDmg, baseDmg: (28 + s.wave * 0.6) * hardDmg * megaDmg,
        color: isMega ? "#ff3df0" : "#ff8a3d", xp: isMega ? 15 : 3, coin: isMega ? 15 : 3, kind: "tank" };
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
    // Wave 50+ bosses: +50% HP, +100% damage
    if (s.wave >= 50) { hp = Math.round(hp * 1.5); dmg = Math.round(dmg * 2); }
    s.enemies.push({
      pos: edgeSpawn(), vel: { x: 0, y: 0 },
      hp, maxHp: hp, r, speed: sp, baseSpeed: sp, dmg, baseDmg: dmg,
      color, xp: 120, coin: 80, kind: "boss", bossId: id,
      abilityCds: { pull: 5, freeze: 8, steal: 12, revive: 10, blur: 15, hasten: 20, empower: 25 },
      abilityFlags: {},
    });
    const guardHp = s.wave >= 50 ? 280 * 6 : 280;
    const guardDmg = s.wave >= 50 ? 24 * 3.5 : 24;
    for (let k = 0; k < guards; k++) {
      s.enemies.push({
        pos: edgeSpawn(), vel: { x: 0, y: 0 },
        hp: guardHp, maxHp: guardHp, r: 14, speed: 230, baseSpeed: 230,
        dmg: guardDmg, baseDmg: guardDmg, color: "#ff7ab8", xp: 4, coin: 2, kind: "fast",
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
    if (s.wave === 50) {
      s.waveWarningTimer = 4;
      playWave50Alarm();
    }
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
    { id: "dragonbreath", name: "Dragon Breath", desc: "Spit fire in a cone for 4s", apply: () => {
        const s = stateRef.current;
        const go = () => { s.dragonBreathTime = Math.max(s.dragonBreathTime, 4); s.dragonBreathCd = 0; };
        go();
        return { id: "dragonbreath", name: "Dragon Breath", undo: () => {}, redo: go };
      } },
    { id: "bigexplosion", name: "Big Explosion", desc: "Massive blast: damage & push enemies away", apply: () => {
        const s = stateRef.current;
        const go = () => {
          const cx = s.player.pos.x, cy = s.player.pos.y;
          s.explosionFx.push({ x: cx, y: cy, r: 10, maxR: 280, life: 0.6 });
          for (const e of s.enemies) {
            const d = dist(e.pos, s.player.pos);
            if (d < 280) {
              const isBoss = e.kind === "boss";
              e.hp -= isBoss ? 220 : 600;
              if (!isBoss) {
                const dir = norm({ x: e.pos.x - cx, y: e.pos.y - cy });
                e.pos.x += dir.x * 180;
                e.pos.y += dir.y * 180;
              }
            }
          }
        };
        go();
        return { id: "bigexplosion", name: "Big Explosion", undo: () => {}, redo: go };
      } },
    { id: "radiation", name: "Radiation Waves", desc: "Release 5 expanding waves that damage enemies", apply: () => {
        const s = stateRef.current;
        const go = () => {
          for (let k = 0; k < 5; k++) {
            s.radiationWaves.push({ r: -k * 60, maxR: 380, hit: new WeakSet<Enemy>() });
          }
        };
        go();
        return { id: "radiation", name: "Radiation Waves", undo: () => {}, redo: go };
      } },
    { id: "blackhole", name: "Blackhole", desc: "Spawn a blackhole that pulls enemies to the center for 6s", apply: () => {
        const s = stateRef.current;
        const go = () => { s.blackholePos = { x: W / 2, y: H / 2 }; s.blackholeTime = Math.max(s.blackholeTime, 6); };
        go();
        return { id: "blackhole", name: "Blackhole", undo: () => {}, redo: go };
      } },
    { id: "slowtime", name: "Slowed-Down Time", desc: "Enemies move 45% slower for 8s", apply: () => {
        const s = stateRef.current;
        const go = () => { s.slowTime = Math.max(s.slowTime, 8); };
        go();
        return { id: "slowtime", name: "Slowed-Down Time", undo: () => {}, redo: go };
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

  const [musicOn, setMusicOn] = useState(true);
  const musicOnRef = useRef(true);
  useEffect(() => { musicOnRef.current = musicOn; }, [musicOn]);
  useEffect(() => () => { stopMusic(); }, []);

  const toggleMusic = () => {
    setMusicOn((on) => {
      const next = !on;
      if (next) startMusic(); else stopMusic();
      return next;
    });
  };

  const startGame = () => {
    resetGame();
    setUiState((u) => ({ ...u, started: true, over: false, won: false, blur: 0, frozen: false, stolen: null, bossName: null }));
    if (musicOnRef.current) startMusic();
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
      if (s.dragonBreathTime > 0) s.dragonBreathTime = Math.max(0, s.dragonBreathTime - dt);
      if (s.waveWarningTimer > 0) s.waveWarningTimer = Math.max(0, s.waveWarningTimer - dt);
      if (s.blackholeTime > 0) s.blackholeTime = Math.max(0, s.blackholeTime - dt);
      if (s.slowTime > 0) s.slowTime = Math.max(0, s.slowTime - dt);
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

      // Dragon Breath: cone of fire bullets toward aim
      if (s.dragonBreathTime > 0) {
        s.dragonBreathCd -= dt;
        if (s.dragonBreathCd <= 0) {
          const ang = Math.atan2(s.input.aim.y - s.player.pos.y, s.input.aim.x - s.player.pos.x);
          for (let k = 0; k < 3; k++) {
            const spread = (Math.random() - 0.5) * 0.7;
            const a = ang + spread;
            s.bullets.push({
              pos: { x: s.player.pos.x, y: s.player.pos.y },
              vel: { x: Math.cos(a) * 480, y: Math.sin(a) * 480 },
              life: 0.55, dmg: s.stats.bulletDmg * 0.9, from: "player", color: "#ff7a18",
            });
          }
          s.dragonBreathCd = 0.05;
        }
      }

      // Radiation waves: expand, damage each enemy once
      if (s.radiationWaves.length > 0) {
        for (const w of s.radiationWaves) {
          const prev = w.r;
          w.r += 280 * dt;
          if (prev < 0) continue;
          for (const e of s.enemies) {
            if (e.hp <= 0 || w.hit.has(e)) continue;
            const d = dist(e.pos, s.player.pos);
            if (d <= w.r && d >= w.r - 40) {
              e.hp -= e.kind === "boss" ? 60 : 120;
              w.hit.add(e);
            }
          }
        }
        s.radiationWaves = s.radiationWaves.filter(w => w.r < w.maxR);
      }

      // Blackhole: pull enemies, small damage
      if (s.blackholeTime > 0) {
        const bp = s.blackholePos;
        for (const e of s.enemies) {
          const d = dist(e.pos, bp);
          if (d > 4) {
            const dir = norm({ x: bp.x - e.pos.x, y: bp.y - e.pos.y });
            const pull = e.kind === "boss" ? 80 : 260;
            e.pos.x += dir.x * pull * dt;
            e.pos.y += dir.y * pull * dt;
          }
          if (d < 30) e.hp -= (e.kind === "boss" ? 30 : 80) * dt;
        }
      }

      // Explosion FX decay
      if (s.explosionFx.length > 0) {
        for (const fx of s.explosionFx) {
          fx.life -= dt;
          fx.r += (fx.maxR - fx.r) * Math.min(1, dt * 4);
        }
        s.explosionFx = s.explosionFx.filter(f => f.life > 0);
      }

      // Spawn waves
      const isBossWave = !!BOSS_WAVES[s.wave];
      if (s.waveActive && !isBossWave && s.spawnQueue > 0 && Math.random() < 0.04 + s.wave * 0.003) {
        spawnGrunt(); s.spawnQueue--;
      }

      // Enemies
      const darkActive = s.darknessTime > 0;
      const slowMul = s.slowTime > 0 ? 0.55 : 1;
      for (const e of s.enemies) {
        if (!frozen || e.kind === "boss") {
          if (darkActive && e.kind !== "boss") {
            e.randomTimer = (e.randomTimer ?? 0) - dt;
            if (!e.randomDir || (e.randomTimer ?? 0) <= 0) {
              const a = Math.random() * Math.PI * 2;
              e.randomDir = { x: Math.cos(a), y: Math.sin(a) };
              e.randomTimer = 0.5 + Math.random() * 0.7;
            }
            e.pos.x += e.randomDir.x * e.speed * 0.6 * slowMul * dt;
            e.pos.y += e.randomDir.y * e.speed * 0.6 * slowMul * dt;
            e.pos.x = Math.max(20, Math.min(W - 20, e.pos.x));
            e.pos.y = Math.max(20, Math.min(H - 20, e.pos.y));
          } else {
            const d = norm({ x: s.player.pos.x - e.pos.x, y: s.player.pos.y - e.pos.y });
            e.pos.x += d.x * e.speed * slowMul * dt;
            e.pos.y += d.y * e.speed * slowMul * dt;
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
      let killsThisFrame = 0;
      for (const e of s.enemies) {
        if (e.hp <= 0) {
          killsThisFrame++;
          s.score += Math.round(e.maxHp);
          for (let k = 0; k < e.xp; k++) s.pickups.push({ pos: { x: e.pos.x + rand(-6, 6), y: e.pos.y + rand(-6, 6) }, kind: "xp", value: 1 });
          for (let k = 0; k < e.coin; k++) s.pickups.push({ pos: { x: e.pos.x + rand(-6, 6), y: e.pos.y + rand(-6, 6) }, kind: "coin", value: 1 });
          // Shadow Coins: ~8% drop from normal enemies, guaranteed big drop from bosses
          const shadowDrop = e.kind === "boss" ? 25 + Math.floor(e.maxHp / 4000) : (Math.random() < 0.08 ? 1 : 0);
          for (let k = 0; k < shadowDrop; k++) s.pickups.push({ pos: { x: e.pos.x + rand(-10, 10), y: e.pos.y + rand(-10, 10) }, kind: "shadow", value: 1 });
        } else survivors.push(e);
      }
      s.enemies = survivors;
      if (killsThisFrame > 0) bumpLifetime({ kills: killsThisFrame });


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
            if (!s.wonRewardGiven) {
              s.wonRewardGiven = true;
              const cur = shopRef.current;
              const hadHat = cur.accessories.includes("bronze_hat");
              const next: ShopSave = {
                ...cur,
                shadowCoins: cur.shadowCoins + 500,
                accessories: hadHat ? cur.accessories : [...cur.accessories, "bronze_hat"],
              };
              shopRef.current = next;
              setShop(next);
              toast.success("Wave 100 Complete! +500 Shadow Coins", { duration: 5000 });
              if (!hadHat) {
                toast.success("Reward Unlocked: Bronze Hat!", { duration: 5000 });
              }
            }
          } else {
            // restore stolen on wave clear
            if (s.stolenUpgrade) { s.stolenUpgrade.redo(); s.stolenUpgrade = null; }
            s.betweenWaves = true;
            s.pendingUpgrades = rollUpgrades();
            s.bgColor = randomColor();
          }
        }
      }
    };

    const draw = () => {
      const s = stateRef.current;
      ctx.fillStyle = s.bgColor;
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
      const equippedAcc = shopRef.current.equippedAccessory
        ? ACCESSORIES.find(a => a.id === shopRef.current.equippedAccessory) ?? null
        : null;
      const isHat = equippedAcc && /hat/.test(equippedAcc.id);
      const isJacket = equippedAcc && /jacket/.test(equippedAcc.id);

      // mix skin color into a darker silhouette body tone
      const hexToRgb = (h: string) => {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
        if (!m) return { r: 60, g: 80, b: 140 };
        return { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) };
      };
      const sc = skinColor.startsWith("#") ? hexToRgb(skinColor) : { r: 80, g: 120, b: 200 };
      const bodyFill = `rgba(${Math.floor(sc.r*0.45)},${Math.floor(sc.g*0.45)},${Math.floor(sc.b*0.55)},0.92)`;
      const headFill = `rgba(${Math.floor(sc.r*0.3)},${Math.floor(sc.g*0.3)},${Math.floor(sc.b*0.4)},0.95)`;

      for (const cl of s.clones) {
        if (cl.healer) {
          const px = s.player.pos.x, py = s.player.pos.y - 26;
          ctx.fillStyle = "rgba(124,242,74,0.65)";
          ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
          ctx.fillText("+", px, py + 4);
        } else {
          const f = cl.frames[cl.idx]; if (!f) continue;
          const cang = Math.atan2(f.aim.y - f.pos.y, f.aim.x - f.pos.x);
          // Kind shadow tinted with the equipped skin color
          ctx.fillStyle = skinGlow;
          ctx.beginPath(); ctx.ellipse(f.pos.x, f.pos.y + 4, 14, 16, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = bodyFill;
          ctx.beginPath(); ctx.ellipse(f.pos.x, f.pos.y + 2, 10, 13, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = headFill;
          ctx.beginPath(); ctx.arc(f.pos.x, f.pos.y - 8, 6, 0, Math.PI * 2); ctx.fill();
          // friendly eyes glow with skin color
          ctx.fillStyle = skinColor;
          ctx.beginPath(); ctx.arc(f.pos.x - 2.2, f.pos.y - 9, 1.4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(f.pos.x + 2.2, f.pos.y - 9, 1.4, 0, Math.PI * 2); ctx.fill();
          // accessory mini-render
          if (isHat && equippedAcc) {
            ctx.fillStyle = equippedAcc.color;
            ctx.beginPath(); ctx.ellipse(f.pos.x, f.pos.y - 13.5, 7, 2.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(f.pos.x - 4, f.pos.y - 17, 8, 4);
          }
          if (isJacket && equippedAcc) {
            ctx.fillStyle = equippedAcc.color;
            ctx.globalAlpha = 0.85;
            ctx.beginPath(); ctx.ellipse(f.pos.x, f.pos.y + 2, 10, 13, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.strokeStyle = skinColor; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(f.pos.x, f.pos.y);
          ctx.lineTo(f.pos.x + Math.cos(cang) * 18, f.pos.y + Math.sin(cang) * 18); ctx.stroke();
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
        const er = e.r;
        const isBossE = e.kind === "boss";
        if (isBossE) {
          // BOSS: huge pulsing aura, demonic body, horns, glowing crown, rune ring
          const t = performance.now() / 1000;
          const pulse = 1 + Math.sin(t * 3) * 0.08;
          // rotating rune ring
          ctx.save();
          ctx.translate(e.pos.x, e.pos.y);
          ctx.rotate(t * 0.6);
          ctx.strokeStyle = e.color + "cc"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, (er + 14) * pulse, 0, Math.PI * 2); ctx.stroke();
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const rx = Math.cos(a) * (er + 14) * pulse;
            const ry = Math.sin(a) * (er + 14) * pulse;
            ctx.fillStyle = e.color;
            ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
          // outer glow aura
          const grad = ctx.createRadialGradient(e.pos.x, e.pos.y, er * 0.4, e.pos.x, e.pos.y, er * 2.2);
          grad.addColorStop(0, e.color + "88");
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y, er * 2.2, 0, Math.PI * 2); ctx.fill();
          // body — dark with colored core
          ctx.fillStyle = "rgba(5,0,10,1)";
          ctx.beginPath(); ctx.ellipse(e.pos.x, e.pos.y + er * 0.1, er * 1.15, er * 1.25, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = e.color + "66";
          ctx.beginPath(); ctx.ellipse(e.pos.x, e.pos.y + er * 0.1, er * 1.1, er * 1.2, 0, 0, Math.PI * 2); ctx.fill();
          // spiked shoulders
          ctx.fillStyle = "rgba(0,0,0,0.95)";
          for (let i = -1; i <= 1; i += 2) {
            ctx.beginPath();
            ctx.moveTo(e.pos.x + i * er * 0.9, e.pos.y - er * 0.2);
            ctx.lineTo(e.pos.x + i * er * 1.4, e.pos.y - er * 0.8);
            ctx.lineTo(e.pos.x + i * er * 0.6, e.pos.y - er * 0.3);
            ctx.closePath(); ctx.fill();
          }
          // head
          ctx.fillStyle = "rgba(5,0,10,1)";
          ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y - er * 0.7, er * 0.65, 0, Math.PI * 2); ctx.fill();
          // horns
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.moveTo(e.pos.x - er * 0.45, e.pos.y - er * 1.0);
          ctx.lineTo(e.pos.x - er * 0.85, e.pos.y - er * 1.6);
          ctx.lineTo(e.pos.x - er * 0.25, e.pos.y - er * 1.1);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(e.pos.x + er * 0.45, e.pos.y - er * 1.0);
          ctx.lineTo(e.pos.x + er * 0.85, e.pos.y - er * 1.6);
          ctx.lineTo(e.pos.x + er * 0.25, e.pos.y - er * 1.1);
          ctx.closePath(); ctx.fill();
          // crown gems
          ctx.fillStyle = "#ffd84a";
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath(); ctx.arc(e.pos.x + i * er * 0.25, e.pos.y - er * 1.05, er * 0.1, 0, Math.PI * 2); ctx.fill();
          }
          // glowing eyes
          const eyeYb = e.pos.y - er * 0.75;
          ctx.shadowColor = e.color; ctx.shadowBlur = 12;
          ctx.fillStyle = "#fff200";
          ctx.beginPath(); ctx.arc(e.pos.x - er * 0.22, eyeYb, er * 0.14, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(e.pos.x + er * 0.22, eyeYb, er * 0.14, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          // fanged mouth
          ctx.strokeStyle = "#ff2a2a"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(e.pos.x - er * 0.25, e.pos.y - er * 0.45); ctx.lineTo(e.pos.x + er * 0.25, e.pos.y - er * 0.45); ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.moveTo(e.pos.x - er * 0.12, e.pos.y - er * 0.45); ctx.lineTo(e.pos.x - er * 0.05, e.pos.y - er * 0.3); ctx.lineTo(e.pos.x - er * 0.2, e.pos.y - er * 0.4); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(e.pos.x + er * 0.12, e.pos.y - er * 0.45); ctx.lineTo(e.pos.x + er * 0.05, e.pos.y - er * 0.3); ctx.lineTo(e.pos.x + er * 0.2, e.pos.y - er * 0.4); ctx.closePath(); ctx.fill();
        } else {
          // Evil shadow: dark wispy aura + black body + glowing red eyes
          ctx.fillStyle = "rgba(120,0,0,0.35)";
          ctx.beginPath(); ctx.ellipse(e.pos.x, e.pos.y + er * 0.2, er + 4, er + 6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(10,5,15,0.95)";
          ctx.beginPath(); ctx.ellipse(e.pos.x, e.pos.y + er * 0.15, er, er + 2, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(5,0,10,1)";
          ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y - er * 0.55, er * 0.55, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.9)"; ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = -2; i <= 2; i++) {
            const sx = e.pos.x + i * (er * 0.22);
            ctx.moveTo(sx, e.pos.y - er * 0.9);
            ctx.lineTo(sx + er * 0.1, e.pos.y - er * 1.15);
          }
          ctx.stroke();
          const eyeY = e.pos.y - er * 0.6;
          ctx.fillStyle = "#ff2a2a";
          ctx.beginPath(); ctx.arc(e.pos.x - er * 0.18, eyeY, Math.max(1.4, er * 0.11), 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(e.pos.x + er * 0.18, eyeY, Math.max(1.4, er * 0.11), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(255,120,120,0.45)";
          ctx.beginPath(); ctx.arc(e.pos.x - er * 0.18, eyeY, er * 0.22, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(e.pos.x + er * 0.18, eyeY, er * 0.22, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = e.color + "33";
          ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y, er, 0, Math.PI * 2); ctx.fill();
        }
        const w = er * 2;
        const barY = e.pos.y - er - (isBossE ? 18 : 8);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(e.pos.x - w / 2, barY, w, 4);
        ctx.fillStyle = isBossE ? "#ffd84a" : "#ff5d5d";
        ctx.fillRect(e.pos.x - w / 2, barY, w * (e.hp / e.maxHp), 4);
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
      const pang = Math.atan2(s.input.aim.y - p.pos.y, s.input.aim.x - p.pos.x);
      // Person: shadow on ground, legs, torso, arms, head
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.ellipse(p.pos.x, p.pos.y + p.r + 2, p.r * 0.9, p.r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      // legs
      ctx.strokeStyle = "#3a5a8a"; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.pos.x - 3, p.pos.y + 2); ctx.lineTo(p.pos.x - 3, p.pos.y + p.r + 2);
      ctx.moveTo(p.pos.x + 3, p.pos.y + 2); ctx.lineTo(p.pos.x + 3, p.pos.y + p.r + 2);
      ctx.stroke();
      // torso (shirt) — replaced by jacket color if equipped
      ctx.fillStyle = isJacket && equippedAcc ? equippedAcc.color : "#2e7dd9";
      ctx.beginPath(); ctx.ellipse(p.pos.x, p.pos.y, p.r * 0.85, p.r * 0.95, 0, 0, Math.PI * 2); ctx.fill();
      if (isJacket && equippedAcc) {
        // collar / lapel highlights
        ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.pos.x - p.r * 0.55, p.pos.y - p.r * 0.5);
        ctx.lineTo(p.pos.x, p.pos.y - p.r * 0.1);
        ctx.lineTo(p.pos.x + p.r * 0.55, p.pos.y - p.r * 0.5);
        ctx.stroke();
        // soft glow
        ctx.shadowColor = equippedAcc.glow; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.ellipse(p.pos.x, p.pos.y, p.r * 0.85, p.r * 0.95, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // arms toward aim
      ctx.strokeStyle = "#f1c27d"; ctx.lineWidth = 3.5;
      const ax = p.pos.x + Math.cos(pang) * 6, ay = p.pos.y + Math.sin(pang) * 6;
      ctx.beginPath();
      ctx.moveTo(p.pos.x - Math.sin(pang) * 6, p.pos.y + Math.cos(pang) * 6);
      ctx.lineTo(ax + Math.cos(pang) * 8, ay + Math.sin(pang) * 8);
      ctx.stroke();
      // head (skin)
      ctx.fillStyle = "#f1c27d";
      ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y - p.r * 0.75, p.r * 0.55, 0, Math.PI * 2); ctx.fill();
      // hair (hidden under hat)
      if (!isHat) {
        ctx.fillStyle = "#2a1d10";
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y - p.r * 0.95, p.r * 0.55, Math.PI, 0); ctx.fill();
      }
      // eyes
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath(); ctx.arc(p.pos.x - 2.2, p.pos.y - p.r * 0.75, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.pos.x + 2.2, p.pos.y - p.r * 0.75, 1.2, 0, Math.PI * 2); ctx.fill();
      // hat on top of head
      if (isHat && equippedAcc) {
        const hx = p.pos.x, hy = p.pos.y - p.r * 0.95;
        ctx.shadowColor = equippedAcc.glow; ctx.shadowBlur = 12;
        // brim
        ctx.fillStyle = equippedAcc.color;
        ctx.beginPath(); ctx.ellipse(hx, hy + 1, p.r * 0.85, p.r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        // crown
        ctx.fillRect(hx - p.r * 0.45, hy - p.r * 0.55, p.r * 0.9, p.r * 0.55);
        // top dome
        ctx.beginPath(); ctx.ellipse(hx, hy - p.r * 0.55, p.r * 0.45, p.r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // shine
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillRect(hx - p.r * 0.35, hy - p.r * 0.45, p.r * 0.18, p.r * 0.4);
      }
      // gun / aim line
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.pos.x, p.pos.y);
      ctx.lineTo(p.pos.x + Math.cos(pang) * 22, p.pos.y + Math.sin(pang) * 22); ctx.stroke();

      // Shield ring (bronze defence)
      if (s.shieldTime > 0) {
        ctx.strokeStyle = "rgba(205,127,50,0.9)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.r + 6 + Math.sin(s.time * 6) * 1.5, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(255,200,120,0.4)"; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.r + 9, 0, Math.PI * 2); ctx.stroke();
      }

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
      // Slow time tint
      if (s.slowTime > 0) {
        ctx.fillStyle = "rgba(96,165,250,0.10)";
        ctx.fillRect(0, 0, W, H);
      }
      // Radiation waves
      for (const w of s.radiationWaves) {
        if (w.r <= 0) continue;
        const a = Math.max(0, 1 - w.r / w.maxR);
        ctx.strokeStyle = `rgba(74,222,128,${0.7 * a})`;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, w.r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(190,242,100,${0.4 * a})`;
        ctx.lineWidth = 2;
        if (w.r > 18) { ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, w.r - 18, 0, Math.PI * 2); ctx.stroke(); }
      }
      // Explosion FX
      for (const fx of s.explosionFx) {
        const a = Math.max(0, fx.life / 0.6);
        const grad = ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, fx.r);
        grad.addColorStop(0, `rgba(255,240,120,${0.85 * a})`);
        grad.addColorStop(0.5, `rgba(255,140,40,${0.55 * a})`);
        grad.addColorStop(1, "rgba(255,80,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(255,200,80,${a})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2); ctx.stroke();
      }
      // Blackhole
      if (s.blackholeTime > 0) {
        const bp = s.blackholePos;
        const baseR = 36 + Math.sin(s.time * 6) * 3;
        for (let i = 0; i < 4; i++) {
          ctx.strokeStyle = `rgba(168,85,247,${0.35 - i * 0.07})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(bp.x, bp.y, baseR + 18 + i * 14, s.time * 2 + i, s.time * 2 + i + Math.PI * 1.5);
          ctx.stroke();
        }
        const grad = ctx.createRadialGradient(bp.x, bp.y, 2, bp.x, bp.y, baseR);
        grad.addColorStop(0, "rgba(0,0,0,1)");
        grad.addColorStop(0.7, "rgba(40,0,60,0.95)");
        grad.addColorStop(1, "rgba(168,85,247,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(bp.x, bp.y, baseR, 0, Math.PI * 2); ctx.fill();
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
          waveWarning: s.waveWarningTimer,
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
      <div className="w-full max-w-[960px] flex items-center justify-end gap-3 text-xs">
        <span className="text-white/70">
          Player: <span className="font-bold text-white">{nickname || "…"}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Log out? Your progress is saved to your account.")) {
              signOut();
            }
          }}
          className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition"
        >
          Log out
        </button>

      </div>
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
                <button
                  onClick={toggleMusic}
                  className="px-6 py-3 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20 transition border border-white/20"
                  title="Toggle background music"
                >
                  {musicOn ? "♪ Music: On" : "♪ Music: Off"}
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

                <div className="flex justify-between items-center mt-4 gap-2">
                  <button
                    onClick={() => { setShopOpen(false); setAccShopOpen(true); }}
                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#7dd3fc] to-[#ff5dff] text-black font-black text-sm hover:scale-105 transition"
                  >
                    🎩 Accessories
                  </button>
                  <button onClick={() => setShopOpen(false)} className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-bold text-sm">Close</button>
                </div>
              </div>
            </Overlay>
          )}

          {accShopOpen && (
            <Overlay>
              <div className="w-full max-w-3xl px-4 max-h-full overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-2xl font-black bg-gradient-to-r from-[#7dd3fc] to-[#ff5dff] bg-clip-text text-transparent">Accessory Shop</h2>
                  <div className="text-sm font-mono">Shadow Coins: <span className="text-[#b388ff] font-bold">◆ {shop.shadowCoins}</span></div>
                </div>
                <p className="text-white/60 text-xs mb-3">Equip accessories on top of your skins. Only one accessory can be equipped at a time.</p>
                {ACC_RARITY_ORDER.map((rar) => {
                  const items = ACCESSORIES.filter(a => a.rarity === rar);
                  if (items.length === 0) return null;
                  const meta = ACC_RARITY_META[rar];
                  return (
                    <div key={rar} className="mb-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-1 flex-1 rounded" style={{ background: `linear-gradient(90deg, ${meta.color}, transparent)` }} />
                        <div className="text-xs font-black uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}</div>
                        <div className="text-[10px] text-white/40">{items.length}</div>
                        <div className="h-1 flex-1 rounded" style={{ background: `linear-gradient(270deg, ${meta.color}, transparent)` }} />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {items.map((a) => {
                          const owned = shop.accessories.includes(a.id);
                          const equipped = shop.equippedAccessory === a.id;
                          const price = a.price ?? 0;
                          const canBuy = !owned && shop.shadowCoins >= price;
                          return (
                            <div key={a.id} className={`p-3 rounded-lg ring-1 ${equipped ? "ring-[#ffe066] bg-white/10" : "ring-white/10 bg-white/5"}`} style={{ boxShadow: `inset 0 0 0 1px ${meta.color}22` }}>
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-full" style={{ background: a.color, boxShadow: `0 0 14px ${a.glow}` }} />
                                <div className="font-bold text-sm leading-tight">{a.name}</div>
                              </div>
                              <div className="text-xs text-white/60 mb-2">◆ {price.toLocaleString()}</div>
                              {owned ? (
                                <button
                                  onClick={() => setShop((v) => ({ ...v, equippedAccessory: equipped ? null : a.id }))}
                                  className="w-full px-2 py-1.5 rounded text-xs font-bold bg-[#ffe066] text-black"
                                >
                                  {equipped ? "Unequip" : "Equip"}
                                </button>
                              ) : (
                                <button
                                  disabled={!canBuy}
                                  onClick={() => setShop((v) => ({ ...v, shadowCoins: v.shadowCoins - price, accessories: [...v.accessories, a.id], equippedAccessory: a.id }))}
                                  className="w-full px-2 py-1.5 rounded text-xs font-bold bg-[#b388ff] text-black disabled:bg-white/10 disabled:text-white/40"
                                >
                                  {canBuy ? "Buy & Equip" : `Need ◆${(price - shop.shadowCoins).toLocaleString()}`}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center mt-4 gap-2">
                  <button
                    onClick={() => { setAccShopOpen(false); setShopOpen(true); }}
                    className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-bold text-sm"
                  >
                    ← Back to Shop
                  </button>
                  <button onClick={() => setAccShopOpen(false)} className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-bold text-sm">Close</button>
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
                    className="p-4 rounded-lg bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-[#ffe066] text-left transition flex gap-3 items-start"
                  >
                    {UPGRADE_ICONS[u.id] && (
                      <img src={UPGRADE_ICONS[u.id]} alt={u.name} loading="lazy" width={56} height={56} className="w-14 h-14 object-contain shrink-0 drop-shadow-[0_0_8px_rgba(255,224,102,0.35)]" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-[#ffe066]">{u.name}</div>
                      <div className="text-sm text-white/70 mt-1">{u.desc}</div>
                    </div>
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
              <div className="flex flex-col items-center gap-1 mb-5">
                <div className="text-lg font-bold text-[#cd7f32] drop-shadow-[0_0_12px_rgba(205,127,50,0.6)]">+500 Shadow Coins</div>
                <div className="text-lg font-bold text-[#cd7f32] drop-shadow-[0_0_12px_rgba(205,127,50,0.6)]">Bronze Hat Unlocked!</div>
              </div>
              <button onClick={startGame} className="px-6 py-3 rounded-lg bg-[#ffe066] text-black font-bold hover:scale-105 transition">
                Play Again
              </button>
            </Overlay>
          )}

          {uiState.waveWarning > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
              <div className="text-center animate-pulse">
                <div className="text-5xl md:text-7xl font-black text-[#ff2e2e] drop-shadow-[0_0_30px_rgba(255,46,46,0.8)] mb-2">
                  WAVE 50
                </div>
                <div className="text-xl md:text-3xl font-black text-[#ff5d5d] drop-shadow-[0_0_20px_rgba(255,93,93,0.7)] mb-1">
                  WARNING
                </div>
                <div className="text-sm md:text-lg font-bold text-white/90 tracking-widest uppercase">
                  Enemies Powered Up
                </div>
              </div>
            </div>
          )}

          {wheelRevealOpen && wheelRevealReward && (
            <div
              className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-[fade-in_0.3s_ease-out]"
              onClick={() => setWheelRevealOpen(false)}
            >
              <div className="relative flex flex-col items-center animate-[scale-in_0.5s_ease-out]" onClick={(e) => e.stopPropagation()}>
                <div className="absolute inset-0 -m-10 rounded-full opacity-40 animate-pulse pointer-events-none" style={{ background: `radial-gradient(circle, ${wheelRevealReward.color} 0%, transparent 70%)` }} />
                <div className="mb-2 text-sm font-black uppercase tracking-[0.2em] text-white/60">You Won</div>
                <div className="text-4xl md:text-5xl font-black text-center mb-6 px-4" style={{ color: wheelRevealReward.color, textShadow: `0 0 30px ${wheelRevealReward.color}88, 0 0 60px ${wheelRevealReward.color}44` }}>
                  {wheelRevealReward.label}
                </div>
                <div className="flex gap-2 mb-8 pointer-events-none">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: wheelRevealReward.color, animationDelay: `${i * 0.15}s`, animationDuration: '1.2s' }} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setWheelRevealOpen(false); }}
                  className="relative z-10 px-8 py-3 rounded-xl bg-white text-black font-black text-lg hover:scale-105 transition shadow-[0_0_30px_rgba(255,255,255,0.3)] cursor-pointer"
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
