import React, { useState } from "react";

// ---------- real price-per-sqm data, sourced from Storia.ro and Imobiliare.ro
// market indices, 2026. Composite (new + resale) average asking price, EUR/sqm.
// Sources: Storia.ro city analysis (Feb 2026, Jul 2026 via Romania Insider),
// Imobiliare.ro residential index (mid-2026 via Romania Insider / Agerpres).
const CITY_PRICES = {
  "bucuresti": { price: 2260, label: "Bucuresti", slug: "bucuresti", asOf: "Jul 2026", source: "Storia + Imobiliare.ro composite" },
  "bucharest": { price: 2260, label: "Bucuresti", slug: "bucuresti", asOf: "Jul 2026", source: "Storia + Imobiliare.ro composite" },
  "cluj-napoca": { price: 3298, label: "Cluj-Napoca", slug: "cluj-napoca", asOf: "Jul 2026", source: "Storia.ro" },
  "cluj": { price: 3298, label: "Cluj-Napoca", slug: "cluj-napoca", asOf: "Jul 2026", source: "Storia.ro" },
  "brasov": { price: 2342, label: "Brasov", slug: "brasov", asOf: "Jul 2026", source: "Storia.ro" },
  "timisoara": { price: 1941, label: "Timisoara", slug: "timisoara", asOf: "Feb 2026", source: "Storia.ro" },
  "iasi": { price: 1764, label: "Iasi", slug: "iasi", asOf: "Feb 2026", source: "Storia.ro" },
  "oradea": { price: 1831, label: "Oradea", slug: "oradea", asOf: "Feb 2026", source: "Storia.ro" },
  "sibiu": { price: 1938, label: "Sibiu", slug: "sibiu", asOf: "Feb 2026", source: "Storia.ro" },
  "constanta": { price: 2085, label: "Constanta", slug: "constanta", asOf: "Feb 2026", source: "Storia.ro" },
  "craiova": { price: 2067, label: "Craiova", slug: "craiova", asOf: "Feb 2026", source: "Storia.ro" },
  "ploiesti": { price: 1413, label: "Ploiesti", slug: "ploiesti", asOf: "mid-2026", source: "Imobiliare.ro (new-build)" },
};
const NATIONAL_AVG = { price: 2033, label: "Romania (national average)", asOf: "May 2026", source: "Imobiliare.ro national index" };

// ---------- Per-city neighborhood tiers ----------
// Only cities with real, findable district-level reporting get an entry here.
// No published per-neighborhood EUR/sqm index exists for most Romanian cities,
// so cities not listed below (Timisoara, Iasi, Brasov, Constanta, Craiova, Sibiu,
// Oradea, Ploiesti) use their flat city-wide average instead — that's a real
// data gap, not an oversight.
const NEIGHBORHOODS = {
  // Bucuresti: triangulated from Investropa's RON/sqm bands for premium districts
  // (RON 18,000-34,000/sqm) vs budget districts (RON 5,800-10,500/sqm), converted
  // at ~5 RON/EUR, cross-checked against bucharest.ro's 2026 rent survey. Directional.
  "bucuresti": {
    "primaverii": 5200, "herastrau": 4800, "floreasca": 4400, "dorobanti": 4600,
    "aviatorilor": 4600, "baneasa": 3400, "pipera": 3200,
    "aviatiei": 3400, "cotroceni": 3100, "unirii": 3000, "victoriei": 2900,
    "romana": 2900, "stefan": 2600, "tei": 2500,
    "titan": 2100, "dristor": 2100, "tineretului": 2200, "vitan": 2000,
    "militari": 1600, "berceni": 1550, "rahova": 1500, "giurgiului": 1550,
    "pantelimon": 1600, "colentina": 1650, "ferentari": 1450, "taberei": 1650,
    "crangasi": 1700, "giulesti": 1650, "grivita": 1750,
  },
  // Cluj-Napoca: premium tier from Investropa's RON 16,500-23,000/sqm central band
  // (~EUR 3,300-4,600, converted at ~5 RON/EUR); budget tier anchored on Imo360's
  // reported EUR 1,064-3,741/sqm citywide range plus ClujXYZ's Floresti figure.
  "cluj-napoca": {
    "centru": 3900, "central": 3900, "muresanu": 4000, "plopilor": 3900, "gheorgheni": 3600,
    "zorilor": 3300, "grigorescu": 3300, "hasdeu": 3300,
    "marasti": 2900, "lacuri": 2900,
    "manastur": 2300, "iris": 2200, "dambul": 2100,
    "floresti": 1550,
  },
};

