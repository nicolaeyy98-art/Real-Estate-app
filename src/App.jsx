import React, { useState, useEffect, useMemo } from "react";

/* =====================================================================
   DATA — real published price-per-sqm figures (EUR, asking prices)
   Sources: Storia.ro city analyses (Feb 2026, Jul 2026 via Romania Insider),
   Imobiliare.ro residential index (mid-2026 via Romania Insider / Agerpres).
   ===================================================================== */
const CITY_PRICES = {
  bucuresti: { price: 2260, label: "Bucuresti", slug: "bucuresti", asOf: "Jul 2026", source: "Storia + Imobiliare.ro composite" },
  bucharest: { price: 2260, label: "Bucuresti", slug: "bucuresti", asOf: "Jul 2026", source: "Storia + Imobiliare.ro composite" },
  "cluj-napoca": { price: 3298, label: "Cluj-Napoca", slug: "cluj-napoca", asOf: "Jul 2026", source: "Storia.ro" },
  cluj: { price: 3298, label: "Cluj-Napoca", slug: "cluj-napoca", asOf: "Jul 2026", source: "Storia.ro" },
  brasov: { price: 2342, label: "Brasov", slug: "brasov", asOf: "Jul 2026", source: "Storia.ro" },
  timisoara: { price: 1941, label: "Timisoara", slug: "timisoara", asOf: "Feb 2026", source: "Storia.ro" },
  iasi: { price: 1764, label: "Iasi", slug: "iasi", asOf: "Feb 2026", source: "Storia.ro" },
  oradea: { price: 1831, label: "Oradea", slug: "oradea", asOf: "Feb 2026", source: "Storia.ro" },
  sibiu: { price: 1938, label: "Sibiu", slug: "sibiu", asOf: "Feb 2026", source: "Storia.ro" },
  constanta: { price: 2085, label: "Constanta", slug: "constanta", asOf: "Feb 2026", source: "Storia.ro" },
  craiova: { price: 2067, label: "Craiova", slug: "craiova", asOf: "Feb 2026", source: "Storia.ro" },
  ploiesti: { price: 1413, label: "Ploiesti", slug: "ploiesti", asOf: "mid-2026", source: "Imobiliare.ro (new-build)" },
};
const NATIONAL_AVG = { price: 2033, label: "Romania (national average)", asOf: "May 2026", source: "Imobiliare.ro national index" };

// One entry per city (the table above has aliases like "bucharest" / "cluj").
const CITY_LIST = (() => {
  const seen = new Set();
  const out = [];
  for (const c of Object.values(CITY_PRICES)) {
    if (!seen.has(c.slug)) {
      seen.add(c.slug);
      out.push(c);
    }
  }
  return out;
})();

/* Neighborhood tiers — only cities with real district-level reporting.
   Bucuresti: triangulated from Investropa's RON/sqm bands (premium RON 18-34k,
   budget RON 5.8-10.5k, ~5 RON/EUR) cross-checked with bucharest.ro rent survey.
   Cluj-Napoca: Investropa central band RON 16.5-23k, Imo360 citywide range,
   ClujXYZ's Floresti figure. Directional, not exact. */
const NEIGHBORHOODS = {
  bucuresti: {
    primaverii: 5200, herastrau: 4800, floreasca: 4400, dorobanti: 4600,
    aviatorilor: 4600, baneasa: 3400, pipera: 3200,
    aviatiei: 3400, cotroceni: 3100, unirii: 3000, victoriei: 2900,
    romana: 2900, stefan: 2600, tei: 2500,
    titan: 2100, dristor: 2100, tineretului: 2200, vitan: 2000,
    militari: 1600, berceni: 1550, rahova: 1500, giurgiului: 1550,
    pantelimon: 1600, colentina: 1650, ferentari: 1450, taberei: 1650,
    crangasi: 1700, giulesti: 1650, grivita: 1750,
  },
  "cluj-napoca": {
    centru: 3900, central: 3900, muresanu: 4000, plopilor: 3900, gheorgheni: 3600,
    zorilor: 3300, grigorescu: 3300, hasdeu: 3300,
    marasti: 2900, lacuri: 2900,
    manastur: 2300, iris: 2200, dambul: 2100,
    floresti: 1550,
  },
};

