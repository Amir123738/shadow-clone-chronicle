import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Store, Backpack, ScrollText, Map as MapIcon, Settings as SettingsIcon, Play } from "lucide-react";
import { startMusic, stopMusic, playWave50Alarm, playWave75Alarm } from "@/lib/gameMusic";
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
type Bullet = { pos: Vec; vel: Vec; life: number; dmg: number; from: "player" | "clone" | "boss"; color: string; r?: number };
type BossId = "super" | "mega" | "hyper" | "plantium" | "final" | "plusplantium" | null;
type Enemy = {
  pos: Vec; vel: Vec; hp: number; maxHp: number; r: number; speed: number; baseSpeed: number;
  dmg: number; baseDmg: number; color: string; xp: number; coin: number;
  kind: "grunt" | "fast" | "tank" | "boss"; bossId?: BossId;
  abilityCds?: Record<string, number>; abilityFlags?: Record<string, boolean>;
  randomDir?: Vec; randomTimer?: number;
  customBossName?: string;
};
type Pickup = { pos: Vec; kind: "xp" | "coin" | "shadow"; value: number };
type Clone = { frames: Frame[]; idx: number; trail: Vec[]; healer?: boolean; life?: number };
type SpecialClone = { kind: "electric" | "big"; angle: number; radius: number; orbitSpeed: number; life?: number; fireCd: number };
type Rarity = "common"|"rare"|"superrare"|"epic"|"mythical"|"legendary"|"secret"|"ultra"|"diamond"|"rainbow"|"prismatic"|"vip"|"nebula"|"plantiumplus"|"cosmetic"|"ultranova"|"galactic"|"quantum"|"quasaric"|"admin";
type Skin = { id: string; name: string; price: number; color: string; glow?: string; rainbow?: boolean; rarity: Rarity };

const RARITY_ORDER: Rarity[] = ["common","rare","superrare","epic","mythical","legendary","secret","ultra","diamond","rainbow","prismatic","vip","nebula","plantiumplus","cosmetic","ultranova","galactic","quantum","quasaric","admin"];
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
  galactic:     { label: "Galactic",      color: "#60a5fa" },
  quantum:      { label: "Quantum",       color: "#22d3ee" },
  quasaric:     { label: "Quasaric",      color: "#fb7185" },
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

  // Galactic (3)
  { id: "gal_nebulastorm", name: "Galactic Tempest",  rarity: "galactic", price: 70000000,  color: "#60a5fa", glow: "rgba(96,165,250,1)", rainbow: true },
  { id: "gal_supernova",   name: "Galactic Supernova",rarity: "galactic", price: 90000000,  color: "#facc15", glow: "rgba(250,204,21,1)", rainbow: true },
  { id: "gal_eclipse",     name: "Galactic Eclipse",  rarity: "galactic", price: 120000000, color: "#1e1b4b", glow: "rgba(139,92,246,1)", rainbow: true },

  // Quantum (3)
  { id: "qnt_flux",        name: "Quantum Flux",         rarity: "quantum", price: 160000000, color: "#22d3ee", glow: "rgba(34,211,238,1)", rainbow: true },
  { id: "qnt_entangle",    name: "Quantum Entanglement", rarity: "quantum", price: 220000000, color: "#a78bfa", glow: "rgba(167,139,250,1)", rainbow: true },
  { id: "qnt_singularity", name: "Quantum Singularity",  rarity: "quantum", price: 300000000, color: "#0f172a", glow: "rgba(56,189,248,1)", rainbow: true },

  // Quasaric (1)
  { id: "qsr_radiance",    name: "Quasaric Radiance",    rarity: "quasaric", price: 500000000, color: "#fb7185", glow: "rgba(251,113,133,1)", rainbow: true },

  // Admin (1) — exclusive
  { id: "admin",        name: "Admin",              rarity: "admin", price: 1000000000, color: "#ff0033", glow: "rgba(255,0,51,1)" },
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

  // Divine Fortune exclusives (no rarity → only obtainable via Divine Fortune)
  { id: "silver_hat",     name: "Silver Hat",     color: "#d1d5db", glow: "rgba(209,213,219,0.9)" },
  { id: "black_jacket",   name: "Black Jacket",   color: "#0a0a0a", glow: "rgba(139,92,246,0.9)" },
  { id: "crimson_jacket", name: "Crimson Jacket", color: "#dc2626", glow: "rgba(220,38,38,1)" },
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

// ---------- Divine Fortune (premium wheel) ----------
const DIVINE_SPIN_COST = 5000;
const DIVINE_REWARDS: WheelReward[] = [
  { id: "d_c1000",  label: "1000 ◆",       color: "#9ca3af", weight: 75,  apply: (s) => ({ next: { ...s, shadowCoins: s.shadowCoins + 1000 },  msg: "+1000 Shadow Coins" }) },
  { id: "d_silver", label: "Silver Hat",   color: "#d1d5db", weight: 10,  apply: (s) => {
      if (s.accessories.includes("silver_hat")) return { next: { ...s, shadowCoins: s.shadowCoins + 2500 }, msg: "Silver Hat (duplicate) → +2500 ◆" };
      return { next: { ...s, accessories: [...s.accessories, "silver_hat"] }, msg: "Unlocked accessory: Silver Hat!" };
    } },
  { id: "d_c5000",  label: "5000 ◆",       color: "#60a5fa", weight: 5,   apply: (s) => ({ next: { ...s, shadowCoins: s.shadowCoins + 5000 },  msg: "+5000 Shadow Coins" }) },
  { id: "d_black",  label: "Black Jacket", color: "#0a0a0a", weight: 5,   apply: (s) => {
      if (s.accessories.includes("black_jacket")) return { next: { ...s, shadowCoins: s.shadowCoins + 5000 }, msg: "Black Jacket (duplicate) → +5000 ◆" };
      return { next: { ...s, accessories: [...s.accessories, "black_jacket"] }, msg: "Unlocked accessory: Black Jacket!" };
    } },
  { id: "d_myth",   label: "Mythical Skin",color: "#f472b6", weight: 3,   apply: (s) => {
      const pool = SKINS.filter(sk => sk.rarity === "mythical" && !s.owned.includes(sk.id));
      if (pool.length === 0) return { next: { ...s, shadowCoins: s.shadowCoins + 15000 }, msg: "All Mythicals owned → +15000 ◆" };
      const sk = pickRandom(pool);
      return { next: { ...s, owned: [...s.owned, sk.id] }, msg: `MYTHICAL Skin: ${sk.name}!` };
    } },
  { id: "d_c10000", label: "10000 ◆",      color: "#ffe066", weight: 1,   apply: (s) => ({ next: { ...s, shadowCoins: s.shadowCoins + 10000 }, msg: "+10000 Shadow Coins" }) },
  { id: "d_shady",  label: "10 Shady Spins", color: "#ff7a18", weight: 0.8, apply: (s) => {
      try {
        const cur = Number(localStorage.getItem(SHADY_SPINS_KEY) ?? 0) || 0;
        localStorage.setItem(SHADY_SPINS_KEY, String(cur + 10));
      } catch {}
      return { next: s, msg: "+10 Shady Spins!" };
    } },
  { id: "d_crimson",label: "Crimson Jacket", color: "#dc2626", weight: 0.2, apply: (s) => {
      if (s.accessories.includes("crimson_jacket")) return { next: { ...s, shadowCoins: s.shadowCoins + 25000 }, msg: "Crimson Jacket (duplicate) → +25000 ◆" };
      return { next: { ...s, accessories: [...s.accessories, "crimson_jacket"] }, msg: "LEGENDARY! Unlocked Crimson Jacket!" };
    } },
];
const DIVINE_TOTAL_WEIGHT = DIVINE_REWARDS.reduce((a, r) => a + r.weight, 0);
function rollDivine(): WheelReward {
  let r = Math.random() * DIVINE_TOTAL_WEIGHT;
  for (const w of DIVINE_REWARDS) { if ((r -= w.weight) <= 0) return w; }
  return DIVINE_REWARDS[0];
}

type LevelDef = {
  id: number; name: string; bossName: string; bossColor: string;
  bossHp: number; bossDmg: number; bossSpd: number; bossR: number;
  gruntMult: number; guards: number; spinReward: number;
};
const LEVELS: LevelDef[] = [
  { id: 1,  name: "Level 1 — Shade Hollow",    bossName: "SHADE WHELP",         bossColor: "#7cf24a", bossHp: 28000,   bossDmg: 55,  bossSpd: 130, bossR: 46, gruntMult: 1.3,  guards: 6,  spinReward: 1 },
  { id: 2,  name: "Level 2 — Ember Wastes",    bossName: "ASH REAVER",          bossColor: "#ff8a3d", bossHp: 55000,   bossDmg: 75,  bossSpd: 140, bossR: 50, gruntMult: 1.8,  guards: 8,  spinReward: 2 },
  { id: 3,  name: "Level 3 — Crimson Forge",   bossName: "CRIMSON HOUND",       bossColor: "#ff2e88", bossHp: 95000,   bossDmg: 100, bossSpd: 155, bossR: 54, gruntMult: 2.5,  guards: 10, spinReward: 3 },
  { id: 4,  name: "Level 4 — Glacier Vault",   bossName: "GLACIER MAW",         bossColor: "#7dd3fc", bossHp: 160000,  bossDmg: 130, bossSpd: 165, bossR: 58, gruntMult: 3.4,  guards: 12, spinReward: 4 },
  { id: 5,  name: "Level 5 — Void Abyss",      bossName: "VOIDFANG",            bossColor: "#a000ff", bossHp: 260000,  bossDmg: 170, bossSpd: 175, bossR: 62, gruntMult: 4.6,  guards: 14, spinReward: 5 },
  { id: 6,  name: "Level 6 — Storm Spire",     bossName: "STORMCALLER THRAX",   bossColor: "#00e5ff", bossHp: 420000,  bossDmg: 220, bossSpd: 185, bossR: 66, gruntMult: 6.2,  guards: 16, spinReward: 6 },
  { id: 7,  name: "Level 7 — Plague Marsh",    bossName: "PLAGUE SOVEREIGN",    bossColor: "#a3e635", bossHp: 680000,  bossDmg: 280, bossSpd: 195, bossR: 70, gruntMult: 8.4,  guards: 18, spinReward: 7 },
  { id: 8,  name: "Level 8 — Obsidian Throne", bossName: "OBSIDIAN TYRANT",     bossColor: "#fde047", bossHp: 1100000, bossDmg: 360, bossSpd: 205, bossR: 76, gruntMult: 11.0, guards: 22, spinReward: 8 },
  { id: 9,  name: "Level 9 — Null King's Hall",bossName: "NULLKING VORATH",     bossColor: "#c084fc", bossHp: 1800000, bossDmg: 460, bossSpd: 215, bossR: 84, gruntMult: 14.5, guards: 26, spinReward: 9 },
  { id: 10, name: "Level 10 — Eternal Eclipse",bossName: "THE ETERNAL SHADOWLORD", bossColor: "#ff0033", bossHp: 3200000, bossDmg: 620, bossSpd: 230, bossR: 96, gruntMult: 20.0, guards: 32, spinReward: 10 },
];
const LEVEL_WAVES = 5;

type ShadyReward = { coins: number; weight: number; color: string };
const SHADY_REWARDS: ShadyReward[] = [
  { coins: 100,    weight: 25, color: "#9ca3af" },
  { coins: 250,    weight: 25, color: "#60a5fa" },
  { coins: 500,    weight: 25, color: "#a855f7" },
  { coins: 1000,   weight: 25, color: "#ec4899" },
  { coins: 2500,   weight: 5,  color: "#fde68a" },
  { coins: 5000,   weight: 4,  color: "#ff7a18" },
  { coins: 100000, weight: 1,  color: "#ffe066" },
];
const SHADY_TOTAL_WEIGHT = SHADY_REWARDS.reduce((a, r) => a + r.weight, 0);
function rollShady(): ShadyReward {
  let r = Math.random() * SHADY_TOTAL_WEIGHT;
  for (const w of SHADY_REWARDS) { if ((r -= w.weight) <= 0) return w; }
  return SHADY_REWARDS[0];
}