const DIACRITICS = { ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t" };
function stripDiacritics(s) {
  return s.toLowerCase().split("").map((c) => DIACRITICS[c] || c).join("");
}

const CITY_WORDS = new Set([
  "bucuresti", "bucharest", "cluj-napoca", "cluj", "napoca", "brasov", "timisoara",
  "iasi", "oradea", "sibiu", "constanta", "craiova", "ploiesti", "romania", "ro",
]);

function resolveNeighborhood(cleanedText, citySlug) {
  const table = NEIGHBORHOODS[citySlug];
  if (!table) return null;
  // Strip out city/country words first so a bare city name can never itself
  // register as a neighborhood match.
  const remaining = cleanedText
    .split(/[\s,]+/)
    .filter((w) => w && !CITY_WORDS.has(w))
    .join(" ");
  if (!remaining.trim()) return null;

  for (const key of Object.keys(table)) {
    const re = new RegExp(`(^|[^a-z])${key}([^a-z]|$)`);
    if (re.test(remaining)) return { key, price: table[key] };
  }
  return null;
}

function resolveCity(raw) {
  const cleaned = stripDiacritics(raw.replace(/\bromania\b/gi, "").replace(/\bro\b/gi, ""));
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  // check parts from last to first (city usually comes after street)
  for (let i = parts.length - 1; i >= 0; i--) {
    const words = parts[i].split(/\s+/);
    // try the whole part joined with hyphen, then each word alone
    const joined = words.join("-");
    if (CITY_PRICES[joined]) return CITY_PRICES[joined];
    for (const w of words) {
      if (CITY_PRICES[w]) return CITY_PRICES[w];
    }
  }
  return null;
}

function formatEUR(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export default function PlatAndRecord() {
  const [query, setQuery] = useState("");
  const [size, setSize] = useState(55);
  const [status, setStatus] = useState("idle"); // idle | done
  const [result, setResult] = useState(null);
  const [stampKey, setStampKey] = useState(0);
  const [fetchedFor, setFetchedFor] = useState("");

  function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    const sqm = Number(size) > 0 ? Number(size) : 55;
    const cleaned = stripDiacritics(query.replace(/\bromania\b/gi, "").replace(/\bro\b/gi, ""));
    const cityMatch = resolveCity(query);
    const neighborhood = cityMatch ? resolveNeighborhood(cleaned, cityMatch.slug) : null;

    let cityData, tier;
    if (neighborhood) {
      cityData = {
        price: neighborhood.price,
        label: `${cityMatch.label} — ${neighborhood.key}`,
        asOf: "2026 (triangulated)",
        source: "district price bands, per-city sourcing (see notes)",
      };
      tier = "neighborhood";
    } else if (cityMatch) {
      cityData = cityMatch;
      tier = "city";
    } else {
      cityData = NATIONAL_AVG;
      tier = "national";
    }

    setResult({
      cityData,
      tier,
      sqm,
      total: cityData.price * sqm,
    });
    setFetchedFor(query);
    setStatus("done");
    setStampKey((k) => k + 1);
  }

  return (
    <div className="par-root">
      <style>{`
        .par-root {
          --bg: #0e1b2c; --panel: #12233a; --line: #2c4a66; --cyan: #5cc8de;
          --cyan-dim: #2f5a68; --gold: #cda352; --ink-red: #b5432b; --text: #eef1f5;
          --muted: #8ea0b6; --paper: #e9e2cd; --paper-text: #2a2013;
          background: var(--bg); color: var(--text);
          font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
          padding: 28px 20px 36px; min-height: 100%; box-sizing: border-box;
          background-image: linear-gradient(var(--line) 1px, transparent 1px),
            linear-gradient(90deg, var(--line) 1px, transparent 1px);
          background-size: 28px 28px; background-position: -1px -1px;
        }
        .par-root * { box-sizing: border-box; }
        .par-header { max-width: 640px; margin: 0 auto 22px; }
        .par-eyebrow {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px;
          letter-spacing: 0.18em; color: var(--cyan); text-transform: uppercase; margin-bottom: 6px;
        }
        .par-title {
          font-family: Georgia, "Iowan Old Style", serif; font-size: 28px; font-weight: 700;
          letter-spacing: 0.01em; margin: 0 0 6px;
        }
        .par-sub { color: var(--muted); font-size: 14px; max-width: 520px; line-height: 1.5; margin: 0; }
        .par-panel {
          max-width: 640px; margin: 0 auto; background: var(--panel);
          border: 1px solid var(--line); border-radius: 4px; padding: 18px;
        }
        .par-row { display: flex; gap: 8px; margin-bottom: 10px; }
        .par-input {
          flex: 1; background: #0c1826; border: 1px solid var(--line); color: var(--text);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px;
          padding: 10px 12px; border-radius: 3px; outline: none;
        }
        .par-input:focus { border-color: var(--cyan); }
        .par-input::placeholder { color: var(--muted); }
        .par-size-input { width: 90px; flex: none; }
        .par-field-label {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px;
          letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px;
        }
        .par-btn {
          background: var(--cyan-dim); border: 1px solid var(--cyan); color: var(--text);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
          letter-spacing: 0.05em; text-transform: uppercase; padding: 0 16px;
          border-radius: 3px; cursor: pointer; transition: background 0.15s ease;
        }
        .par-btn:hover { background: var(--cyan); color: #06141f; }
        .par-hint { font-size: 11px; color: var(--muted); margin: 0 0 16px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; line-height: 1.5; }
        .par-ledger {
          background: var(--paper); color: var(--paper-text); border-radius: 2px;
          padding: 20px 22px; position: relative; overflow: hidden;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .par-ledger::before { content: ""; position: absolute; inset: 6px; border: 1px dashed #8d8262; pointer-events: none; }
        .par-ledger-top {
          display: flex; justify-content: space-between; font-size: 10px;
          letter-spacing: 0.08em; text-transform: uppercase; color: #6b6248; margin-bottom: 14px;
        }
        .par-ledger-label { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #6b6248; margin-bottom: 4px; }
        .par-ledger-value { font-family: Georgia, serif; font-size: 38px; font-weight: 700; color: #1c3a2b; line-height: 1; }
        .par-ledger-sub { font-size: 12px; color: #5a5237; margin-top: 8px; line-height: 1.5; }
        .par-ledger-empty { display: flex; flex-direction: column; gap: 4px; }
        .par-ledger-empty-text { font-size: 12px; color: #5a5237; }
        .par-stamp {
          position: absolute; top: 14px; right: 18px; font-family: Georgia, serif; font-weight: 700;
          font-size: 12px; letter-spacing: 0.08em; color: var(--ink-red); border: 2px solid var(--ink-red);
          padding: 4px 10px; border-radius: 3px; transform: rotate(-8deg) scale(1.3); opacity: 0;
          animation: par-stamp-in 0.4s ease-out 0.05s forwards;
        }
        @keyframes par-stamp-in {
          0% { opacity: 0; transform: rotate(-8deg) scale(2.2); }
          60% { opacity: 1; transform: rotate(-8deg) scale(0.95); }
          100% { opacity: 0.92; transform: rotate(-8deg) scale(1); }
        }
        .par-note { max-width: 640px; margin: 14px auto 0; font-size: 11px; color: var(--muted); text-align: center; }
        @media (prefers-reduced-motion: reduce) {
          .par-stamp { animation: none; opacity: 0.92; transform: rotate(-8deg) scale(1); }
        }
      `}</style>

      <div className="par-header">
        <div className="par-eyebrow">Plat &amp; Record — Romania City Index</div>
        <h1 className="par-title">Real market data, by city.</h1>
        <p className="par-sub">
          Uses actual published price-per-sqm figures from Storia.ro and Imobiliare.ro's
          2026 market indices for Romania's major cities.
        </p>
      </div>

      <div className="par-panel">
        <form className="par-row" onSubmit={handleSearch}>
          <input
            className="par-input"
            placeholder="e.g. Matei Basarab 90, Bucuresti"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <div className="par-field-label">Approx. size (sqm)</div>
        <div className="par-row">
          <input
            className="par-input par-size-input"
            type="number"
            min="10"
            max="1000"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
          <button className="par-btn" type="button" onClick={handleSearch}>Get Estimate</button>
        </div>
        <div className="par-hint">
          Bucuresti and Cluj-Napoca have real neighborhood-level breakdowns (e.g. Militari,
          Herastrau, Titan for Bucuresti; Manastur, Gheorgheni, Floresti for Cluj-Napoca) —
          mention a district and you'll get that instead of the flat city average. Other
          cities (Timisoara, Iasi, Brasov, Constanta, Craiova, Sibiu, Oradea, Ploiesti) don't
          have a published per-neighborhood index anywhere, so they use their city-wide figure.
        </div>

        {status === "idle" && (
          <div className="par-ledger par-ledger-empty">
            <div className="par-ledger-label">No estimate yet</div>
            <div className="par-ledger-empty-text">Enter an address and press Get Estimate.</div>
          </div>
        )}

        {status === "done" && result && (
          <div className="par-ledger" key={stampKey}>
            <div className="par-stamp">
              {result.tier === "neighborhood" ? "NEIGHBORHOOD" : result.tier === "city" ? "CITY INDEX" : "NATIONAL AVG"}
            </div>
            <div className="par-ledger-top">
              <span>{result.cityData.label}</span>
              <span>{formatEUR(result.cityData.price)}/sqm · {result.cityData.asOf}</span>
            </div>
            <div className="par-ledger-label">Estimated value, {fetchedFor} ({result.sqm} sqm)</div>
            <div className="par-ledger-value">{formatEUR(result.total)}</div>
            <div className="par-ledger-sub">
              {result.tier === "neighborhood" &&
                `Matched to the "${result.cityData.label.split("— ")[1]}" district — triangulated from published price bands for ${result.cityData.label.split("— ")[0].trim()}, not an exact index.`}
              {result.tier === "city" &&
                `Based on ${result.cityData.label}'s published city-average asking price (${result.cityData.source}). No specific neighborhood recognized in your address.`}
              {result.tier === "national" &&
                `No specific city recognized — used Romania's national average asking price (${result.cityData.source}) instead.`}
            </div>
          </div>
        )}
      </div>

      <p className="par-note">
        City-level average asking prices from real market data, multiplied by an approximate size
        you provide — not an address-specific valuation. Actual property values vary by
        neighborhood, condition, and floor within any city.
      </p>
      <p className="par-note" style={{ marginTop: 6, opacity: 0.7 }}>
        Made by Popescu Nicolae
      </p>
    </div>
  );
}