const DISPLAY_NAMES = {
  stefan: "Stefan cel Mare", taberei: "Drumul Taberei", muresanu: "Andrei Muresanu",
  lacuri: "Intre Lacuri", dambul: "Dambul Rotund", hasdeu: "Hasdeu", tei: "Tei",
  centru: "Centru", aviatorilor: "Aviatorilor", aviatiei: "Aviatiei",
};
function prettyName(key) {
  return DISPLAY_NAMES[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

/* =====================================================================
   TEXT MATCHING
   ===================================================================== */
function stripDiacritics(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function normalize(raw) {
  return stripDiacritics(raw).replace(/\bromania\b/g, " ").replace(/\bro\b/g, " ");
}

const CITY_WORDS = new Set([
  "bucuresti", "bucharest", "cluj-napoca", "cluj", "napoca", "brasov", "timisoara",
  "iasi", "oradea", "sibiu", "constanta", "craiova", "ploiesti", "romania", "ro",
]);
const STREET_WORDS = new Set([
  "str", "strada", "bd", "bdul", "bulevardul", "calea", "sos", "soseaua", "aleea", "piata", "nr", "bl", "sc", "ap",
]);

function resolveCity(norm) {
  const parts = norm.split(",").map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const words = parts[i].split(/\s+/).filter(Boolean);
    const joined = words.join("-");
    if (CITY_PRICES[joined]) return CITY_PRICES[joined];
    for (const w of words) {
      if (CITY_PRICES[w]) return CITY_PRICES[w];
    }
  }
  return null;
}

function remainingWords(norm) {
  return norm.split(/[\s,]+/).filter((w) => w && !CITY_WORDS.has(w));
}

function resolveNeighborhood(norm, citySlug) {
  const table = NEIGHBORHOODS[citySlug];
  if (!table) return null;
  const remaining = remainingWords(norm).join(" ");
  if (!remaining.trim()) return null;
  for (const key of Object.keys(table)) {
    const re = new RegExp("(^|[^a-z])" + key + "([^a-z]|$)");
    if (re.test(remaining)) return { key, price: table[key] };
  }
  return null;
}

/* =====================================================================
   ESTIMATES
   ===================================================================== */
function indexEstimate(queryText, sqm) {
  const norm = normalize(queryText);
  const city = resolveCity(norm);
  const nb = city ? resolveNeighborhood(norm, city.slug) : null;
  if (nb) {
    return {
      tier: "neighborhood", sqm, perSqm: nb.price, total: nb.price * sqm,
      place: prettyName(nb.key) + ", " + city.label, cityLabel: city.label, cityPrice: city.price,
      asOf: "2026 (triangulated)", source: "published district price bands",
    };
  }
  if (city) {
    return {
      tier: "city", sqm, perSqm: city.price, total: city.price * sqm,
      place: city.label, cityLabel: city.label, cityPrice: city.price,
      asOf: city.asOf, source: city.source,
    };
  }
  return {
    tier: "national", sqm, perSqm: NATIONAL_AVG.price, total: NATIONAL_AVG.price * sqm,
    place: NATIONAL_AVG.label, cityLabel: NATIONAL_AVG.label, cityPrice: NATIONAL_AVG.price,
    asOf: NATIONAL_AVG.asOf, source: NATIONAL_AVG.source,
  };
}

/* ---------- optional live listings (real current asking prices) ---------- */
const ACTOR_ID = "unfenced-group~imobiliare-ro-scraper";

function numField(item, pattern) {
  for (const key of Object.keys(item)) {
    if (pattern.test(key)) {
      const v = item[key];
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.]/g, ""));
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return null;
}
function textField(item, pattern) {
  for (const key of Object.keys(item)) {
    if (pattern.test(key) && typeof item[key] === "string" && item[key]) return item[key];
  }
  return null;
}

async function fetchLive(token, queryText, sqm) {
  const norm = normalize(queryText);
  const city = resolveCity(norm);
  const slug = city ? city.slug : "bucuresti";
  const hintWords = remainingWords(norm).filter((w) => w.length > 2 && !/^\d+$/.test(w) && !STREET_WORDS.has(w));
  const hint = hintWords.join(" ");

  const url = "https://api.apify.com/v2/actors/" + ACTOR_ID + "/run-sync-get-dataset-items?token=" + encodeURIComponent(token);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offerType: "sell", propertyType: "apartamente", location: slug, maxItems: 60, fetchDetails: true }),
  });
  if (!response.ok) throw new Error("Apify error " + response.status);
  const items = await response.json();
  if (!Array.isArray(items) || items.length === 0) throw new Error("No listings");

  const rows = items
    .map((item) => {
      const price = numField(item, /price/i);
      const area = numField(item, /surface|usable|area|sqm|mp/i);
      const address = textField(item, /street|address|location/i);
      const ppsqm = price && area ? price / area : null;
      return { price, area, address, ppsqm: ppsqm && ppsqm >= 300 && ppsqm <= 15000 ? ppsqm : null };
    })
    .filter((r) => r.price);
  if (rows.length === 0) throw new Error("No prices");

  let pool = rows;
  let nearStreet = false;
  if (hint) {
    const filtered = rows.filter((r) => r.address && stripDiacritics(r.address).includes(hint));
    if (filtered.length >= 3) {
      pool = filtered;
      nearStreet = true;
    }
  }

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const ppsqmList = pool.map((r) => r.ppsqm).filter(Boolean);
  const avgAsking = avg(pool.map((r) => r.price));
  const perSqm = ppsqmList.length >= 3 ? avg(ppsqmList) : null;

  return {
    tier: "live", sqm, count: pool.length, scanned: rows.length, nearStreet,
    perSqm, avgAsking, basis: perSqm ? "sqm" : "listing",
    total: perSqm ? Math.round(perSqm * sqm) : Math.round(avgAsking),
    place: city ? city.label : "Bucuresti",
  };
}

/* =====================================================================
   FORMATTING + STORAGE
   ===================================================================== */