const SHADY_SPINS_KEY = "scs_shady_spins_v1";
const LEVELS_CLEARED_KEY = "scs_levels_cleared_v1";
const FREE_WHEEL_SPINS_KEY = "scs_free_wheel_spins_v1";
const FREE_DIVINE_SPINS_KEY = "scs_free_divine_spins_v1";
function loadShadySpins(): number {
  if (typeof window === "undefined") return 0;
  try { return Number(localStorage.getItem(SHADY_SPINS_KEY) ?? 0) || 0; } catch { return 0; }
}
function saveShadySpins(n: number) { try { localStorage.setItem(SHADY_SPINS_KEY, String(n)); } catch {} }
function loadFreeSpins(key: string): number {
  if (typeof window === "undefined") return 0;
  try { return Number(localStorage.getItem(key) ?? 0) || 0; } catch { return 0; }
}
function saveFreeSpins(key: string, n: number) { try { localStorage.setItem(key, String(n)); } catch {} }
function loadLevelsCleared(): number[] {
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(LEVELS_CLEARED_KEY); const v = raw ? JSON.parse(raw) : []; return Array.isArray(v) ? v.filter(x => typeof x === "number") : []; } catch { return []; }
}
function saveLevelsCleared(v: number[]) { try { localStorage.setItem(LEVELS_CLEARED_KEY, JSON.stringify(v)); } catch {} }
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
const REROLL_KEY = "scs_reroll_v1";
const REROLL_LIMIT = 3;
function todayStr() { return new Date().toISOString().slice(0, 10); }
function loadReroll(): { date: string; count: number } {
  if (typeof window === "undefined") return { date: todayStr(), count: 0 };
  try { const raw = localStorage.getItem(REROLL_KEY); if (raw) { const v = JSON.parse(raw); if (v?.date === todayStr()) return v; } } catch {}
  return { date: todayStr(), count: 0 };
}
function saveReroll(v: { date: string; count: number }) { try { localStorage.setItem(REROLL_KEY, JSON.stringify(v)); } catch {} }
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
    totalWaves: number;
    gameMode: "normal" | "level";
  }>({
    started: false, over: false, won: false,
    wave: 0, score: 0, hp: 100, maxHp: 100,
    xp: 0, xpNext: 5, level: 1,
    coins: 0, time: 0, cloneTimer: CLONE_INTERVAL, clones: 0,
    enemiesLeft: 0, betweenWaves: false, upgrades: [],
    blur: 0, frozen: false, stolen: null, bossName: null,
    shadowCoins: 0,
    waveWarning: 0,
    totalWaves: TOTAL_WAVES,
    gameMode: "normal",
  });

  const [shop, setShop] = useState<ShopSave>({ ...DEFAULT_SHOP });
  const [shopOpen, setShopOpen] = useState(false);
  const [accShopOpen, setAccShopOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [superPickOpen, setSuperPickOpen] = useState(false);
  const [pendingSuperLevelId, setPendingSuperLevelId] = useState<number | null>(null);
  const [shadySpins, setShadySpins] = useState<number>(() => loadShadySpins());
  const [freeWheelSpins, setFreeWheelSpins] = useState<number>(() => loadFreeSpins(FREE_WHEEL_SPINS_KEY));
  const [freeDivineSpins, setFreeDivineSpins] = useState<number>(() => loadFreeSpins(FREE_DIVINE_SPINS_KEY));
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [levelsCleared, setLevelsCleared] = useState<number[]>(() => loadLevelsCleared());
  const [shadyMsg, setShadyMsg] = useState<string | null>(null);
  const [shadyAngle, setShadyAngle] = useState(0);
  const [shadySpinning, setShadySpinning] = useState(false);
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
  const [rerollState, setRerollState] = useState(() => loadReroll());
  const rerollTasks = useCallback(() => {
    const cur = loadReroll();
    if (cur.count >= REROLL_LIMIT) {
      toast.error(`Daily reroll limit reached (${REROLL_LIMIT}/day). Try again tomorrow.`);
      return;
    }
    const next = { date: cur.date, count: cur.count + 1 };
    saveReroll(next);
    setRerollState(next);
    setTasks(rollTasks(lifetimeRef.current));
    toast.success(`Tasks rerolled (${next.count}/${REROLL_LIMIT} today)`);
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
    const mid = idx * slice + slice / 2;
    setWheelSpinning(true);
    setWheelMsg(null);
    setWheelRevealOpen(false);
    setWheelAngle((prev) => {
      const prevMod = ((prev % 360) + 360) % 360;
      const desiredMod = ((360 - mid) % 360 + 360) % 360;
      let delta = desiredMod - prevMod;
      if (delta < 0) delta += 360;
      return prev + 360 * 6 + delta;
    });
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

  // ---- Divine Fortune wheel ----
  const [divineAngle, setDivineAngle] = useState(0);
  const [divineSpinning, setDivineSpinning] = useState(false);
  const [divineMsg, setDivineMsg] = useState<string | null>(null);
  const [divineRevealOpen, setDivineRevealOpen] = useState(false);
  const [divineRevealReward, setDivineRevealReward] = useState<WheelReward | null>(null);
  const divineTimeoutRef = useRef<number | null>(null);
  const divinePendingRef = useRef<WheelReward | null>(null);

  const finishDivine = useCallback((reward: WheelReward) => {
    const cur = shopRef.current;
    const { next, msg } = reward.apply({ ...cur });
    shopRef.current = next;
    setShop(next);
    if (reward.id === "d_shady") {
      setShadySpins((n) => n + 10);
    }
    setDivineMsg(msg);
    setDivineRevealReward(reward);
    setDivineRevealOpen(true);
    toast.success(msg, { duration: 4000 });
    setDivineSpinning(false);
  }, []);

  const spinDivine = useCallback(() => {
    if (divineSpinning) return;
    const sv = shopRef.current;
    if (sv.shadowCoins < DIVINE_SPIN_COST) { setDivineMsg(`Need ◆${DIVINE_SPIN_COST - sv.shadowCoins} more`); return; }
    const reward = rollDivine();
    const idx = DIVINE_REWARDS.indexOf(reward);
    const slice = 360 / DIVINE_REWARDS.length;
    const mid = idx * slice + slice / 2;
    setDivineSpinning(true);
    setDivineMsg(null);
    setDivineRevealOpen(false);
    setDivineAngle((prev) => {
      const prevMod = ((prev % 360) + 360) % 360;
      const desiredMod = ((360 - mid) % 360 + 360) % 360;
      let delta = desiredMod - prevMod;
      if (delta < 0) delta += 360;
      return prev + 360 * 6 + delta;
    });
    const afterCost = { ...sv, shadowCoins: sv.shadowCoins - DIVINE_SPIN_COST };
    shopRef.current = afterCost;
    setShop(afterCost);
    divinePendingRef.current = reward;
    divineTimeoutRef.current = window.setTimeout(() => {
      divinePendingRef.current = null;
      finishDivine(reward);
    }, 4200);
  }, [divineSpinning, finishDivine]);

  const skipDivine = useCallback(() => {
    if (divineTimeoutRef.current) {
      window.clearTimeout(divineTimeoutRef.current);
      divineTimeoutRef.current = null;
    }
    const reward = divinePendingRef.current;
    divinePendingRef.current = null;
    if (reward) finishDivine(reward);
  }, [finishDivine]);



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
      doubleBullets: false, tripleBullets: false, cloneDmgMult: 1,
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
    enemyFreezeTime: 0,
    pullTime: 0,
    stolenUpgrade: null as AppliedUpgrade | null,
    stolenTimer: 0,
    // player buffs
    shieldTime: 0,
    speedBoostTime: 0,
    fireArrowTime: 0,
    poisonArrowTime: 0,
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
    // levels/bosses mode
    gameMode: "normal" as "normal" | "level",
    levelId: 0,
    levelMult: 1,
    levelTotalWaves: TOTAL_WAVES,
    difficulty: "medium" as "easy" | "medium" | "hard",
  });

  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.player = { pos: { x: W / 2, y: H / 2 }, r: 14, hp: 100, maxHp: 100 };
    s.stats = { moveSpeed: 220, fireRate: 4, bulletDmg: 18, bulletSpeed: 520, doubleBullets: false, tripleBullets: false, cloneDmgMult: 1 };
    s.bullets = []; s.enemies = []; s.pickups = []; s.clones = []; s.recording = [];
    s.fireCd = 0; s.cloneFireCd = []; s.spawnQueue = 0; s.waveActive = false; s.bossSpawned = false;
    s.time = 0; s.cloneTimer = CLONE_INTERVAL; s.wave = 0; s.score = 0; s.coins = 0;
    s.xp = 0; s.xpNext = 5; s.level = 1; s.over = false; s.won = false; s.wonRewardGiven = false;
    s.betweenWaves = false; s.pendingUpgrades = null; s.waveCleared = false;
    s.appliedUpgrades = [];
    s.blurTime = 0; s.freezeTime = 0; s.enemyFreezeTime = 0; s.pullTime = 0;
    s.stolenUpgrade = null; s.stolenTimer = 0;
    s.shieldTime = 0; s.speedBoostTime = 0; s.fireArrowTime = 0; s.poisonArrowTime = 0; s.fireTrail = [];
    s.kingShadowTime = 0; s.hyperTime = 0; s.tornadoTime = 0; s.darknessTime = 0;
    s.shadowAttackCd = 0; s.specialClones = [];
    s.dragonBreathTime = 0; s.dragonBreathCd = 0; s.radiationWaves = [];
    s.blackholeTime = 0; s.blackholePos = { x: W / 2, y: H / 2 }; s.slowTime = 0;
    s.explosionFx = [];
    s.lastWaveEnemyCount = 0;
    s.bgColor = "#0b0d1a";
    s.waveWarningTimer = 0;
    s.gameMode = "normal"; s.levelId = 0; s.levelMult = 1; s.levelTotalWaves = TOTAL_WAVES;
    s.difficulty = "medium";
  }, []);

  function edgeSpawn(): Vec {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: rand(0, W), y: -20 };
    if (side === 1) return { x: rand(0, W), y: H + 20 };
    if (side === 2) return { x: -20, y: rand(0, H) };
    return { x: W + 20, y: rand(0, H) };
  }

  function visibleSpawn(): Vec {
    return { x: rand(60, W - 60), y: rand(60, H - 60) };
  }

  function spawnGrunt() {
    const s = stateRef.current;
    const waveBoost = 1 + s.wave * 0.15;
    // Wave 50+ surge: enemies get +500% HP and +250% damage
    const hardHp = s.wave >= 50 ? 6 : 1;
    const hardDmg = s.wave >= 50 ? 3.5 : 1;
    // Wave 75+ elite surge: +250% HP, +150% damage, +50% speed
    const eliteHp = s.wave >= 75 ? 3.5 : 1;
    const eliteDmg = s.wave >= 75 ? 2.5 : 1;
    const eliteSpd = s.wave >= 75 ? 1.5 : 1;
    // Wave 50+ also spawns occasional "mega" enemies that are 5x stronger
    const isMega = s.wave >= 50 && Math.random() < 0.18;
    const megaHp = isMega ? 5 : 1;
    const megaDmg = isMega ? 5 : 1;
    const megaR = isMega ? 1.7 : 1;
    const r = Math.random();
    let e: Enemy;
    if (r < 0.55) {
      const hp = 55 * waveBoost * hardHp * eliteHp * megaHp;
      const spd = (110 + s.wave * 1.2) * eliteSpd;
      e = { pos: s.enemyFreezeTime > 0 ? visibleSpawn() : edgeSpawn(), vel: { x: 0, y: 0 },
        hp, maxHp: hp, r: 14 * megaR, speed: spd, baseSpeed: spd,
        dmg: (16 + s.wave * 0.4) * hardDmg * eliteDmg * megaDmg, baseDmg: (16 + s.wave * 0.4) * hardDmg * eliteDmg * megaDmg,
        color: isMega ? "#ff3df0" : "#7cf24a", xp: isMega ? 5 : 1, coin: isMega ? 5 : 1, kind: "grunt" };
    } else if (r < 0.85) {
      const hp = 32 * waveBoost * hardHp * eliteHp * megaHp;
      const spd = (195 + s.wave * 1.5) * eliteSpd;
      e = { pos: s.enemyFreezeTime > 0 ? visibleSpawn() : edgeSpawn(), vel: { x: 0, y: 0 },
        hp, maxHp: hp, r: 10 * megaR, speed: spd, baseSpeed: spd,
        dmg: (13 + s.wave * 0.3) * hardDmg * eliteDmg * megaDmg, baseDmg: (13 + s.wave * 0.3) * hardDmg * eliteDmg * megaDmg,
        color: isMega ? "#ff3df0" : "#4ad6ff", xp: isMega ? 10 : 2, coin: isMega ? 5 : 1, kind: "fast" };
    } else {
      const hp = 170 * waveBoost * hardHp * eliteHp * megaHp;
      const spd = (75 + s.wave * 0.6) * eliteSpd;
      e = { pos: s.enemyFreezeTime > 0 ? visibleSpawn() : edgeSpawn(), vel: { x: 0, y: 0 },
        hp, maxHp: hp, r: 20 * megaR, speed: spd, baseSpeed: spd,
        dmg: (28 + s.wave * 0.6) * hardDmg * eliteDmg * megaDmg, baseDmg: (28 + s.wave * 0.6) * hardDmg * eliteDmg * megaDmg,
        color: isMega ? "#ff3df0" : "#ff8a3d", xp: isMega ? 15 : 3, coin: isMega ? 15 : 3, kind: "tank" };
    }
    // Levels/Bosses mode: enemies scaled by level multiplier
    const lvlMult = s.levelMult || 1;
    e.hp *= lvlMult; e.maxHp *= lvlMult;
    e.dmg *= lvlMult; e.baseDmg *= lvlMult;
    e.speed *= Math.min(1.6, 1 + (lvlMult - 1) * 0.05);
    e.baseSpeed = e.speed;
    s.enemies.push(e);
  }

  function spawnLevelBossFor(level: LevelDef) {
    const s = stateRef.current;
    // Tier scales with level so abilities ramp up
    const tier: BossId =
      level.id >= 10 ? "plusplantium" :
      level.id >= 8  ? "final" :
      level.id >= 6  ? "plantium" :
      level.id >= 4  ? "hyper" :
      level.id >= 2  ? "mega" : "super";
    s.enemies.push({
      pos: edgeSpawn(), vel: { x: 0, y: 0 },
      hp: level.bossHp, maxHp: level.bossHp, r: level.bossR,
      speed: level.bossSpd, baseSpeed: level.bossSpd,
      dmg: level.bossDmg, baseDmg: level.bossDmg,
      color: level.bossColor, xp: 200, coin: 120, kind: "boss", bossId: tier, customBossName: level.bossName,
      abilityCds: { pull: 4, freeze: 6, steal: 10, revive: 8, blur: 12, hasten: 16, empower: 20, barrage: 3, dash: 5, quake: 9 },
      abilityFlags: {},
    });
    const guardHp = Math.round(280 * level.gruntMult);
    const guardDmg = Math.round(24 * level.gruntMult);
    for (let k = 0; k < level.guards; k++) {
      s.enemies.push({
        pos: edgeSpawn(), vel: { x: 0, y: 0 },
        hp: guardHp, maxHp: guardHp, r: 14, speed: 230, baseSpeed: 230,
        dmg: guardDmg, baseDmg: guardDmg, color: "#ff7ab8", xp: 4, coin: 2, kind: "fast",
      });
    }
    s.bossSpawned = true;
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
    // Wave 75+ bosses: additional +250% HP, +150% damage, +50% speed
    if (s.wave >= 75) { hp = Math.round(hp * 3.5); dmg = Math.round(dmg * 2.5); sp = Math.round(sp * 1.5); }
    s.enemies.push({
      pos: edgeSpawn(), vel: { x: 0, y: 0 },
      hp, maxHp: hp, r, speed: sp, baseSpeed: sp, dmg, baseDmg: dmg,
      color, xp: 120, coin: 80, kind: "boss", bossId: id,
      abilityCds: { pull: 5, freeze: 8, steal: 12, revive: 10, blur: 15, hasten: 20, empower: 25, barrage: 3, dash: 5, quake: 9 },
      abilityFlags: {},
    });
    let guardHp = s.wave >= 50 ? 280 * 6 : 280;
    let guardDmg = s.wave >= 50 ? 24 * 3.5 : 24;
    if (s.wave >= 75) { guardHp = Math.round(guardHp * 3.5); guardDmg = Math.round(guardDmg * 2.5); }
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
    if (s.gameMode === "level") {
      const level = LEVELS.find(l => l.id === s.levelId);
      const isFinal = s.wave >= LEVEL_WAVES;
      if (isFinal && level) {
        s.spawnQueue = 0;
        spawnLevelBossFor(level);
        s.lastWaveEnemyCount = 1;
      } else {
        const mult = level ? level.gruntMult : 1;
        const count = 6 + Math.floor(s.wave * (2 + mult * 0.4));
        s.spawnQueue = count;
        s.lastWaveEnemyCount = count;
      }
      return;
    }
    if (s.wave === 50) {
      s.waveWarningTimer = 4;
      playWave50Alarm();
    }
    if (s.wave === 75) {
      s.waveWarningTimer = 5;
      playWave75Alarm();
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

  // ====== Settings (language, music, brightness, etc.) ======
  type Lang = "en" | "ru" | "kk" | "uk" | "tr" | "de" | "ko" | "zh" | "mn";
  type Settings = {
    lang: Lang;
    music: boolean;
    sfxVolume: number;     // 0..100
    brightness: number;    // 50..150 (%)
    screenShake: boolean;
    showFps: boolean;
    highContrast: boolean;
    reduceMotion: boolean;
  };
  const DEFAULT_SETTINGS: Settings = {
    lang: "en", music: true, sfxVolume: 70, brightness: 100,
    screenShake: true, showFps: false, highContrast: false, reduceMotion: false,
  };
  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const raw = localStorage.getItem("sc_settings");
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_SETTINGS;
  });
  useEffect(() => {
    try { localStorage.setItem("sc_settings", JSON.stringify(settings)); } catch {}
  }, [settings]);
  const updateSetting = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  const [settingsOpen, setSettingsOpen] = useState(false);

  const TRANSLATIONS: Record<Lang, Record<string, string>> = {
    en: { ready:"Ready to survive?", start:"Start Game", shop:"Shop", inventory:"Inventory", tasks:"Tasks", levels:"LVL's/Bosses", settings:"Settings", music:"Music", language:"Language", brightness:"Brightness", sfx:"SFX Volume", screenShake:"Screen Shake", showFps:"Show FPS", highContrast:"High Contrast", reduceMotion:"Reduce Motion", on:"On", off:"Off", close:"Close", reset:"Reset to defaults" },
    ru: { ready:"Готов выжить?", start:"Начать игру", shop:"Магазин", inventory:"Инвентарь", tasks:"Задания", levels:"Уровни/Боссы", settings:"Настройки", music:"Музыка", language:"Язык", brightness:"Яркость", sfx:"Громкость эффектов", screenShake:"Тряска экрана", showFps:"Показывать FPS", highContrast:"Высокий контраст", reduceMotion:"Меньше анимации", on:"Вкл", off:"Выкл", close:"Закрыть", reset:"Сбросить настройки" },
    kk: { ready:"Аман қалуға дайынсың ба?", start:"Ойынды бастау", shop:"Дүкен", inventory:"Қорап", tasks:"Тапсырмалар", levels:"Деңгейлер/Боссылар", settings:"Баптаулар", music:"Музыка", language:"Тіл", brightness:"Жарықтық", sfx:"Эффект дауысы", screenShake:"Экран дірілі", showFps:"FPS көрсету", highContrast:"Жоғары контраст", reduceMotion:"Анимацияны азайту", on:"Қосулы", off:"Өшірулі", close:"Жабу", reset:"Әдепкіге қайтару" },
    uk: { ready:"Готовий вижити?", start:"Почати гру", shop:"Магазин", inventory:"Інвентар", tasks:"Завдання", levels:"Рівні/Боси", settings:"Налаштування", music:"Музика", language:"Мова", brightness:"Яскравість", sfx:"Гучність ефектів", screenShake:"Тряска екрану", showFps:"Показувати FPS", highContrast:"Високий контраст", reduceMotion:"Менше анімації", on:"Увімк", off:"Вимк", close:"Закрити", reset:"Скинути" },
    tr: { ready:"Hayatta kalmaya hazır mısın?", start:"Oyunu Başlat", shop:"Mağaza", inventory:"Envanter", tasks:"Görevler", levels:"Seviyeler/Bosslar", settings:"Ayarlar", music:"Müzik", language:"Dil", brightness:"Parlaklık", sfx:"Efekt Sesi", screenShake:"Ekran Sarsıntısı", showFps:"FPS Göster", highContrast:"Yüksek Kontrast", reduceMotion:"Animasyonu Azalt", on:"Açık", off:"Kapalı", close:"Kapat", reset:"Sıfırla" },
    de: { ready:"Bereit zu überleben?", start:"Spiel starten", shop:"Shop", inventory:"Inventar", tasks:"Aufgaben", levels:"Level/Bosse", settings:"Einstellungen", music:"Musik", language:"Sprache", brightness:"Helligkeit", sfx:"Effektlautstärke", screenShake:"Bildschirmwackeln", showFps:"FPS anzeigen", highContrast:"Hoher Kontrast", reduceMotion:"Weniger Bewegung", on:"An", off:"Aus", close:"Schließen", reset:"Zurücksetzen" },
    ko: { ready:"생존할 준비됐어?", start:"게임 시작", shop:"상점", inventory:"인벤토리", tasks:"임무", levels:"레벨/보스", settings:"설정", music:"음악", language:"언어", brightness:"밝기", sfx:"효과음 볼륨", screenShake:"화면 흔들림", showFps:"FPS 표시", highContrast:"고대비", reduceMotion:"애니메이션 줄이기", on:"켜짐", off:"꺼짐", close:"닫기", reset:"초기화" },
    zh: { ready:"准备好生存了吗？", start:"开始游戏", shop:"商店", inventory:"背包", tasks:"任务", levels:"关卡/Boss", settings:"设置", music:"音乐", language:"语言", brightness:"亮度", sfx:"音效音量", screenShake:"屏幕震动", showFps:"显示FPS", highContrast:"高对比度", reduceMotion:"减少动画", on:"开", off:"关", close:"关闭", reset:"重置" },
    mn: { ready:"Амьд үлдэхэд бэлэн үү?", start:"Тоглоом эхлэх", shop:"Дэлгүүр", inventory:"Эд хэрэгсэл", tasks:"Даалгавар", levels:"Түвшин/Босс", settings:"Тохиргоо", music:"Хөгжим", language:"Хэл", brightness:"Гэрэлтүүлэг", sfx:"Эффектийн дуу", screenShake:"Дэлгэц чичрэх", showFps:"FPS харуулах", highContrast:"Өндөр тодрол", reduceMotion:"Анимаци багасгах", on:"Асаалттай", off:"Унтраалттай", close:"Хаах", reset:"Сэргээх" },
  };
  const LANG_NAMES: Record<Lang, string> = { en:"English", ru:"Русский", kk:"Қазақша", uk:"Українська", tr:"Türkçe", de:"Deutsch", ko:"한국어", zh:"中文", mn:"Монгол" };
  const t = (k: string) => TRANSLATIONS[settings.lang]?.[k] ?? TRANSLATIONS.en[k] ?? k;

  
  const musicOnRef = useRef(settings.music);
  useEffect(() => { musicOnRef.current = settings.music; }, [settings.music]);
  useEffect(() => () => { stopMusic(); }, []);

  const toggleMusic = () => {
    setSettings((s) => {
      const next = !s.music;
      if (next) startMusic(); else stopMusic();
      return { ...s, music: next };
    });
  };

  const startGame = () => {
    resetGame();
    setUiState((u) => ({ ...u, started: true, over: false, won: false, blur: 0, frozen: false, stolen: null, bossName: null }));
    if (musicOnRef.current) startMusic();
    startWave();
  };

  const SUPER_UPGRADES: { id: string; name: string; color: string; desc: string; apply: () => void }[] = [
    {
      id: "shadowchaos", name: "Shadow Chaos", color: "#ff5d3a",
      desc: "3 fire clones shooting fire arrows + 45% move speed",
      apply: () => {
        const s = stateRef.current;
        s.stats.moveSpeed *= 1.45;
        s.fireArrowTime = Math.max(s.fireArrowTime, 9999);
        for (let k = 0; k < 3; k++) {
          s.specialClones.push({ kind: "big", angle: (k * Math.PI * 2) / 3, radius: 58, orbitSpeed: 1.4, fireCd: 0.3 });
        }
      },
    },
    {
      id: "altoultrazero", name: "AltoUltraZero", color: "#7cdcff",
      desc: "Freeze all enemies 25s + 50% damage + clones 25% faster & stronger",
      apply: () => {
        const s = stateRef.current;
        s.enemyFreezeTime = Math.max(s.enemyFreezeTime, 25);
        s.stats.bulletDmg *= 1.5;
        s.stats.cloneDmgMult *= 1.25;
        for (const sc of s.specialClones) sc.orbitSpeed *= 1.25;
      },
    },
    {
      id: "hpwave", name: "HP Wave", color: "#7cffb2",
      desc: "3 healer clones (30s) + poison arrows that deal extra damage",
      apply: () => {
        const s = stateRef.current;
        for (let k = 0; k < 3; k++) {
          s.clones.push({ frames: [], idx: 0, trail: [], healer: true, life: 30 });
          s.cloneFireCd.push(0);
        }
        s.poisonArrowTime = Math.max(s.poisonArrowTime, 9999);
      },
    },
    {
      id: "firegod", name: "Fire God", color: "#ff7a18",
      desc: "Dragon breath + 3 fire clones (damage -25%)",
      apply: () => {
        const s = stateRef.current;
        s.dragonBreathTime = Math.max(s.dragonBreathTime, 9999);
        s.dragonBreathCd = 0;
        s.fireArrowTime = Math.max(s.fireArrowTime, 9999);
        s.stats.bulletDmg *= 0.75;
        for (let k = 0; k < 3; k++) {
          s.specialClones.push({ kind: "big", angle: (k * Math.PI * 2) / 3, radius: 58, orbitSpeed: 1.4, fireCd: 0.3 });
        }
      },
    },
    {
      id: "ultrafast", name: "Ultra Fast Bullets", color: "#ffe066",
      desc: "Shoot 50% faster + damage x2",
      apply: () => {
        const s = stateRef.current;
        s.stats.fireRate *= 1.5;
        s.stats.bulletDmg *= 2;
      },
    },
    {
      id: "quadshooter", name: "Quadriple Shooter", color: "#b388ff",
      desc: "Shoot 2x faster + triple shot",
      apply: () => {
        const s = stateRef.current;
        s.stats.fireRate *= 2;
        s.stats.tripleBullets = true;
      },
    },
  ];

  const startLevel = (levelId: number) => {
    const level = LEVELS.find(l => l.id === levelId);
    if (!level) return;
    setPendingSuperLevelId(levelId);
    setSuperPickOpen(true);
    setLevelsOpen(false);
    toast(`${level.name} — Pick your Super Upgrade!`, { duration: 2500 });
  };

  const pickSuperUpgrade = (superId: string) => {
    const levelId = pendingSuperLevelId;
    if (levelId == null) return;
    const level = LEVELS.find(l => l.id === levelId);
    const su = SUPER_UPGRADES.find(s => s.id === superId);
    if (!level || !su) return;
    resetGame();
    const s = stateRef.current;
    s.gameMode = "level";
    s.levelId = levelId;
    s.levelMult = level.gruntMult;
    s.levelTotalWaves = LEVEL_WAVES;
    su.apply();
    setSuperPickOpen(false);
    setPendingSuperLevelId(null);
    setUiState((u) => ({ ...u, started: true, over: false, won: false, blur: 0, frozen: false, stolen: null, bossName: null }));
    if (musicOnRef.current) startMusic();
    startWave();
    toast(`${su.name} activated! Defeat ${level.bossName}!`, { duration: 4000 });
  };



  const spinShady = () => {
    if (shadySpinning) return;
    if (shadySpins <= 0) { setShadyMsg("No Shady Spins! Beat a level to earn one."); return; }
    const reward = rollShady();
    const idx = SHADY_REWARDS.indexOf(reward);
    const slice = 360 / SHADY_REWARDS.length;
    const mid = idx * slice + slice / 2;
    setShadySpinning(true);
    setShadyMsg(null);
    const newSpins = shadySpins - 1;
    setShadySpins(newSpins);
    saveShadySpins(newSpins);
    setShadyAngle((prev) => {
      const prevMod = ((prev % 360) + 360) % 360;
      const desiredMod = ((360 - mid) % 360 + 360) % 360;
      let delta = desiredMod - prevMod;
      if (delta < 0) delta += 360;
      return prev + 360 * 6 + delta;
    });
    window.setTimeout(() => {
      const cur = shopRef.current;
      const next = { ...cur, shadowCoins: cur.shadowCoins + reward.coins };
      shopRef.current = next; setShop(next);
      setShadyMsg(`+${reward.coins.toLocaleString()} Shadow Coins!`);
      toast.success(`Shady Spin: +${reward.coins.toLocaleString()} ◆`, { duration: 4000 });
      setShadySpinning(false);
    }, 4200);
  };


  useEffect(() => {
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const i = stateRef.current.input;
      const code = e.code;
      const k = e.key.toLowerCase();
      if (code === "KeyW" || code === "ArrowUp" || k === "w" || k === "arrowup" || k === "ц") i.up = down;
      else if (code === "KeyS" || code === "ArrowDown" || k === "s" || k === "arrowdown" || k === "ы") i.down = down;
      else if (code === "KeyA" || code === "ArrowLeft" || k === "a" || k === "arrowleft" || k === "ф") i.left = down;
      else if (code === "KeyD" || code === "ArrowRight" || k === "d" || k === "arrowright" || k === "в") i.right = down;
      else return;
      e.preventDefault();
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
      const poisonMul = s.poisonArrowTime > 0 ? 1.5 : 1;
      const fireMul = (s.fireArrowTime > 0 ? 1.5 : 1) * (s.hyperTime > 0 ? 2 : 1) * poisonMul;
      const dmg = (from === "player" ? s.stats.bulletDmg * fireMul : s.stats.bulletDmg * 0.45 * s.stats.cloneDmgMult * fireMul);
      const color = s.poisonArrowTime > 0 ? "#7cffb2" : (s.hyperTime > 0 ? "#ff2e88" : (s.fireArrowTime > 0 ? "#ff7a18" : (from === "player" ? "#ffe066" : "#b388ff")));
      const speed = s.stats.bulletSpeed;
      const make = (dx: number, dy: number) => s.bullets.push({
        pos: { x: origin.x, y: origin.y }, vel: { x: dx * speed, y: dy * speed },
        life: 1.2, dmg, from, color,
      });
      if (s.stats.tripleBullets) {
        const ang = Math.atan2(dir.y, dir.x);
        const spread = 0.18;
        make(Math.cos(ang - spread), Math.sin(ang - spread));
        make(dir.x, dir.y);
        make(Math.cos(ang + spread), Math.sin(ang + spread));
      } else if (s.stats.doubleBullets) {
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
      const isPP = id === "plusplantium";
      // ===== BRUTAL ABILITIES (all bosses) =====
      // Barrage: ring of 8 homing-ish projectiles. Can't just kite.
      cds.barrage = (cds.barrage ?? 3) - dt;
      if (cds.barrage <= 0) {
        const count = isPP ? 14 : id === "final" ? 12 : id === "plantium" ? 10 : 8;
        const speed = isPP ? 360 : 300;
        const dmg = boss.dmg * (isPP ? 0.35 : 0.28);
        const aimAng = Math.atan2(s.player.pos.y - boss.pos.y, s.player.pos.x - boss.pos.x);
        for (let i = 0; i < count; i++) {
          const a = aimAng + (i - (count - 1) / 2) * 0.18;
          s.bullets.push({
            pos: { x: boss.pos.x, y: boss.pos.y },
            vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
            life: 2.5, dmg, from: "boss", color: boss.color, r: 6,
          });
        }
        cds.barrage = isPP ? 3 : id === "final" ? 4 : 5.5;
      }
      // Dash: boss charges at the player at 3x speed
      cds.dash = (cds.dash ?? 5) - dt;
      if ((boss.abilityFlags as any)._dashT === undefined) (boss.abilityFlags as any)._dashT = 0;
      if (cds.dash <= 0 && !(boss.abilityFlags as any)._dashing) {
        (boss.abilityFlags as any)._dashing = true;
        (boss.abilityFlags as any)._dashT = isPP ? 0.9 : 0.7;
        const d = norm({ x: s.player.pos.x - boss.pos.x, y: s.player.pos.y - boss.pos.y });
        (boss.abilityFlags as any)._dashDx = d.x;
        (boss.abilityFlags as any)._dashDy = d.y;
        cds.dash = isPP ? 4.5 : id === "final" ? 6 : 8;
      }
      if ((boss.abilityFlags as any)._dashing) {
        const t = ((boss.abilityFlags as any)._dashT as number) - dt;
        (boss.abilityFlags as any)._dashT = t;
        const dx = (boss.abilityFlags as any)._dashDx as number;
        const dy = (boss.abilityFlags as any)._dashDy as number;
        const ds = boss.baseSpeed * (isPP ? 4.5 : 3.5);
        boss.pos.x += dx * ds * dt;
        boss.pos.y += dy * ds * dt;
        if (dist(boss.pos, s.player.pos) < boss.r + s.player.r + 6) {
          s.player.hp -= boss.dmg * 0.9 * (s.shieldTime > 0 ? 0.55 : 1);
          (boss.abilityFlags as any)._dashing = false;
        }
        if (t <= 0) (boss.abilityFlags as any)._dashing = false;
      }
      // Quake: AOE shockwave that hits player no matter the distance (within radius)
      cds.quake = (cds.quake ?? 9) - dt;
      if (cds.quake <= 0) {
        const radius = isPP ? 380 : id === "final" ? 320 : id === "plantium" ? 280 : 230;
        if (dist(boss.pos, s.player.pos) < radius) {
          s.player.hp -= boss.dmg * (isPP ? 1.1 : 0.75) * (s.shieldTime > 0 ? 0.55 : 1);
          s.blurTime = Math.max(s.blurTime, 1.5);
        }
        cds.quake = isPP ? 7 : id === "final" ? 9 : 12;
      }
      // ===== Original tiered abilities =====
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
      if (s.enemyFreezeTime > 0) s.enemyFreezeTime = Math.max(0, s.enemyFreezeTime - dt);
      if (s.pullTime > 0) s.pullTime = Math.max(0, s.pullTime - dt);
      if (s.shieldTime > 0) s.shieldTime = Math.max(0, s.shieldTime - dt);
      if (s.speedBoostTime > 0) s.speedBoostTime = Math.max(0, s.speedBoostTime - dt);
      if (s.fireArrowTime > 0) s.fireArrowTime = Math.max(0, s.fireArrowTime - dt);
      if (s.poisonArrowTime > 0) s.poisonArrowTime = Math.max(0, s.poisonArrowTime - dt);
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
      const isBossWave = s.gameMode === "level"
        ? s.wave >= LEVEL_WAVES
        : !!BOSS_WAVES[s.wave];
      if (s.waveActive && !isBossWave && s.spawnQueue > 0) {
        const spawnsThisFrame = s.enemyFreezeTime > 0 ? s.spawnQueue : (Math.random() < 0.04 + s.wave * 0.003 ? 1 : 0);
        for (let k = 0; k < spawnsThisFrame; k++) {
          spawnGrunt();
          s.spawnQueue--;
        }
      }

      // Enemies
      const darkActive = s.darknessTime > 0;
      const slowMul = s.slowTime > 0 ? 0.55 : 1;
      for (const e of s.enemies) {
        if ((!frozen && s.enemyFreezeTime <= 0) || e.kind === "boss") {
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
        if (b.from === "boss") {
          if (dist(b.pos, s.player.pos) < s.player.r + (b.r ?? 5)) {
            s.player.hp -= b.dmg * (s.shieldTime > 0 ? 0.55 : 1);
            b.life = 0;
          }
        } else {
          for (const e of s.enemies) {
            if (e.hp <= 0) continue;
            if (dist(b.pos, e.pos) < e.r + 3) {
              e.hp -= b.dmg; b.life = 0; break;
            }
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
            bumpLifetime({ shadowEarned: p.value });
          } else { s.coins += p.value; }
        } else remPick.push(p);
      }
      s.pickups = remPick;

      if (s.player.hp <= 0) {
        s.player.hp = 0;
        if (!s.over) {
          s.over = true;
          // Streak resets on death before 100 (normal mode only)
          if (s.gameMode === "normal" && s.wave < TOTAL_WAVES) setLifetimeAbs({ wins100Streak: 0 });
        }
      }

      // Wave clear
      if (s.waveActive && !s.waveCleared) {
        const noQueue = isBossWave ? s.bossSpawned : s.spawnQueue <= 0;
        if (noQueue && s.enemies.length === 0) {
          s.waveActive = false; s.waveCleared = true;
          // Wave clear bonus: 10 Shadow Coins
          setShop((sv) => ({ ...sv, shadowCoins: sv.shadowCoins + 10 }));
          bumpLifetime({ wavesCleared: 1, shadowEarned: 10 });
          const reachedEnd = s.gameMode === "level"
            ? s.wave >= LEVEL_WAVES
            : s.wave >= TOTAL_WAVES;
          if (reachedEnd) {
            s.won = true;
            if (!s.wonRewardGiven) {
              s.wonRewardGiven = true;
              if (s.gameMode === "level") {
                const level = LEVELS.find(l => l.id === s.levelId);
                if (level) {
                  const spinsBefore = loadShadySpins();
                  const newSpins = spinsBefore + level.spinReward;
                  saveShadySpins(newSpins);
                  setShadySpins(newSpins);
                  const cleared = loadLevelsCleared();
                  if (!cleared.includes(level.id)) {
                    const nextCleared = [...cleared, level.id];
                    saveLevelsCleared(nextCleared);
                    setLevelsCleared(nextCleared);
                  }
                  toast.success(`${level.bossName} defeated! +${level.spinReward} Shady Spin${level.spinReward > 1 ? "s" : ""}`, { duration: 6000 });
                }
              } else {
                const cur = shopRef.current;
                const hadHat = cur.accessories.includes("bronze_hat");
                const next: ShopSave = {
                  ...cur,
                  shadowCoins: cur.shadowCoins + 500,
                  accessories: hadHat ? cur.accessories : [...cur.accessories, "bronze_hat"],
                };
                shopRef.current = next;
                setShop(next);
                bumpLifetime({ shadowEarned: 500, wins100Streak: 1 });
                toast.success("Wave 100 Complete! +500 Shadow Coins", { duration: 5000 });
                if (!hadHat) {
                  toast.success("Reward Unlocked: Bronze Hat!", { duration: 5000 });
                }
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

      // Special clones (electric King of Shadows / big CLONES CLOOOONES)
      // Rendered as distinct humanoid warriors — NOT copies of the player.
      const elecPalette = [
        { body: "#1e3a8a", head: "#fde68a", glow: "rgba(125,249,255,0.55)", accent: "#7df9ff", cape: "#0ea5e9" }, // blue royal w/ cyan cape
        { body: "#065f46", head: "#fed7aa", glow: "rgba(110,231,183,0.55)", accent: "#6ee7b7", cape: "#10b981" }, // emerald ranger
        { body: "#4c1d95", head: "#f5d0fe", glow: "rgba(167,139,250,0.55)", accent: "#a78bfa", cape: "#7c3aed" }, // violet mage
        { body: "#7c2d12", head: "#fed7aa", glow: "rgba(251,146,60,0.55)",  accent: "#fb923c", cape: "#ea580c" }, // orange knight
      ];
      const bigPalette = [
        { body: "#831843", head: "#fda4af", glow: "rgba(244,114,182,0.55)", accent: "#ec4899", cape: "#be185d" }, // pink brute
        { body: "#312e81", head: "#c7d2fe", glow: "rgba(129,140,248,0.55)", accent: "#818cf8", cape: "#4338ca" }, // indigo titan
        { body: "#14532d", head: "#bbf7d0", glow: "rgba(74,222,128,0.55)",  accent: "#4ade80", cape: "#16a34a" }, // green giant
      ];
      let _elecIdx = 0, _bigIdx = 0;
      for (const sc of s.specialClones) {
        const sx = s.player.pos.x + Math.cos(sc.angle) * sc.radius;
        const sy = s.player.pos.y + Math.sin(sc.angle) * sc.radius;
        const isElec = sc.kind === "electric";
        const pal = isElec ? elecPalette[(_elecIdx++) % elecPalette.length]
                           : bigPalette[(_bigIdx++) % bigPalette.length];
        const scale = isElec ? 1.0 : 1.55;
        const facing = Math.atan2(s.player.pos.y - sy, s.player.pos.x - sx);
        const t = performance.now() / 1000;

        // aura glow
        ctx.fillStyle = pal.glow;
        ctx.beginPath(); ctx.arc(sx, sy, 18 * scale, 0, Math.PI * 2); ctx.fill();

        // cape behind
        ctx.fillStyle = pal.cape;
        ctx.beginPath();
        ctx.moveTo(sx - 6 * scale, sy - 2 * scale);
        ctx.lineTo(sx + 6 * scale, sy - 2 * scale);
        ctx.lineTo(sx + 8 * scale, sy + 12 * scale);
        ctx.lineTo(sx - 8 * scale, sy + 12 * scale);
        ctx.closePath(); ctx.fill();

        // body (torso)
        ctx.fillStyle = pal.body;
        ctx.beginPath(); ctx.ellipse(sx, sy + 3 * scale, 7 * scale, 10 * scale, 0, 0, Math.PI * 2); ctx.fill();

        // shoulder pads / armor accent
        ctx.fillStyle = pal.accent;
        ctx.beginPath(); ctx.arc(sx - 6 * scale, sy - 1 * scale, 2.5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + 6 * scale, sy - 1 * scale, 2.5 * scale, 0, Math.PI * 2); ctx.fill();

        // legs
        ctx.fillStyle = pal.body;
        ctx.fillRect(sx - 4 * scale, sy + 10 * scale, 3 * scale, 5 * scale);
        ctx.fillRect(sx + 1 * scale, sy + 10 * scale, 3 * scale, 5 * scale);

        // head (skin tone, distinct from player's purple shadow)
        ctx.fillStyle = pal.head;
        ctx.beginPath(); ctx.arc(sx, sy - 7 * scale, 4.5 * scale, 0, Math.PI * 2); ctx.fill();

        // hair / helmet on top
        ctx.fillStyle = pal.cape;
        ctx.beginPath();
        ctx.arc(sx, sy - 9 * scale, 4.8 * scale, Math.PI, 0);
        ctx.closePath(); ctx.fill();

        // eyes
        ctx.fillStyle = pal.accent;
        ctx.beginPath(); ctx.arc(sx - 1.6 * scale, sy - 7 * scale, 0.9 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + 1.6 * scale, sy - 7 * scale, 0.9 * scale, 0, Math.PI * 2); ctx.fill();

        // weapon arm — electric = bow/staff, big = greatsword
        ctx.strokeStyle = pal.accent; ctx.lineWidth = 2 * scale; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sx, sy + 2 * scale);
        ctx.lineTo(sx + Math.cos(facing) * 12 * scale, sy + Math.sin(facing) * 12 * scale);
        ctx.stroke();

        if (isElec) {
          // crackling electric arcs around the warrior
          ctx.strokeStyle = "#e0fbff"; ctx.lineWidth = 1;
          for (let i = 0; i < 3; i++) {
            const a = t * 6 + i * 2.1;
            ctx.beginPath();
            ctx.moveTo(sx + Math.cos(a) * 10, sy + Math.sin(a) * 10);
            ctx.lineTo(sx + Math.cos(a + 0.6) * 14, sy + Math.sin(a + 0.6) * 14);
            ctx.stroke();
          }
        } else {
          // big clone: glowing rune on chest
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(sx, sy + 3 * scale, 1.6 * scale, 0, Math.PI * 2); ctx.fill();
        }
      }



      for (const e of s.enemies) {
        const er = e.r;
        const isBossE = e.kind === "boss";
        if (isBossE) {
          const t = performance.now() / 1000;
          const cx = e.pos.x, cy = e.pos.y;
          const key = (e.customBossName ?? "").toUpperCase();

          // Universal glow aura (themed color)
          const aura = ctx.createRadialGradient(cx, cy, er * 0.3, cx, cy, er * 2.4);
          aura.addColorStop(0, e.color + "77");
          aura.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = aura;
          ctx.beginPath(); ctx.arc(cx, cy, er * 2.4, 0, Math.PI * 2); ctx.fill();

          if (key.includes("SHADE WHELP")) {
            // baby shadow dragon — small body, wings, snout
            const flap = Math.sin(t * 6) * er * 0.25;
            ctx.fillStyle = "rgba(10,30,5,0.9)";
            ctx.beginPath();
            ctx.ellipse(cx - er * 1.1, cy - er * 0.1 + flap, er * 0.9, er * 0.4, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.ellipse(cx + er * 1.1, cy - er * 0.1 + flap, er * 0.9, er * 0.4, -0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(15,40,10,1)";
            ctx.beginPath(); ctx.ellipse(cx, cy + er * 0.1, er * 0.9, er * 1.0, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = e.color + "55";
            ctx.beginPath(); ctx.ellipse(cx, cy + er * 0.1, er * 0.85, er * 0.95, 0, 0, Math.PI * 2); ctx.fill();
            // snout head
            ctx.fillStyle = "rgba(15,40,10,1)";
            ctx.beginPath(); ctx.ellipse(cx, cy - er * 0.7, er * 0.55, er * 0.45, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx, cy - er * 0.55, er * 0.35, er * 0.25, 0, 0, Math.PI * 2); ctx.fill();
            // eyes
            ctx.fillStyle = "#bfff5a"; ctx.shadowColor = e.color; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(cx - er * 0.2, cy - er * 0.75, er * 0.1, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + er * 0.2, cy - er * 0.75, er * 0.1, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
          } else if (key.includes("ASH REAVER")) {
            // fiery skeletal reaper with scythe
            // hooded robe
            ctx.fillStyle = "rgba(20,10,5,1)";
            ctx.beginPath();
            ctx.moveTo(cx - er * 1.1, cy + er * 1.0);
            ctx.lineTo(cx - er * 0.8, cy - er * 0.4);
            ctx.quadraticCurveTo(cx, cy - er * 1.4, cx + er * 0.8, cy - er * 0.4);
            ctx.lineTo(cx + er * 1.1, cy + er * 1.0);
            ctx.closePath(); ctx.fill();
            // ember flecks
            for (let i = 0; i < 12; i++) {
              const a = t * 1.5 + i;
              ctx.fillStyle = i % 2 ? "#ff8a3d" : "#ffd84a";
              ctx.beginPath(); ctx.arc(cx + Math.cos(a) * er * 1.2, cy + Math.sin(a * 1.3) * er * 0.7 - er * 0.3, 2, 0, Math.PI * 2); ctx.fill();
            }
            // skull face
            ctx.fillStyle = "#f7e7c8";
            ctx.beginPath(); ctx.arc(cx, cy - er * 0.5, er * 0.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#ff5a1a"; ctx.shadowColor = "#ff8a3d"; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(cx - er * 0.15, cy - er * 0.55, er * 0.09, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + er * 0.15, cy - er * 0.55, er * 0.09, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#1a0a05";
            for (let i = -1; i <= 1; i++) ctx.fillRect(cx + i * er * 0.1 - 1, cy - er * 0.4, 2, er * 0.12);
            // scythe
            ctx.strokeStyle = "#9a6b3a"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(cx + er * 0.9, cy + er * 0.8); ctx.lineTo(cx + er * 1.4, cy - er * 1.1); ctx.stroke();
            ctx.fillStyle = "#cfd8dc";
            ctx.beginPath(); ctx.moveTo(cx + er * 1.4, cy - er * 1.1); ctx.quadraticCurveTo(cx + er * 2.1, cy - er * 1.3, cx + er * 1.9, cy - er * 0.5); ctx.closePath(); ctx.fill();
          } else if (key.includes("CRIMSON HOUND")) {
            // three-headed hellhound
            ctx.fillStyle = "rgba(30,0,5,1)";
            ctx.beginPath(); ctx.ellipse(cx, cy + er * 0.2, er * 1.2, er * 0.85, 0, 0, Math.PI * 2); ctx.fill();
            // legs
            for (let i = -1; i <= 1; i += 2) {
              ctx.fillRect(cx + i * er * 0.7 - 3, cy + er * 0.6, 6, er * 0.6);
              ctx.fillRect(cx + i * er * 0.3 - 3, cy + er * 0.6, 6, er * 0.6);
            }
            // three heads
            const heads: [number, number][] = [[-0.7, -0.5], [0, -0.7], [0.7, -0.5]];
            for (const [dx, dy] of heads) {
              ctx.fillStyle = "rgba(30,0,5,1)";
              ctx.beginPath(); ctx.arc(cx + dx * er, cy + dy * er, er * 0.42, 0, Math.PI * 2); ctx.fill();
              // snout
              ctx.beginPath(); ctx.ellipse(cx + dx * er + Math.sign(dx || 0.001) * er * 0.25, cy + dy * er + er * 0.1, er * 0.22, er * 0.16, 0, 0, Math.PI * 2); ctx.fill();
              // ears
              ctx.beginPath();
              ctx.moveTo(cx + dx * er - er * 0.25, cy + dy * er - er * 0.25);
              ctx.lineTo(cx + dx * er - er * 0.05, cy + dy * er - er * 0.6);
              ctx.lineTo(cx + dx * er + er * 0.05, cy + dy * er - er * 0.25);
              ctx.closePath(); ctx.fill();
              // glowing eyes
              ctx.fillStyle = "#ff2e88"; ctx.shadowColor = "#ff2e88"; ctx.shadowBlur = 10;
              ctx.beginPath(); ctx.arc(cx + dx * er - er * 0.1, cy + dy * er - er * 0.05, er * 0.07, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(cx + dx * er + er * 0.1, cy + dy * er - er * 0.05, er * 0.07, 0, Math.PI * 2); ctx.fill();
              ctx.shadowBlur = 0;
              // fangs
              ctx.fillStyle = "#fff";
              ctx.beginPath(); ctx.moveTo(cx + dx * er - er * 0.08, cy + dy * er + er * 0.18); ctx.lineTo(cx + dx * er - er * 0.04, cy + dy * er + er * 0.3); ctx.lineTo(cx + dx * er, cy + dy * er + er * 0.18); ctx.closePath(); ctx.fill();
            }
          } else if (key.includes("GLACIER MAW")) {
            // jagged ice beast with crystal maw
            ctx.fillStyle = "rgba(20,40,60,1)";
            ctx.beginPath(); ctx.ellipse(cx, cy + er * 0.1, er * 1.15, er * 1.1, 0, 0, Math.PI * 2); ctx.fill();
            // ice spikes around body
            ctx.fillStyle = "#bae6fd";
            for (let i = 0; i < 10; i++) {
              const a = (i / 10) * Math.PI * 2 + t * 0.2;
              const r0 = er * 1.05, r1 = er * 1.5;
              ctx.beginPath();
              ctx.moveTo(cx + Math.cos(a - 0.1) * r0, cy + Math.sin(a - 0.1) * r0);
              ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
              ctx.lineTo(cx + Math.cos(a + 0.1) * r0, cy + Math.sin(a + 0.1) * r0);
              ctx.closePath(); ctx.fill();
            }
            // crystal core
            ctx.fillStyle = "#7dd3fc"; ctx.shadowColor = "#7dd3fc"; ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.moveTo(cx, cy - er * 0.5);
            ctx.lineTo(cx + er * 0.35, cy);
            ctx.lineTo(cx, cy + er * 0.6);
            ctx.lineTo(cx - er * 0.35, cy);
            ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0;
            // gaping maw
            ctx.fillStyle = "#0a1a2a";
            ctx.beginPath(); ctx.ellipse(cx, cy + er * 0.15, er * 0.18, er * 0.28, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#e0f2fe";
            for (let i = -2; i <= 2; i++) {
              ctx.beginPath(); ctx.moveTo(cx + i * er * 0.07, cy - er * 0.05); ctx.lineTo(cx + i * er * 0.07 + 2, cy + er * 0.1); ctx.lineTo(cx + i * er * 0.07 - 2, cy + er * 0.1); ctx.closePath(); ctx.fill();
              ctx.beginPath(); ctx.moveTo(cx + i * er * 0.07, cy + er * 0.35); ctx.lineTo(cx + i * er * 0.07 + 2, cy + er * 0.2); ctx.lineTo(cx + i * er * 0.07 - 2, cy + er * 0.2); ctx.closePath(); ctx.fill();
            }
          } else if (key.includes("VOIDFANG")) {
            // void portal with massive fangs
            ctx.save();
            ctx.translate(cx, cy); ctx.rotate(t * 0.4);
            for (let i = 0; i < 6; i++) {
              ctx.strokeStyle = `rgba(160,0,255,${0.15 + i * 0.1})`; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.arc(0, 0, er * (1.4 - i * 0.18), 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
            // black hole core
            ctx.fillStyle = "#000";
            ctx.beginPath(); ctx.arc(cx, cy, er * 0.85, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#a000ff"; ctx.lineWidth = 3; ctx.shadowColor = "#a000ff"; ctx.shadowBlur = 16;
            ctx.beginPath(); ctx.arc(cx, cy, er * 0.85, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            // surrounding fangs
            ctx.fillStyle = "#fff";
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2;
              const x0 = cx + Math.cos(a) * er * 0.85, y0 = cy + Math.sin(a) * er * 0.85;
              const x1 = cx + Math.cos(a) * er * 0.55, y1 = cy + Math.sin(a) * er * 0.55;
              const px = -Math.sin(a) * er * 0.12, py = Math.cos(a) * er * 0.12;
              ctx.beginPath(); ctx.moveTo(x0 + px, y0 + py); ctx.lineTo(x1, y1); ctx.lineTo(x0 - px, y0 - py); ctx.closePath(); ctx.fill();
            }
            // pupil eye
            ctx.fillStyle = "#a000ff";
            ctx.beginPath(); ctx.arc(cx, cy, er * 0.15, 0, Math.PI * 2); ctx.fill();
          } else if (key.includes("STORMCALLER")) {
            // robed lightning wizard with staff
            ctx.fillStyle = "rgba(10,30,50,1)";
            // robe
            ctx.beginPath();
            ctx.moveTo(cx - er * 1.0, cy + er * 1.1);
            ctx.lineTo(cx - er * 0.55, cy - er * 0.2);
            ctx.lineTo(cx + er * 0.55, cy - er * 0.2);
            ctx.lineTo(cx + er * 1.0, cy + er * 1.1);
            ctx.closePath(); ctx.fill();
            // head with hood
            ctx.fillStyle = "rgba(5,15,30,1)";
            ctx.beginPath(); ctx.arc(cx, cy - er * 0.55, er * 0.55, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#0a1a2a";
            ctx.beginPath(); ctx.ellipse(cx, cy - er * 0.35, er * 0.45, er * 0.2, 0, 0, Math.PI); ctx.fill();
            // glowing eyes
            ctx.fillStyle = "#00e5ff"; ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 14;
            ctx.beginPath(); ctx.arc(cx - er * 0.18, cy - er * 0.5, er * 0.08, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + er * 0.18, cy - er * 0.5, er * 0.08, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            // staff
            ctx.strokeStyle = "#3a2510"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(cx + er * 0.9, cy + er * 1.0); ctx.lineTo(cx + er * 1.2, cy - er * 1.3); ctx.stroke();
            // orb
            const orbY = cy - er * 1.3;
            ctx.fillStyle = "#00e5ff"; ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 18;
            ctx.beginPath(); ctx.arc(cx + er * 1.2, orbY, er * 0.22, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            // lightning bolts radiating
            ctx.strokeStyle = "#e0fbff"; ctx.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
              const a = t * 4 + i * 1.5;
              ctx.beginPath();
              ctx.moveTo(cx + er * 1.2, orbY);
              const lx = cx + er * 1.2 + Math.cos(a) * er * 0.6;
              const ly = orbY + Math.sin(a) * er * 0.6;
              ctx.lineTo(lx + 3, ly - 5);
              ctx.lineTo(lx, ly);
              ctx.stroke();
            }
          } else if (key.includes("PLAGUE")) {
            // plague doctor sovereign — beak mask, dripping ooze
            ctx.fillStyle = "rgba(20,40,10,1)";
            ctx.beginPath(); ctx.ellipse(cx, cy + er * 0.2, er * 1.0, er * 1.05, 0, 0, Math.PI * 2); ctx.fill();
            // dripping ooze
            ctx.fillStyle = "#a3e635";
            for (let i = -2; i <= 2; i++) {
              const dy = (Math.sin(t * 2 + i) * 0.5 + 0.5) * er * 0.6;
              ctx.beginPath(); ctx.ellipse(cx + i * er * 0.35, cy + er * 1.1 + dy, er * 0.08, er * 0.18, 0, 0, Math.PI * 2); ctx.fill();
            }
            // crown of horns
            ctx.fillStyle = "#5a7a1a";
            for (let i = -2; i <= 2; i++) {
              ctx.beginPath();
              ctx.moveTo(cx + i * er * 0.22, cy - er * 0.9);
              ctx.lineTo(cx + i * er * 0.22 + er * 0.06, cy - er * 1.3);
              ctx.lineTo(cx + i * er * 0.22 + er * 0.12, cy - er * 0.9);
              ctx.closePath(); ctx.fill();
            }
            // beak mask
            ctx.fillStyle = "#d4c89a";
            ctx.beginPath(); ctx.arc(cx, cy - er * 0.4, er * 0.45, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx - er * 0.15, cy - er * 0.35);
            ctx.quadraticCurveTo(cx, cy + er * 0.1, cx + er * 0.15, cy - er * 0.35);
            ctx.closePath(); ctx.fill();
            // mask eyes (round glass)
            ctx.fillStyle = "#a3e635"; ctx.shadowColor = "#a3e635"; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(cx - er * 0.22, cy - er * 0.45, er * 0.1, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + er * 0.22, cy - er * 0.45, er * 0.1, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
          } else if (key.includes("OBSIDIAN")) {
            // crystal-armored tyrant king
            ctx.fillStyle = "rgba(8,8,10,1)";
            ctx.beginPath(); ctx.ellipse(cx, cy + er * 0.1, er * 1.2, er * 1.2, 0, 0, Math.PI * 2); ctx.fill();
            // armored plates
            ctx.strokeStyle = "#fde047"; ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2;
              ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * er * 1.15, cy + Math.sin(a) * er * 1.15); ctx.stroke();
            }
            // shoulder crystals
            ctx.fillStyle = "#1a1a20";
            for (let i = -1; i <= 1; i += 2) {
              ctx.beginPath();
              ctx.moveTo(cx + i * er * 0.9, cy - er * 0.4);
              ctx.lineTo(cx + i * er * 1.5, cy - er * 1.1);
              ctx.lineTo(cx + i * er * 1.1, cy - er * 0.2);
              ctx.closePath(); ctx.fill();
            }
            // head
            ctx.fillStyle = "rgba(5,5,8,1)";
            ctx.beginPath(); ctx.arc(cx, cy - er * 0.6, er * 0.55, 0, Math.PI * 2); ctx.fill();
            // jagged crown
            ctx.fillStyle = "#fde047";
            for (let i = -2; i <= 2; i++) {
              ctx.beginPath();
              ctx.moveTo(cx + i * er * 0.2 - er * 0.1, cy - er * 1.0);
              ctx.lineTo(cx + i * er * 0.2, cy - er * 1.45);
              ctx.lineTo(cx + i * er * 0.2 + er * 0.1, cy - er * 1.0);
              ctx.closePath(); ctx.fill();
            }
            // eyes
            ctx.fillStyle = "#fde047"; ctx.shadowColor = "#fde047"; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(cx - er * 0.18, cy - er * 0.6, er * 0.09, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + er * 0.18, cy - er * 0.6, er * 0.09, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
          } else if (key.includes("NULLKING")) {
            // void king — floating crown, fractured body
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(t) * 0.1);
            ctx.fillStyle = "rgba(20,5,40,1)";
            ctx.beginPath(); ctx.ellipse(0, er * 0.2, er * 1.1, er * 1.15, 0, 0, Math.PI * 2); ctx.fill();
            // fracture lines
            ctx.strokeStyle = "#c084fc"; ctx.lineWidth = 1.5; ctx.shadowColor = "#c084fc"; ctx.shadowBlur = 8;
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2 + t * 0.5;
              ctx.beginPath(); ctx.moveTo(0, 0);
              ctx.lineTo(Math.cos(a) * er * 1.0, Math.sin(a) * er * 1.0); ctx.stroke();
            }
            ctx.shadowBlur = 0;
            ctx.restore();
            // floating crown above
            const crownY = cy - er * 1.3 + Math.sin(t * 2) * er * 0.1;
            ctx.fillStyle = "#c084fc"; ctx.shadowColor = "#c084fc"; ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.moveTo(cx - er * 0.6, crownY + er * 0.2);
            ctx.lineTo(cx - er * 0.6, crownY - er * 0.1);
            ctx.lineTo(cx - er * 0.3, crownY + er * 0.05);
            ctx.lineTo(cx, crownY - er * 0.25);
            ctx.lineTo(cx + er * 0.3, crownY + er * 0.05);
            ctx.lineTo(cx + er * 0.6, crownY - er * 0.1);
            ctx.lineTo(cx + er * 0.6, crownY + er * 0.2);
            ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0;
            // head void
            ctx.fillStyle = "#000";
            ctx.beginPath(); ctx.arc(cx, cy - er * 0.5, er * 0.45, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#c084fc"; ctx.shadowColor = "#c084fc"; ctx.shadowBlur = 14;
            ctx.beginPath(); ctx.arc(cx - er * 0.15, cy - er * 0.55, er * 0.08, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + er * 0.15, cy - er * 0.55, er * 0.08, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
          } else if (key.includes("ETERNAL SHADOWLORD")) {
            // colossal winged demon — eclipse halo, wings, horns, blazing eyes
            // eclipse halo
            ctx.save(); ctx.translate(cx, cy - er * 0.4);
            const halo = ctx.createRadialGradient(0, 0, er * 0.5, 0, 0, er * 1.8);
            halo.addColorStop(0, "rgba(255,0,51,0)");
            halo.addColorStop(0.7, "rgba(255,0,51,0.6)");
            halo.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, er * 1.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#000";
            ctx.beginPath(); ctx.arc(0, 0, er * 0.85, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            // huge wings
            const wFlap = Math.sin(t * 3) * 0.15;
            ctx.fillStyle = "rgba(20,0,0,0.95)";
            ctx.save(); ctx.translate(cx, cy - er * 0.2);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(-er * 2.0, -er * 1.4 + wFlap * er, -er * 2.4, -er * 0.4);
            ctx.quadraticCurveTo(-er * 1.6, -er * 0.2, -er * 0.4, er * 0.2);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(er * 2.0, -er * 1.4 + wFlap * er, er * 2.4, -er * 0.4);
            ctx.quadraticCurveTo(er * 1.6, -er * 0.2, er * 0.4, er * 0.2);
            ctx.closePath(); ctx.fill();
            // wing membranes
            ctx.strokeStyle = "#ff0033"; ctx.lineWidth = 1;
            for (let i = 1; i <= 4; i++) {
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-er * (0.6 * i), -er * (0.5 + wFlap)); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(er * (0.6 * i), -er * (0.5 + wFlap)); ctx.stroke();
            }
            ctx.restore();
            // body
            ctx.fillStyle = "rgba(5,0,5,1)";
            ctx.beginPath(); ctx.ellipse(cx, cy + er * 0.2, er * 1.1, er * 1.2, 0, 0, Math.PI * 2); ctx.fill();
            // huge horns
            ctx.fillStyle = "#ff0033";
            ctx.beginPath();
            ctx.moveTo(cx - er * 0.5, cy - er * 1.0);
            ctx.quadraticCurveTo(cx - er * 1.3, cy - er * 1.8, cx - er * 0.2, cy - er * 1.2);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + er * 0.5, cy - er * 1.0);
            ctx.quadraticCurveTo(cx + er * 1.3, cy - er * 1.8, cx + er * 0.2, cy - er * 1.2);
            ctx.closePath(); ctx.fill();
            // head
            ctx.fillStyle = "rgba(5,0,5,1)";
            ctx.beginPath(); ctx.arc(cx, cy - er * 0.6, er * 0.6, 0, Math.PI * 2); ctx.fill();
            // blazing eyes
            ctx.shadowColor = "#ff0033"; ctx.shadowBlur = 20;
            ctx.fillStyle = "#fff200";
            ctx.beginPath(); ctx.arc(cx - er * 0.22, cy - er * 0.65, er * 0.13, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + er * 0.22, cy - er * 0.65, er * 0.13, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            // fanged grin
            ctx.fillStyle = "#fff";
            for (let i = -2; i <= 2; i++) {
              ctx.beginPath();
              ctx.moveTo(cx + i * er * 0.1, cy - er * 0.35);
              ctx.lineTo(cx + i * er * 0.1 + er * 0.04, cy - er * 0.2);
              ctx.lineTo(cx + i * er * 0.1 - er * 0.04, cy - er * 0.2);
              ctx.closePath(); ctx.fill();
            }
          } else {
            // Default wave-boss (super/mega/hyper/plantium/plusplantium): rune ring demon
            const pulse = 1 + Math.sin(t * 3) * 0.08;
            ctx.save();
            ctx.translate(cx, cy); ctx.rotate(t * 0.6);
            ctx.strokeStyle = e.color + "cc"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, (er + 14) * pulse, 0, Math.PI * 2); ctx.stroke();
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2;
              ctx.fillStyle = e.color;
              ctx.beginPath(); ctx.arc(Math.cos(a) * (er + 14) * pulse, Math.sin(a) * (er + 14) * pulse, 3, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
            ctx.fillStyle = "rgba(5,0,10,1)";
            ctx.beginPath(); ctx.ellipse(cx, cy + er * 0.1, er * 1.15, er * 1.25, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = e.color + "66";
            ctx.beginPath(); ctx.ellipse(cx, cy + er * 0.1, er * 1.1, er * 1.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(0,0,0,0.95)";
            for (let i = -1; i <= 1; i += 2) {
              ctx.beginPath();
              ctx.moveTo(cx + i * er * 0.9, cy - er * 0.2);
              ctx.lineTo(cx + i * er * 1.4, cy - er * 0.8);
              ctx.lineTo(cx + i * er * 0.6, cy - er * 0.3);
              ctx.closePath(); ctx.fill();
            }
            ctx.fillStyle = "rgba(5,0,10,1)";
            ctx.beginPath(); ctx.arc(cx, cy - er * 0.7, er * 0.65, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.moveTo(cx - er * 0.45, cy - er * 1.0); ctx.lineTo(cx - er * 0.85, cy - er * 1.6); ctx.lineTo(cx - er * 0.25, cy - er * 1.1); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + er * 0.45, cy - er * 1.0); ctx.lineTo(cx + er * 0.85, cy - er * 1.6); ctx.lineTo(cx + er * 0.25, cy - er * 1.1); ctx.closePath(); ctx.fill();
            ctx.shadowColor = e.color; ctx.shadowBlur = 12;
            ctx.fillStyle = "#fff200";
            ctx.beginPath(); ctx.arc(cx - er * 0.22, cy - er * 0.75, er * 0.14, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + er * 0.22, cy - er * 0.75, er * 0.14, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
          }
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
        const isGolden = s.wave >= 75;
        ctx.fillStyle = isBossE ? "#ffd84a" : (isGolden ? "#ffd84a" : "#ff5d5d");
        ctx.fillRect(e.pos.x - w / 2, barY, w * (e.hp / e.maxHp), 4);
      }

      for (const b of s.bullets) {
        const br = b.r ?? 4;
        if (b.from === "boss") {
          ctx.shadowColor = b.color; ctx.shadowBlur = 14;
        }
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, br, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
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
        ctx.fillText(boss.customBossName ?? BOSS_NAMES[boss.bossId ?? "super"] ?? "BOSS", W / 2, 24);
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
          bossName: boss ? (boss.customBossName ?? BOSS_NAMES[boss.bossId ?? "super"] ?? null) : null,
          shadowCoins: shopRef.current.shadowCoins,
          waveWarning: s.waveWarningTimer,
          totalWaves: s.gameMode === "level" ? LEVEL_WAVES : TOTAL_WAVES,
          gameMode: s.gameMode,
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
          <Stat label="Wave" value={`${uiState.wave}/${uiState.totalWaves}`} />
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
            style={{
              aspectRatio: `${W}/${H}`,
              filter: [
                uiState.blur > 0 ? `blur(${Math.min(8, uiState.blur * 1.4)}px)` : "",
                `brightness(${settings.brightness}%)`,
                settings.highContrast ? "contrast(140%) saturate(120%)" : "",
              ].filter(Boolean).join(" "),
              transition: "filter 0.2s",
            }}
          />


          {!uiState.started && !shopOpen && (
            <Overlay>
              {uiState.wave > 0 && (
                <div className="text-center mb-4">
                  <h2 className="text-3xl font-black text-[#ff5d5d] mb-1">You fell.</h2>
                  <p className="text-white/70 text-sm">Wave reached: {uiState.wave} · Score: {uiState.score}</p>
                </div>
              )}
              <h2 className="text-2xl font-bold mb-2">{t("ready")}</h2>
              <p className="text-white/70 mb-4 max-w-md text-center text-sm">
                100 waves. Bosses at 15, 30, 50, 75, and 100 with brutal abilities. Every 15s your past becomes a clone that fights with you.
              </p>
              <div className="flex flex-col items-center gap-5">
                <button
                  onClick={startGame}
                  className="flex items-center gap-3 px-10 py-5 rounded-xl bg-[#ffe066] text-black font-black text-xl shadow-[0_0_40px_rgba(255,224,102,0.35)] hover:scale-105 transition"
                >
                  <Play className="w-6 h-6" />
                  {t("start")}
                </button>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setShopOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#b388ff] text-black font-bold hover:scale-105 transition"
                  >
                    <Store className="w-4 h-4" />
                    {t("shop")} <span className="opacity-70 text-sm">◆ {shop.shadowCoins}</span>
                  </button>
                  <button
                    onClick={() => setInventoryOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#7dd3fc] text-black font-bold hover:scale-105 transition"
                  >
                    <Backpack className="w-4 h-4" />
                    {t("inventory")}
                  </button>
                  <button
                    onClick={() => setTasksOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#34d399] text-black font-bold hover:scale-105 transition"
                  >
                    <ScrollText className="w-4 h-4" />
                    {t("tasks")}
                  </button>
                  <button
                    onClick={() => setLevelsOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#ff7a18] text-black font-bold hover:scale-105 transition"
                  >
                    <MapIcon className="w-4 h-4" />
                    {t("levels")}
                  </button>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#f472b6] text-black font-bold hover:scale-105 transition"
                    title={t("settings")}
                  >
                    <SettingsIcon className="w-4 h-4" />
                    {t("settings")}
                  </button>
                </div>
              </div>

            </Overlay>
          )}

          {settingsOpen && (
            <Overlay>
              <div className="w-full max-w-lg px-4 max-h-full overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-black bg-gradient-to-r from-[#f472b6] to-[#ffe066] bg-clip-text text-transparent">⚙ {t("settings")}</h2>
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-sm font-bold border border-white/20"
                  >
                    ✕ {t("close")}
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Language */}
                  <div className="p-3 rounded-lg bg-white/5 ring-1 ring-white/10">
                    <label className="block text-xs uppercase tracking-wider text-white/60 mb-2 font-bold">🌐 {t("language")}</label>
                    <select
                      value={settings.lang}
                      onChange={(e) => updateSetting("lang", e.target.value as Lang)}
                      className="w-full px-3 py-2 rounded bg-[#0b0d1a] text-white border border-white/20 focus:border-[#f472b6] outline-none text-sm"
                    >
                      {(Object.keys(LANG_NAMES) as Lang[]).map((code) => (
                        <option key={code} value={code}>{LANG_NAMES[code]}</option>
                      ))}
                    </select>
                  </div>

                  {/* Music */}
                  <div className="p-3 rounded-lg bg-white/5 ring-1 ring-white/10 flex items-center justify-between">
                    <span className="text-sm font-bold">♪ {t("music")}</span>
                    <button
                      onClick={toggleMusic}
                      className={`px-4 py-1.5 rounded font-bold text-sm transition ${settings.music ? "bg-[#34d399] text-black" : "bg-white/10 text-white border border-white/20"}`}
                    >
                      {settings.music ? t("on") : t("off")}
                    </button>
                  </div>

                  {/* SFX Volume */}
                  <div className="p-3 rounded-lg bg-white/5 ring-1 ring-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold">🔊 {t("sfx")}</span>
                      <span className="text-xs text-white/60 tabular-nums">{settings.sfxVolume}%</span>
                    </div>
                    <input
                      type="range" min={0} max={100} step={1}
                      value={settings.sfxVolume}
                      onChange={(e) => updateSetting("sfxVolume", Number(e.target.value))}
                      className="w-full accent-[#f472b6]"
                    />
                  </div>

                  {/* Brightness */}
                  <div className="p-3 rounded-lg bg-white/5 ring-1 ring-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold">☀ {t("brightness")}</span>
                      <span className="text-xs text-white/60 tabular-nums">{settings.brightness}%</span>
                    </div>
                    <input
                      type="range" min={50} max={150} step={5}
                      value={settings.brightness}
                      onChange={(e) => updateSetting("brightness", Number(e.target.value))}
                      className="w-full accent-[#ffe066]"
                    />
                  </div>

                  {/* Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {([
                      ["screenShake", "📳"],
                      ["showFps", "📊"],
                      ["highContrast", "◐"],
                      ["reduceMotion", "🐢"],
                    ] as const).map(([key, icon]) => (
                      <button
                        key={key}
                        onClick={() => updateSetting(key, !settings[key])}
                        className={`p-3 rounded-lg ring-1 text-left transition ${settings[key] ? "bg-[#7dd3fc]/15 ring-[#7dd3fc]/50" : "bg-white/5 ring-white/10 hover:bg-white/10"}`}
                      >
                        <div className="text-xs text-white/60 mb-0.5">{icon} {t(key)}</div>
                        <div className={`text-sm font-bold ${settings[key] ? "text-[#7dd3fc]" : "text-white/70"}`}>
                          {settings[key] ? t("on") : t("off")}
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setSettings(DEFAULT_SETTINGS);
                      if (DEFAULT_SETTINGS.music) startMusic(); else stopMusic();
                    }}
                    className="w-full px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-white/70 text-xs font-bold border border-white/10"
                  >
                    ↺ {t("reset")}
                  </button>
                </div>
              </div>
            </Overlay>
          )}



          {levelsOpen && (
            <Overlay>
              <div className="w-full max-w-3xl px-4 max-h-full overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-2xl font-black bg-gradient-to-r from-[#ff7a18] to-[#ffe066] bg-clip-text text-transparent">LVL's / Bosses</h2>
                  <div className="flex items-center gap-3 text-xs text-white/70">
                    <span>◆ {shop.shadowCoins.toLocaleString()}</span>
                    <span className="px-2 py-1 rounded bg-[#ff7a18]/20 ring-1 ring-[#ff7a18]/40 text-[#ffe066] font-bold">🎰 Shady Spins: {shadySpins}</span>
                  </div>
                </div>
                <p className="text-xs text-white/60 mb-3">Beat 5 waves per level. Each level ends with a unique boss. Win = free Shady Spin(s). Bosses get brutally harder each level.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                  {LEVELS.map(lv => {
                    const done = levelsCleared.includes(lv.id);
                    return (
                      <div key={lv.id} className={`p-3 rounded-lg ring-1 ${done ? "ring-[#34d399]/60 bg-[#34d399]/10" : "ring-white/10 bg-white/5"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-bold text-sm">{lv.name}</div>
                          {done && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#34d399]/30 text-[#34d399] font-bold">CLEARED</span>}
                        </div>
                        <div className="text-xs text-white/70 mb-1">Boss: <span style={{ color: lv.bossColor }} className="font-bold">{lv.bossName}</span></div>
                        <div className="text-[11px] text-white/50 mb-2">Reward: +{lv.spinReward} Shady Spin{lv.spinReward > 1 ? "s" : ""}</div>
                        <button
                          onClick={() => startLevel(lv.id)}
                          className="w-full px-3 py-1.5 rounded bg-[#ff7a18] text-black font-bold text-xs hover:scale-[1.02] transition"
                        >
                          Start Level
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 rounded-lg ring-1 ring-[#ffe066]/40 bg-gradient-to-br from-[#ff7a18]/20 to-[#ffe066]/10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-black text-[#ffe066]">🎰 Shady Spin</h3>
                    <span className="text-xs text-white/70">Spins available: <span className="font-bold text-[#ffe066]">{shadySpins}</span></span>
                  </div>
                  <p className="text-[11px] text-white/60 mb-3">Earn spins by clearing levels. Each spin awards Shadow Coins.</p>

                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative w-56 h-56 shrink-0">
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-b-[16px] border-l-transparent border-r-transparent border-b-[#ffe066] z-10" />
                      <div
                        className="w-full h-full rounded-full ring-4 ring-[#ffe066]/60 transition-transform"
                        style={{
                          transform: `rotate(${shadyAngle}deg)`,
                          transitionDuration: shadySpinning ? "4s" : "0s",
                          transitionTimingFunction: "cubic-bezier(.18,.89,.32,1)",
                          background: `conic-gradient(${SHADY_REWARDS.map((r, i) => {
                            const slice = 360 / SHADY_REWARDS.length;
                            return `${r.color} ${i * slice}deg ${(i + 1) * slice}deg`;
                          }).join(",")})`,
                        }}
                      >
                        {SHADY_REWARDS.map((r, i) => {
                          const slice = 360 / SHADY_REWARDS.length;
                          const a = i * slice + slice / 2;
                          const rad = (a - 90) * Math.PI / 180;
                          const cx = 50 + 32 * Math.cos(rad);
                          const cy = 50 + 32 * Math.sin(rad);
                          return (
                            <div key={r.coins} className="absolute text-[10px] font-black text-black"
                              style={{ left: `${cx}%`, top: `${cy}%`, transform: `translate(-50%, -50%) rotate(${a}deg)` }}>
                              {r.coins >= 1000 ? `${r.coins / 1000}k` : r.coins}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex-1 w-full">
                      <button
                        onClick={spinShady}
                        disabled={shadySpinning || shadySpins <= 0}
                        className="w-full px-4 py-3 rounded-lg bg-[#ffe066] text-black font-black text-lg hover:scale-[1.02] transition disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                      >
                        {shadySpinning ? "Spinning…" : shadySpins > 0 ? "SPIN" : "No Spins"}
                      </button>
                      {shadyMsg && <div className="text-center text-sm text-[#ffe066] font-bold mb-2">{shadyMsg}</div>}
                      <div className="text-[11px] text-white/60 space-y-0.5">
                        {SHADY_REWARDS.map(r => (
                          <div key={r.coins} className="flex items-center justify-between">
                            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: r.color }} />◆ {r.coins.toLocaleString()}</span>
                            <span className="font-mono">{((r.weight / SHADY_TOTAL_WEIGHT) * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-4">
                  <button onClick={() => setLevelsOpen(false)} className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm">Close</button>
                </div>
              </div>
            </Overlay>
          )}

          {superPickOpen && pendingSuperLevelId != null && (
            <Overlay>
              <div className="w-full max-w-3xl px-4 max-h-full overflow-y-auto">
                <div className="text-center mb-4">
                  <h2 className="text-3xl font-black bg-gradient-to-r from-[#ff2e88] via-[#ffe066] to-[#7cdcff] bg-clip-text text-transparent">
                    Choose Your Super Upgrade
                  </h2>
                  <p className="text-xs text-white/60 mt-1">
                    Level {pendingSuperLevelId}: {LEVELS.find(l => l.id === pendingSuperLevelId)?.name} — one pick only
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SUPER_UPGRADES.map(su => (
                    <button
                      key={su.id}
                      onClick={() => pickSuperUpgrade(su.id)}
                      className="text-left p-4 rounded-lg ring-2 bg-white/5 hover:bg-white/10 hover:scale-[1.02] transition"
                      style={{ borderColor: su.color, boxShadow: `0 0 18px -6px ${su.color}` }}
                    >
                      <div className="font-black text-lg mb-1" style={{ color: su.color }}>{su.name}</div>
                      <div className="text-xs text-white/80">{su.desc}</div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => { setSuperPickOpen(false); setPendingSuperLevelId(null); setLevelsOpen(true); }}
                    className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm"
                  >
                    Back
                  </button>
                </div>
              </div>
            </Overlay>
          )}



          {tasksOpen && (
            <Overlay>
              <div className="w-full max-w-2xl px-4 max-h-full overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-2xl font-black bg-gradient-to-r from-[#34d399] to-[#ffe066] bg-clip-text text-transparent">Tasks</h2>
                  <div className="text-xs text-white/60">◆ {shop.shadowCoins}</div>
                </div>

                <div className="space-y-3 mb-4">
                  {tasks.map(t => {
                    const def = TASK_TEMPLATES.find(d => d.id === t.id);
                    if (!def) return null;
                    const current = Math.max(0, (lifetime[def.metric] ?? 0) - t.baseline);
                    const pct = Math.min(100, (current / def.target) * 100);
                    const done = current >= def.target;
                    return (
                      <div key={t.id} className="p-4 rounded-lg ring-1 ring-white/10 bg-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold">{def.label}</div>
                          <div className="text-xs text-[#ffe066]">+{def.reward} ◆</div>
                        </div>
                        <div className="w-full h-2 rounded bg-white/10 overflow-hidden mb-2">
                          <div className="h-full bg-gradient-to-r from-[#34d399] to-[#ffe066]" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/60">{Math.min(current, def.target)} / {def.target}</span>
                          {t.claimed ? (
                            <span className="text-white/40">Claimed</span>
                          ) : (
                            <button
                              disabled={!done}
                              onClick={() => claimTask(t.id)}
                              className="px-3 py-1 rounded bg-[#34d399] text-black font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {done ? "Claim" : "In Progress"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Elite task */}
                {(() => {
                  const streak = lifetime.wins100Streak;
                  const pct = Math.min(100, (streak / ELITE_TARGET) * 100);
                  const done = streak >= ELITE_TARGET;
                  const cur = shop;
                  const claimed = cur.owned.includes("admin") && cur.accessories.includes("admin_hat") && cur.accessories.includes("admin_jacket");
                  return (
                    <div className="p-4 rounded-lg ring-2 ring-[#ff0033] bg-gradient-to-br from-[#330011] to-[#1a0008] mb-4 shadow-[0_0_30px_rgba(255,0,51,0.5)]">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-black text-[#ff5577] tracking-wider">THE ELITE SHADOW GAMER</div>
                        <div className="text-[10px] uppercase tracking-widest text-[#ff0033]">Impossible</div>
                      </div>
                      <div className="text-xs text-white/70 mb-2">Complete 100 waves 10 times in a row. Dying before wave 100 resets your streak.</div>
                      <div className="w-full h-2 rounded bg-white/10 overflow-hidden mb-2">
                        <div className="h-full bg-[#ff0033]" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/60">Streak: {streak} / {ELITE_TARGET}</span>
                        {claimed ? (
                          <span className="text-[#ff5577] font-bold">CLAIMED · Admin Unlocked</span>
                        ) : (
                          <button
                            disabled={!done}
                            onClick={claimElite}
                            className="px-3 py-1 rounded bg-[#ff0033] text-white font-black text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {done ? "Claim Admin Skin" : "Locked"}
                          </button>
                        )}
                      </div>
                      <div className="mt-2 text-[10px] text-white/50">Reward: Admin skin, Admin Hat & Admin Jacket</div>
                    </div>
                  );
                })()}

                <div className="flex gap-3 justify-end">
                  <button onClick={rerollTasks} disabled={rerollState.count >= REROLL_LIMIT} title="You can reroll 3 times each day." className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed">Reroll Tasks ({Math.max(0, REROLL_LIMIT - rerollState.count)}/{REROLL_LIMIT})</button>
                  <button onClick={() => setTasksOpen(false)} className="px-5 py-2 rounded-lg bg-[#ffe066] text-black font-bold text-sm">Close</button>
                </div>
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

                {/* Divine Fortune */}
                <div className="mt-6 p-4 rounded-xl ring-1 ring-[#fb7185]/40 bg-gradient-to-br from-[#2a0a1a] via-[#1a0f2e] to-[#0b0d1a]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-black bg-gradient-to-r from-[#fb7185] via-[#f0abfc] to-[#7dd3fc] bg-clip-text text-transparent">✨ Divine Fortune</h3>
                      <p className="text-[11px] text-white/50">1 spin = ◆ {DIVINE_SPIN_COST.toLocaleString()} — premium prizes</p>
                    </div>
                    <button
                      onClick={spinDivine}
                      disabled={divineSpinning || shop.shadowCoins < DIVINE_SPIN_COST}
                      className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#fb7185] to-[#f0abfc] text-black font-black hover:scale-105 transition disabled:bg-white/10 disabled:text-white/40 disabled:scale-100 disabled:from-white/10 disabled:to-white/10"
                    >
                      {divineSpinning ? "Spinning…" : `SPIN (◆${DIVINE_SPIN_COST})`}
                    </button>
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex flex-col items-center" style={{ width: 220 }}>
                      <div className="relative" style={{ width: 220, height: 220 }}>
                        <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10" style={{ width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "16px solid #fb7185" }} />
                        <div
                          className="rounded-full ring-2 ring-[#fb7185]/60 shadow-2xl"
                          style={{
                            width: 220, height: 220,
                            background: `conic-gradient(${DIVINE_REWARDS.map((r, i) => {
                              const slice = 360 / DIVINE_REWARDS.length;
                              return `${r.color} ${i*slice}deg ${(i+1)*slice}deg`;
                            }).join(",")})`,
                            transform: `rotate(${divineAngle}deg)`,
                            transition: divineSpinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.21, 1)" : undefined,
                          }}
                        >
                          {DIVINE_REWARDS.map((r, i) => {
                            const slice = 360 / DIVINE_REWARDS.length;
                            const angle = i * slice + slice / 2;
                            return (
                              <div key={r.id} className="absolute left-1/2 top-1/2 origin-left text-[9px] font-black text-white whitespace-nowrap pointer-events-none" style={{ transform: `rotate(${angle - 90}deg) translateX(20px)`, textShadow: "0 0 4px rgba(0,0,0,0.9)" }}>
                                {r.label}
                              </div>
                            );
                          })}
                        </div>
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#0b0d1a] ring-2 ring-[#fb7185]" />
                      </div>
                      {divineSpinning && (
                        <button onClick={skipDivine} className="mt-3 px-4 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-xs font-bold text-white/80 transition">
                          Skip ▶▶
                        </button>
                      )}
                    </div>
                    <div className="flex-1 w-full">
                      <div className="text-[11px] text-white/60 mb-2 font-bold uppercase tracking-wider">Rewards & Odds</div>
                      <ul className="text-xs space-y-1">
                        {DIVINE_REWARDS.map(r => (
                          <li key={r.id} className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded" style={{ background: r.color }} />
                            <span className="flex-1">{r.label}</span>
                            <span className="text-white/50">{((r.weight / DIVINE_TOTAL_WEIGHT) * 100).toFixed(r.weight < 1 ? 1 : 0)}%</span>
                          </li>
                        ))}
                      </ul>
                      {divineMsg && (
                        <div className="mt-3 p-2 rounded bg-[#fb7185]/10 ring-1 ring-[#fb7185]/40 text-[#fb7185] text-sm font-bold text-center">
                          {divineMsg}
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


          {uiState.won && uiState.gameMode === "level" && (
            <Overlay>
              <h2 className="text-3xl font-black mb-2 bg-gradient-to-r from-[#ff7a18] to-[#ffe066] bg-clip-text text-transparent">Boss Defeated!</h2>
              <p className="text-white/70 mb-1">Score: {uiState.score} · Coins: {uiState.coins}</p>
              <p className="text-white/70 mb-4">Level cleared — Shady Spin{(LEVELS.find(l => l.id === stateRef.current.levelId)?.spinReward ?? 1) > 1 ? "s" : ""} awarded.</p>
              <div className="flex flex-col items-center gap-1 mb-5">
                <div className="text-lg font-bold text-[#ffe066]">+{LEVELS.find(l => l.id === stateRef.current.levelId)?.spinReward ?? 1} Shady Spin{(LEVELS.find(l => l.id === stateRef.current.levelId)?.spinReward ?? 1) > 1 ? "s" : ""}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { stateRef.current.won = false; stateRef.current.over = true; setUiState(u => ({ ...u, started: false, won: false })); setLevelsOpen(true); }} className="px-6 py-3 rounded-lg bg-[#ff7a18] text-black font-bold hover:scale-105 transition">
                  Back to Levels
                </button>
              </div>
            </Overlay>
          )}

          {uiState.won && uiState.gameMode === "normal" && (
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
                  WAVE {uiState.wave}
                </div>
                <div className="text-xl md:text-3xl font-black text-[#ff5d5d] drop-shadow-[0_0_20px_rgba(255,93,93,0.7)] mb-1">
                  WARNING
                </div>
                <div className="text-sm md:text-lg font-bold text-white/90 tracking-widest uppercase">
                  {uiState.wave === 75 ? "Elite Surge Incoming" : "Enemies Powered Up"}
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

          {divineRevealOpen && divineRevealReward && (
            <div
              className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-[fade-in_0.3s_ease-out]"
              onClick={() => setDivineRevealOpen(false)}
            >
              <div className="relative flex flex-col items-center animate-[scale-in_0.5s_ease-out]" onClick={(e) => e.stopPropagation()}>
                <div className="absolute inset-0 -m-10 rounded-full opacity-40 animate-pulse pointer-events-none" style={{ background: `radial-gradient(circle, ${divineRevealReward.color} 0%, transparent 70%)` }} />
                <div className="mb-2 text-sm font-black uppercase tracking-[0.2em] text-[#fb7185]">Divine Fortune</div>
                <div className="text-4xl md:text-5xl font-black text-center mb-6 px-4" style={{ color: divineRevealReward.color, textShadow: `0 0 30px ${divineRevealReward.color}88, 0 0 60px ${divineRevealReward.color}44` }}>
                  {divineRevealReward.label}
                </div>
                <div className="flex gap-2 mb-8 pointer-events-none">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: divineRevealReward.color, animationDelay: `${i * 0.15}s`, animationDuration: '1.2s' }} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDivineRevealOpen(false); }}
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
