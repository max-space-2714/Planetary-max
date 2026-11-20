import React, { useState } from "react";
import { HUB_MODULES, type HubModuleId } from "../shared/hubModules";

type ModuleKey =
  | "max-spaces"
  | "max-sports"
  | "max-chess"
  | "max-art"
  | "max-games"
  | "max-media"
  | HubModuleId;

const MODULES: Record<
  ModuleKey,
  {
    tab: string;
    title: string;
    mode: string;
    summary: string;
  }
> = {
  ...Object.fromEntries(HUB_MODULES.map(module => [module.id, {tab: module.title, title: `${module.title} Output`, mode: "OUTPUT-ONLY PREVIEW", summary: module.summary}])) as Record<HubModuleId, {tab: string; title: string; mode: string; summary: string}>,
  "max-spaces": {
    tab: "MAX-SPACES",
    title: "MAX-SPACES Output",
    mode: "OUTPUT-ONLY • MAX-INTERNET",
    summary:
      "Public MAX-INTERNET space output with 0.000000 MAX Compute and wallet-free preview access.",
  },
  "max-sports": {
    tab: "MAX-SPORTS",
    title: "MAX-SPORTS Output",
    mode: "FREE PREVIEW / OPT-IN USDC",
    summary:
      "Free usage within limit at 0.000000 MAX Compute; staked wagers or P2P require explicit Base (8453) USDC opt-in.",
  },
  "max-chess": {
    tab: "MAX-CHESS",
    title: "MAX-CHESS Output & Play",
    mode: "FREE PLAY / OPT-IN USDC",
    summary:
      "Free chess and pre-limit chess outputs at 0.000000 MAX Compute; wagers or paid outputs require opt-in Base (8453) USDC.",
  },
  "max-art": {
    tab: "MAX-ART",
    title: "MAX-ART Output",
    mode: "OUTPUT-ONLY PREVIEW",
    summary:
      "Visual art output preview backed by /assets/crown-cover.png (image/png).",
  },
  "max-games": {
    tab: "MAX-GAMES",
    title: "MAX-GAMES Output",
    mode: "FREE LIMIT / OPT-IN USDC",
    summary:
      "Free game/preview access before limits with 0.000000 MAX Compute; paid tiers or stakes require Base (8453) USDC opt-in.",
  },
  "max-media": {
    tab: "MAX-MEDIA",
    title: "MAX-MEDIA Output",
    mode: "OUTPUT-ONLY STREAM",
    summary:
      "Scoped media output slot with MAX Compute locked at 0.000000 and no operator console exposure.",
  },
};

export const BeemaxUnifiedOutputHub: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleKey>("max-spaces");
  const [optInBaseUsdc, setOptInBaseUsdc] = useState(false);
  const [tier, setTier] = useState<"free" | "usdc">("free");

  const current = MODULES[activeModule];

  return (
    <section
      aria-label="BEEMAX Output Hub"
      style={{
        background: "#070b14",
        color: "#e2e8f0",
        border: "1px solid #1e293b",
        borderRadius: 12,
        padding: 16,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          borderBottom: "1px solid #1e293b",
          paddingBottom: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: "#f8fafc" }}>
            BEEMAX Output Hub
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
            MAX Compute: <strong style={{ color: "#22c55e" }}>0.000000</strong> • Base USDC
            (8453) • Outputs Only
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOptInBaseUsdc((prev) => !prev)}
          style={{
            background: optInBaseUsdc ? "#0f291e" : "#111827",
            color: optInBaseUsdc ? "#4ade80" : "#e2e8f0",
            border: `1px solid ${optInBaseUsdc ? "#22c55e" : "#334155"}`,
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {optInBaseUsdc
            ? "Opted In: Base (8453) USDC"
            : "Opt In to BEEMAX (Base 8453)"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button
          type="button"
          onClick={() => setTier("free")}
          style={{
            background: tier === "free" ? "#0c2d48" : "#0e1525",
            color: tier === "free" ? "#7dd3fc" : "#cbd5e1",
            border: `1px solid ${tier === "free" ? "#38bdf8" : "#1e293b"}`,
            borderRadius: 8,
            padding: "7px 11px",
            fontSize: 12,
            fontWeight: tier === "free" ? 700 : 500,
            cursor: "pointer",
          }}
        >
          Free Output Preview (0.000000 USDC)
        </button>
        <button
          type="button"
          onClick={() => setTier("usdc")}
          style={{
            background: tier === "usdc" ? "#0c2d48" : "#0e1525",
            color: tier === "usdc" ? "#7dd3fc" : "#cbd5e1",
            border: `1px solid ${tier === "usdc" ? "#38bdf8" : "#1e293b"}`,
            borderRadius: 8,
            padding: "7px 11px",
            fontSize: 12,
            fontWeight: tier === "usdc" ? 700 : 500,
            cursor: "pointer",
          }}
        >
          Approved Base USDC Output Tiers
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {(Object.keys(MODULES) as ModuleKey[]).map((key) => {
          const item = MODULES[key];
          const isSelected = activeModule === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveModule(key)}
              style={{
                background: isSelected ? "#132238" : "#0e1525",
                color: isSelected ? "#f8fafc" : "#94a3b8",
                border: `1px solid ${isSelected ? "#38bdf8" : "#1e293b"}`,
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: isSelected ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {item.tab}
            </button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 12,
          background: "#0e1525",
          border: "1px solid #1e293b",
          borderRadius: 10,
          padding: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <strong style={{ color: "#f8fafc", fontSize: 15 }}>
            {current.title}
          </strong>
          <span
            style={{
              fontSize: 11,
              color: "#38bdf8",
              background: "#09192c",
              border: "1px solid #1d4ed8",
              borderRadius: 999,
              padding: "2px 8px",
            }}
          >
            {current.mode}
          </span>
        </div>

        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#cbd5e1" }}>
          {current.summary}
        </p>

        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#94a3b8" }}>
          Active Tier: {" "}
          {tier === "free"
            ? "Free Output Preview (0.000000 USDC) • No wallet required"
            : optInBaseUsdc
            ? "Base USDC Output Tier (catalog prices on Base 8453, 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)"
            : "Select Opt In to BEEMAX (Base 8453) to use an approved output tier"}
        </p>


      </div>
    </section>
  );
};

export default BeemaxUnifiedOutputHub;