function formatEUR(n) {
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
function formatRON(n) {
  return Math.round(n).toLocaleString("en-US") + " RON";
}
function loadJSON(key, fallback) {
  try {
    const v = window.localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* storage unavailable — app still works, just won't remember */
  }
}
function clampSize(v) {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return 55;
  return Math.min(Math.max(n, 10), 1000);
}

const TIER_STAMP = {
  neighborhood: "DISTRICT", city: "CITY INDEX", national: "NATIONAL AVG", live: "LIVE COMPS",
};

/* =====================================================================
   ICONS
   ===================================================================== */
function Icon({ d, size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  home: "M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6",
  bars: "M4 20V11M10 20V4M16 20v-7M21 20H3",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  calc: "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8M8 12h2M14 12h2M8 16h2M14 16h2",
  sliders: "M4 7h9M17 7h3M4 17h3M11 17h9M13 5v4M9 15v4",
  share: "M12 15V3M8 7l4-4 4 4M5 13v7h14v-7",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  calcsmall: "M4 20V4h16v16zM8 8h8M8 12h3M13 12h3M8 16h3M13 16h3",
};

/* =====================================================================
   STYLES
   ===================================================================== */
const CSS = `
.par-root {
  --bg: #0a1420; --panel: #14263f; --panel-2: #172a44; --line: #24405c; --line-soft: #1c3450;
  --cyan: #6bd4ea; --cyan-dim: #2f5a68; --gold: #d9b262; --ink-red: #c1502f;
  --text: #f2f4f7; --muted: #93a6bc; --paper: #efe8d3; --paper-2: #e7dfc6; --paper-text: #241b0f;
  background:
    radial-gradient(1200px 600px at 15% -10%, rgba(107,212,234,0.08), transparent 60%),
    radial-gradient(900px 500px at 100% 0%, rgba(217,178,98,0.06), transparent 55%),
    var(--bg);
  color: var(--text);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  min-height: 100vh; min-height: 100dvh; box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}
.par-root * { box-sizing: border-box; }
.par-shell {
  max-width: 640px; margin: 0 auto;
  padding: calc(18px + env(safe-area-inset-top, 0px)) 18px calc(104px + env(safe-area-inset-bottom, 0px));
}
.par-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }
.par-brand { display: flex; align-items: center; gap: 10px; }
.par-mark {
  width: 30px; height: 30px; border-radius: 8px;
  background: linear-gradient(155deg, var(--cyan), var(--cyan-dim));
  display: flex; align-items: center; justify-content: center;
  font-family: "Fraunces", Georgia, serif; font-weight: 700; font-size: 16px; color: #06141f;
  box-shadow: 0 2px 10px rgba(107,212,234,0.35);
}
.par-brand-name { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cyan); font-weight: 600; }
.par-iconbtn {
  width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--line); background: rgba(255,255,255,0.02);
  color: var(--muted); display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none;
}
.par-iconbtn:active { background: rgba(107,212,234,0.1); color: var(--cyan); }
.par-title {
  font-family: "Fraunces", Georgia, serif; font-size: 30px; font-weight: 700; letter-spacing: -0.01em;
  line-height: 1.15; margin: 0 0 8px;
}
.par-sub { color: var(--muted); font-size: 14px; line-height: 1.6; margin: 0 0 20px; }
.par-card {
  background: linear-gradient(180deg, var(--panel-2), var(--panel)); border: 1px solid var(--line);
  border-radius: 16px; padding: 18px; box-shadow: 0 1px 0 rgba(255,255,255,0.03) inset, 0 20px 50px -24px rgba(0,0,0,0.6);
  margin-bottom: 16px;
}
.par-label { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 0 0 7px; font-weight: 600; }
.par-row { display: flex; gap: 8px; margin-bottom: 14px; }
.par-input {
  flex: 1; min-width: 0; background: #0a1523; border: 1px solid var(--line); color: var(--text);
  font-family: inherit; font-size: 16px; padding: 13px 14px; border-radius: 12px; outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.par-input:focus { border-color: var(--cyan); box-shadow: 0 0 0 3px rgba(107,212,234,0.14); }
.par-input::placeholder { color: #5f7690; }
.par-size { width: 110px; flex: none; }
.par-btn {
  background: linear-gradient(180deg, var(--cyan), #4bb6cc); border: 1px solid var(--cyan); color: #06141f;
  font-family: inherit; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
  padding: 0 20px; min-height: 48px; border-radius: 12px; cursor: pointer;
  box-shadow: 0 8px 18px -8px rgba(107,212,234,0.55); transition: transform 0.12s ease;
}
.par-btn:active { transform: translateY(1px) scale(0.99); }
.par-btn:disabled { opacity: 0.6; }
.par-btn-ghost {
  background: transparent; color: var(--text); border: 1px solid var(--line); box-shadow: none; font-weight: 600;
}
.par-btn-danger { background: transparent; color: #f08a6b; border: 1px solid #5a3325; box-shadow: none; }
.par-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: -4px 0 4px; }
.par-chip {
  font-family: inherit; font-size: 12px; color: var(--muted); background: rgba(107,212,234,0.06);
  border: 1px solid var(--line-soft); border-radius: 999px; padding: 7px 12px; cursor: pointer;
}
.par-chip:active { color: var(--cyan); border-color: var(--cyan); }

/* ledger */
.par-ledger {
  background: linear-gradient(180deg, var(--paper), var(--paper-2)); color: var(--paper-text);
  border-radius: 14px; padding: 22px 22px 18px; position: relative; overflow: hidden;
  box-shadow: 0 16px 34px -18px rgba(0,0,0,0.55); animation: par-fade 0.35s ease-out;
}
@keyframes par-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.par-ledger::before { content: ""; position: absolute; inset: 7px; border: 1px dashed #9a8c5f; border-radius: 9px; pointer-events: none; opacity: 0.6; }
.par-l-top { display: flex; justify-content: space-between; gap: 10px; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6248; margin-bottom: 16px; font-weight: 600; padding-right: 96px; }
.par-l-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6248; margin-bottom: 6px; font-weight: 600; line-height: 1.4; }
.par-l-value { font-family: "Fraunces", Georgia, serif; font-size: 44px; font-weight: 700; color: #1c3a2b; line-height: 1; }
.par-l-ron { font-size: 12px; color: #5a5237; margin-top: 6px; }
.par-l-sub { font-size: 12px; color: #5a5237; margin-top: 12px; line-height: 1.6; }
.par-l-chip {
  display: inline-block; margin-top: 12px; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px;
  background: rgba(28,58,43,0.1); color: #1c3a2b;
}
.par-l-chip.down { background: rgba(193,80,47,0.12); color: #9c3f22; }
.par-l-actions { display: flex; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 1px dashed #9a8c5f; flex-wrap: wrap; }
.par-l-btn {
  display: inline-flex; align-items: center; gap: 6px; font-family: inherit; font-size: 12px; font-weight: 600;
  color: #241b0f; background: rgba(36,27,15,0.06); border: 1px solid rgba(36,27,15,0.18);
  border-radius: 10px; padding: 0 12px; min-height: 42px; cursor: pointer;
}
.par-l-btn:active { background: rgba(36,27,15,0.14); }
.par-stamp {
  position: absolute; top: 16px; right: 18px; font-family: "Fraunces", Georgia, serif; font-weight: 700;
  font-size: 11px; letter-spacing: 0.08em; color: var(--ink-red); border: 2px solid var(--ink-red);
  padding: 4px 10px; border-radius: 5px; transform: rotate(-8deg); opacity: 0;
  animation: par-stamp 0.4s ease-out 0.08s forwards;
}
@keyframes par-stamp {
  0% { opacity: 0; transform: rotate(-8deg) scale(2.2); }
  60% { opacity: 1; transform: rotate(-8deg) scale(0.95); }
  100% { opacity: 0.92; transform: rotate(-8deg) scale(1); }
}
.par-empty { display: flex; flex-direction: column; gap: 6px; }
.par-empty-title { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #6b6248; font-weight: 600; }
.par-empty-text { font-size: 12px; color: #5a5237; line-height: 1.6; }
.par-note { font-size: 11px; color: var(--muted); text-align: center; line-height: 1.6; margin: 18px 6px 0; }

/* explore */
.par-seg { display: flex; gap: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--line-soft); border-radius: 12px; padding: 4px; margin-bottom: 16px; }
.par-seg button {
  flex: 1; font-family: inherit; font-size: 12px; font-weight: 600; color: var(--muted); background: transparent;
  border: 0; border-radius: 9px; padding: 11px 6px; cursor: pointer;
}
.par-seg button.on { background: rgba(107,212,234,0.14); color: var(--cyan); }
.par-bar-row { display: block; width: 100%; text-align: left; font-family: inherit; color: inherit; background: none; border: 0; padding: 9px 0; cursor: pointer; }
.par-bar-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; gap: 8px; }
.par-bar-name { font-size: 13px; font-weight: 600; }
.par-bar-name span { color: var(--muted); font-weight: 400; margin-right: 8px; }
.par-bar-val { font-size: 12px; color: var(--gold); font-weight: 600; white-space: nowrap; }
.par-bar-track { position: relative; height: 10px; border-radius: 6px; background: rgba(255,255,255,0.05); overflow: visible; }
.par-bar-fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg, var(--cyan-dim), var(--cyan)); }
.par-bar-tick { position: absolute; top: -4px; width: 2px; height: 18px; background: var(--gold); border-radius: 1px; }
.par-legend { font-size: 11px; color: var(--muted); margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
.par-legend i { display: inline-block; width: 2px; height: 12px; background: var(--gold); }

/* saved */
.par-saved-item { background: rgba(255,255,255,0.03); border: 1px solid var(--line-soft); border-radius: 14px; padding: 14px; margin-bottom: 10px; display: flex; gap: 12px; align-items: center; }
.par-saved-main { flex: 1; min-width: 0; text-align: left; background: none; border: 0; color: inherit; font-family: inherit; padding: 0; cursor: pointer; }
.par-saved-addr { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.par-saved-meta { font-size: 11px; color: var(--muted); margin-top: 3px; }
.par-saved-val { font-family: "Fraunces", Georgia, serif; font-size: 19px; font-weight: 700; color: var(--gold); margin-top: 6px; }
.par-blank { text-align: center; color: var(--muted); font-size: 13px; line-height: 1.7; padding: 40px 10px; }

/* tools */
.par-slider { width: 100%; accent-color: var(--cyan); margin: 4px 0 16px; }
.par-slider-head { display: flex; justify-content: space-between; align-items: baseline; }
.par-slider-head b { color: var(--gold); font-size: 14px; }
.par-help { font-size: 11px; color: var(--muted); margin-top: 6px; line-height: 1.6; }
.par-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px dashed #9a8c5f; }
.par-stat b { display: block; font-size: 15px; color: #1c3a2b; margin-top: 2px; }
.par-stat span { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6248; font-weight: 600; }

/* tab bar */
.par-tabs {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
  background: rgba(10,20,32,0.88); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-top: 1px solid var(--line-soft); padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px));
}
.par-tabs-inner { max-width: 640px; margin: 0 auto; display: flex; gap: 4px; }
.par-tab {
  flex: 1; position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px;
  font-family: inherit; font-size: 10px; letter-spacing: 0.04em; font-weight: 600; color: var(--muted);
  background: none; border: 0; padding: 8px 4px; border-radius: 12px; cursor: pointer;
}
.par-tab.on { color: var(--cyan); background: rgba(107,212,234,0.09); }
.par-badge {
  position: absolute; top: 3px; left: calc(50% + 8px); min-width: 16px; height: 16px; border-radius: 8px; padding: 0 4px;
  background: var(--gold); color: #1a1206; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;
}

/* settings sheet + toast */
.par-backdrop { position: fixed; inset: 0; z-index: 40; background: rgba(3,8,14,0.6); display: flex; align-items: flex-end; justify-content: center; }
.par-sheet {
  width: 100%; max-width: 640px; max-height: 88vh; overflow-y: auto; background: var(--panel);
  border: 1px solid var(--line); border-radius: 22px 22px 0 0; padding: 20px 18px calc(24px + env(safe-area-inset-bottom, 0px));
  animation: par-up 0.25s ease-out;
}
@keyframes par-up { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
.par-sheet h2 { font-family: "Fraunces", Georgia, serif; font-size: 22px; margin: 0 0 4px; }
.par-sheet-sub { font-size: 12px; color: var(--muted); margin: 0 0 18px; line-height: 1.6; }
.par-field { margin-bottom: 18px; }
.par-toast {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(92px + env(safe-area-inset-bottom, 0px)); z-index: 50;
  background: #0e2236; border: 1px solid var(--cyan-dim); color: var(--text); font-size: 12px; padding: 10px 16px; border-radius: 999px;
  box-shadow: 0 10px 30px -10px rgba(0,0,0,0.7); white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .par-stamp { animation: none; opacity: 0.92; transform: rotate(-8deg); }
  .par-ledger, .par-sheet { animation: none; }
}
@media (max-width: 420px) {
  .par-title { font-size: 25px; }
  .par-l-value { font-size: 38px; }
  .par-size { width: 96px; }
}
`;

/* =====================================================================
   COMPONENT
   ===================================================================== */
export default function App() {
  const [tab, setTab] = useState("estimate");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState("");

  // estimate
  const [query, setQuery] = useState("");
  const [size, setSize] = useState("55");
  const [status, setStatus] = useState("idle"); // idle | loading | done
  const [result, setResult] = useState(null);
  const [address, setAddress] = useState("");
  const [stampKey, setStampKey] = useState(0);

  // persisted on this device
  const [saved, setSaved] = useState(() => loadJSON("par.saved", []));
  const [history, setHistory] = useState(() => loadJSON("par.history", []));
  const [token, setToken] = useState(() => loadJSON("par.token", ""));
  const [rate, setRate] = useState(() => loadJSON("par.rate", "5.05"));
  const [showToken, setShowToken] = useState(false);

  // explore
  const [exploreView, setExploreView] = useState("cities");

  // mortgage
  const [mPrice, setMPrice] = useState("");
  const [mDown, setMDown] = useState(25);
  const [mRate, setMRate] = useState("6.5");
  const [mYears, setMYears] = useState(25);

  useEffect(() => saveJSON("par.saved", saved), [saved]);
  useEffect(() => saveJSON("par.history", history), [history]);
  useEffect(() => saveJSON("par.token", token), [token]);
  useEffect(() => saveJSON("par.rate", rate), [rate]);

  const rateNum = parseFloat(rate) > 0 ? parseFloat(rate) : 5.05;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  function pushHistory(text) {
    setHistory((prev) => [text, ...prev.filter((h) => h.toLowerCase() !== text.toLowerCase())].slice(0, 6));
  }

  async function runEstimate(e) {
    if (e) e.preventDefault();
    const text = query.trim();
    if (!text) return;
    const sqm = clampSize(size);
    setStatus("loading");
    setAddress(text);
    pushHistory(text);

    let res = null;
    if (token.trim()) {
      try {
        res = await fetchLive(token.trim(), text, sqm);
      } catch (err) {
        res = null;
      }
    }
    if (!res) {
      res = indexEstimate(text, sqm);
      if (token.trim()) res.liveFailed = true;
    }
    setResult(res);
    setStatus("done");
    setStampKey((k) => k + 1);
  }

  function openEstimate(text) {
    setQuery(text);
    setAddress(text);
    setResult(indexEstimate(text, clampSize(size)));
    setStatus("done");
    setStampKey((k) => k + 1);
    setTab("estimate");
    window.scrollTo(0, 0);
  }

  const isSaved =
    !!result &&
    saved.some((s) => s.address === address && s.result.total === result.total && s.result.tier === result.tier && s.result.sqm === result.sqm);

  function saveCurrent() {
    if (!result) return;
    if (isSaved) {
      showToast("Already saved");
      return;
    }
    setSaved((prev) => [{ id: Date.now(), address, result, date: new Date().toISOString() }, ...prev].slice(0, 50));
    showToast("Saved");
  }

  async function shareCurrent() {
    if (!result) return;
    const text = address + ": about " + formatEUR(result.total) + " (" + result.sqm + " sqm) — estimate from Plat & Record";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Plat & Record", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard");
    } catch (err) {
      if (err && err.name === "AbortError") return;
      showToast("Sharing isn't available here");
    }
  }

  function reopenSaved(entry) {
    setQuery(entry.address);
    setAddress(entry.address);
    setResult(entry.result);
    setSize(String(entry.result.sqm));
    setStatus("done");
    setStampKey((k) => k + 1);
    setTab("estimate");
    window.scrollTo(0, 0);
  }

  function toMortgage() {
    if (!result) return;
    setMPrice(String(Math.round(result.total)));
    setTab("tools");
    window.scrollTo(0, 0);
  }

  const mortgage = useMemo(() => {
    const price = parseFloat(mPrice);
    const r = parseFloat(mRate);
    if (!(price > 0) || !(r >= 0)) return null;
    const principal = price * (1 - mDown / 100);
    const n = mYears * 12;
    const i = r / 100 / 12;
    const monthly = i === 0 ? principal / n : (principal * i) / (1 - Math.pow(1 + i, -n));
    return { principal, monthly, total: monthly * n, interest: monthly * n - principal, down: (price * mDown) / 100 };
  }, [mPrice, mDown, mRate, mYears]);

  /* ---------- explore rows ---------- */
  const exploreRows = useMemo(() => {
    if (exploreView === "cities") {
      return {
        avg: null,
        rows: CITY_LIST.map((c) => ({ key: c.slug, name: c.label, price: c.price, open: c.label })).sort((a, b) => b.price - a.price),
      };
    }
    const city = CITY_LIST.find((c) => c.slug === exploreView);
    const table = NEIGHBORHOODS[exploreView] || {};
    const rows = Object.keys(table)
      .filter((k) => k !== "central")
      .map((k) => ({ key: k, name: prettyName(k), price: table[k], open: k + ", " + city.label }))
      .sort((a, b) => b.price - a.price);
    return { avg: city.price, rows };
  }, [exploreView]);
  const exploreMax = Math.max(...exploreRows.rows.map((r) => r.price), exploreRows.avg || 0);

  const vsCity =
    result && result.tier === "neighborhood" ? Math.round((result.perSqm / result.cityPrice - 1) * 100) : null;

  function renderLedger() {
    if (status === "idle") {
      return (
        <div className="par-ledger par-empty">
          <div className="par-empty-title">No estimate yet</div>
          <div className="par-empty-text">Type an address (or just a district and city) and press Get Estimate.</div>
        </div>
      );
    }
    if (status === "loading") {
      return (
        <div className="par-ledger par-empty">
          <div className="par-empty-title">Pulling data…</div>
          <div className="par-empty-text">Checking live listings first, then the price index.</div>
        </div>
      );
    }
    if (!result) return null;

    const isLive = result.tier === "live";
    return (
      <div className="par-ledger" key={stampKey}>
        <div className="par-stamp">{TIER_STAMP[result.tier]}</div>
        <div className="par-l-top">
          <span>{isLive ? result.count + " listings" + (result.nearStreet ? " near street" : " citywide") : result.place}</span>
          <span>{isLive ? "of " + result.scanned : formatEUR(result.perSqm) + "/sqm"}</span>
        </div>
        <div className="par-l-label">
          {isLive && result.basis === "listing" ? "Average asking price" : "Estimated value"} · {address} ({result.sqm} sqm)
        </div>
        <div className="par-l-value">{formatEUR(result.total)}</div>
        <div className="par-l-ron">≈ {formatRON(result.total * rateNum)} at {rateNum} RON/EUR</div>
        {vsCity !== null && (
          <span className={"par-l-chip" + (vsCity < 0 ? " down" : "")}>
            {vsCity >= 0 ? "+" : ""}{vsCity}% vs {result.cityLabel} average
          </span>
        )}
        <div className="par-l-sub">
          {result.liveFailed && "Live listings weren't available for this search, so this is the price-index estimate instead. "}
          {result.tier === "neighborhood" && "Matched to this district using published price bands — directional, not an exact index."}
          {result.tier === "city" && "Based on the published " + result.cityLabel + " city average (" + result.source + "). Add a district for a finer estimate where available."}
          {result.tier === "national" && "No city recognized, so this uses the national average (" + result.source + ")."}
          {isLive && result.basis === "sqm" && "Average price per sqm from real current sale listings on Imobiliare.ro, scaled to your size. Asking prices, not sale prices."}
          {isLive && result.basis === "listing" && "Listings had no usable size data, so this is the plain average asking price of the listings found — not scaled to your size."}
        </div>
        <div className="par-l-actions">
          <button className="par-l-btn" onClick={saveCurrent}><Icon d={ICONS.bookmark} size={16} />{isSaved ? "Saved" : "Save"}</button>
          <button className="par-l-btn" onClick={shareCurrent}><Icon d={ICONS.share} size={16} />Share</button>
          <button className="par-l-btn" onClick={toMortgage}><Icon d={ICONS.calcsmall} size={16} />Mortgage</button>
        </div>
      </div>
    );
  }

  /* ---------- tabs ---------- */
  const estimateTab = (
    <>
      <h1 className="par-title">What's it worth?</h1>
      <p className="par-sub">Real 2026 market data for Romanian cities — down to the district in Bucuresti and Cluj-Napoca.</p>
      <div className="par-card">
        <form onSubmit={runEstimate}>
          <div className="par-label">Address, district or city</div>
          <div className="par-row">
            <input
              className="par-input"
              placeholder="e.g. Militari, Bucuresti"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoCapitalize="words"
              autoCorrect="off"
              enterKeyHint="search"
            />
          </div>
          <div className="par-label">Size (sqm)</div>
          <div className="par-row" style={{ marginBottom: history.length ? 14 : 0 }}>
            <input className="par-input par-size" type="number" inputMode="numeric" min="10" max="1000" value={size} onChange={(e) => setSize(e.target.value)} />
            <button className="par-btn" type="submit" disabled={status === "loading"} style={{ flex: 1 }}>
              {status === "loading" ? "Working…" : "Get Estimate"}
            </button>
          </div>
        </form>
        {history.length > 0 && (
          <>
            <div className="par-label" style={{ marginTop: 4 }}>Recent</div>
            <div className="par-chips">
              {history.map((h) => (
                <button key={h} className="par-chip" onClick={() => setQuery(h)}>{h}</button>
              ))}
            </div>
          </>
        )}
      </div>
      {renderLedger()}
      <p className="par-note">
        Average asking prices from Storia.ro and Imobiliare.ro indices, multiplied by the size you enter — not a valuation
        of a specific property. Condition, floor and exact street can move a price a lot.
      </p>
    </>
  );

  const exploreTab = (
    <>
      <h1 className="par-title">Explore</h1>
      <p className="par-sub">Price per sqm, ranked. Tap any row to get an estimate for it.</p>
      <div className="par-seg">
        <button className={exploreView === "cities" ? "on" : ""} onClick={() => setExploreView("cities")}>All cities</button>
        <button className={exploreView === "bucuresti" ? "on" : ""} onClick={() => setExploreView("bucuresti")}>Bucuresti</button>
        <button className={exploreView === "cluj-napoca" ? "on" : ""} onClick={() => setExploreView("cluj-napoca")}>Cluj-Napoca</button>
      </div>
      <div className="par-card">
        {exploreRows.avg && <div className="par-legend"><i /> city average {formatEUR(exploreRows.avg)}/sqm</div>}
        {exploreRows.rows.map((r, idx) => (
          <button key={r.key} className="par-bar-row" onClick={() => openEstimate(r.open)}>
            <div className="par-bar-head">
              <div className="par-bar-name"><span>{idx + 1}</span>{r.name}</div>
              <div className="par-bar-val">{formatEUR(r.price)}</div>
            </div>
            <div className="par-bar-track">
              <div className="par-bar-fill" style={{ width: (r.price / exploreMax) * 100 + "%" }} />
              {exploreRows.avg && <div className="par-bar-tick" style={{ left: "calc(" + (exploreRows.avg / exploreMax) * 100 + "% - 1px)" }} />}
            </div>
          </button>
        ))}
      </div>
      <p className="par-note">
        Only Bucuresti and Cluj-Napoca have published district-level data. Other cities show a single city-wide figure.
      </p>
    </>
  );

  const savedTab = (
    <>
      <h1 className="par-title">Saved</h1>
      <p className="par-sub">Estimates you've kept. Stored on this device only.</p>
      {saved.length === 0 ? (
        <div className="par-blank">Nothing saved yet.<br />Run an estimate and tap Save.</div>
      ) : (
        saved.map((s) => (
          <div className="par-saved-item" key={s.id}>
            <button className="par-saved-main" onClick={() => reopenSaved(s)}>
              <div className="par-saved-addr">{s.address}</div>
              <div className="par-saved-meta">
                {TIER_STAMP[s.result.tier]} · {s.result.sqm} sqm · {new Date(s.date).toLocaleDateString()}
              </div>
              <div className="par-saved-val">{formatEUR(s.result.total)}</div>
            </button>
            <button className="par-iconbtn" aria-label="Delete" onClick={() => setSaved((prev) => prev.filter((x) => x.id !== s.id))}>
              <Icon d={ICONS.trash} size={18} />
            </button>
          </div>
        ))
      )}
    </>
  );

  const toolsTab = (
    <>
      <h1 className="par-title">Mortgage</h1>
      <p className="par-sub">See what a monthly payment could look like. Illustrative only — banks set their own rates and fees.</p>
      <div className="par-card">
        <div className="par-label">Property price (EUR)</div>
        <div className="par-row">
          <input className="par-input" type="number" inputMode="numeric" placeholder="e.g. 120000" value={mPrice} onChange={(e) => setMPrice(e.target.value)} />
          {result && <button className="par-btn par-btn-ghost" type="button" onClick={() => setMPrice(String(Math.round(result.total)))}>Use estimate</button>}
        </div>
        <div className="par-slider-head"><span className="par-label">Down payment</span><b>{mDown}%</b></div>
        <input className="par-slider" type="range" min="5" max="60" step="1" value={mDown} onChange={(e) => setMDown(Number(e.target.value))} />
        <div className="par-slider-head"><span className="par-label">Term</span><b>{mYears} years</b></div>
        <input className="par-slider" type="range" min="5" max="35" step="1" value={mYears} onChange={(e) => setMYears(Number(e.target.value))} />
        <div className="par-label">Interest rate (% per year)</div>
        <input className="par-input" type="number" inputMode="decimal" step="0.1" value={mRate} onChange={(e) => setMRate(e.target.value)} style={{ width: "100%", flex: "none" }} />
        <div className="par-help">The default rate is just an example — replace it with a real offer from your bank.</div>
      </div>
      <div className="par-ledger" style={{ animation: "none" }}>
        <div className="par-l-label">Estimated monthly payment</div>
        <div className="par-l-value">{mortgage ? formatEUR(mortgage.monthly) : "—"}</div>
        <div className="par-l-ron">{mortgage ? "≈ " + formatRON(mortgage.monthly * rateNum) + " per month" : "Enter a price to calculate"}</div>
        {mortgage && (
          <div className="par-stat-grid">
            <div className="par-stat"><span>Down payment</span><b>{formatEUR(mortgage.down)}</b></div>
            <div className="par-stat"><span>Loan amount</span><b>{formatEUR(mortgage.principal)}</b></div>
            <div className="par-stat"><span>Total interest</span><b>{formatEUR(mortgage.interest)}</b></div>
            <div className="par-stat"><span>Total repaid</span><b>{formatEUR(mortgage.total)}</b></div>
          </div>
        )}
      </div>
    </>
  );

  const tabs = [
    { id: "estimate", label: "Estimate", icon: ICONS.home },
    { id: "explore", label: "Explore", icon: ICONS.bars },
    { id: "saved", label: "Saved", icon: ICONS.bookmark },
    { id: "tools", label: "Mortgage", icon: ICONS.calc },
  ];

  return (
    <div className="par-root">
      <style>{CSS}</style>

      <div className="par-shell">
        <div className="par-top">
          <div className="par-brand">
            <div className="par-mark">P</div>
            <div className="par-brand-name">Plat &amp; Record</div>
          </div>
          <button className="par-iconbtn" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
            <Icon d={ICONS.sliders} size={20} />
          </button>
        </div>

        {tab === "estimate" && estimateTab}
        {tab === "explore" && exploreTab}
        {tab === "saved" && savedTab}
        {tab === "tools" && toolsTab}
      </div>

      <nav className="par-tabs">
        <div className="par-tabs-inner">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={"par-tab" + (tab === t.id ? " on" : "")}
              onClick={() => { setTab(t.id); window.scrollTo(0, 0); }}
            >
              <Icon d={t.icon} size={22} />
              {t.label}
              {t.id === "saved" && saved.length > 0 && <span className="par-badge">{saved.length}</span>}
            </button>
          ))}
        </div>
      </nav>

      {settingsOpen && (
        <div className="par-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="par-sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>
            <p className="par-sheet-sub">Everything here is stored on this device only.</p>

            <div className="par-field">
              <div className="par-label">EUR → RON rate</div>
              <input className="par-input" type="number" inputMode="decimal" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} style={{ width: "100%", flex: "none" }} />
              <div className="par-help">Used for the RON figures under prices. It's an approximation — update it to today's rate if you need precision.</div>
            </div>

            <div className="par-field">
              <div className="par-label">Live listings (optional)</div>
              <div className="par-row" style={{ marginBottom: 0 }}>
                <input
                  className="par-input"
                  type={showToken ? "text" : "password"}
                  placeholder="Apify API token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
                <button className="par-btn par-btn-ghost" type="button" onClick={() => setShowToken((s) => !s)}>{showToken ? "Hide" : "Show"}</button>
              </div>
              <div className="par-help">
                Add your own free Apify token (console.apify.com → Settings → API &amp; Integrations) to use real current
                listings from Imobiliare.ro instead of the price index. If a live search fails, the app falls back to the index automatically.
              </div>
            </div>

            <div className="par-field" style={{ display: "flex", gap: 8 }}>
              <button className="par-btn par-btn-danger" style={{ flex: 1 }} onClick={() => { setHistory([]); showToast("History cleared"); }}>Clear history</button>
              <button className="par-btn par-btn-danger" style={{ flex: 1 }} onClick={() => { setSaved([]); showToast("Saved list cleared"); }}>Clear saved</button>
            </div>

            <button className="par-btn" style={{ width: "100%" }} onClick={() => setSettingsOpen(false)}>Done</button>
            <p className="par-note">Made by Popescu Nicolae</p>
          </div>
        </div>
      )}

      {toast && <div className="par-toast">{toast}</div>}
    </div>
  );
}
