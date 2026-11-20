import React, { useState } from "react";
import BeemaxSpaceConcierge from "../components/BeemaxSpaceConcierge";

export const LandingEntry: React.FC = () => {
  const [optedIn, setOptedIn] = useState(false);
  const [selectedTier, setSelectedTier] = useState<"free" | "base-usdc">("free");

  return (
    <section
      style={{
        background: "#070b14",
        color: "#e2e8f0",
        minHeight: "100vh",
        padding: 20,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 840, margin: "0 auto" }}>
        <section
          aria-label="BEEMAX Public Entry"
          style={{
            background: "#0e1525",
            border: "1px solid #1e293b",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 20, color: "#f8fafc" }}>
                BEEMAX • MAX-INTERNET Entry
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#94a3b8" }}>
                MAX Compute: <strong style={{ color: "#22c55e" }}>0.000000</strong> • Base USDC
                (8453) • Outputs Only • Zero-Write GET / • write_performed: false
              </p>
            </div>

            <button
              type="button"
              aria-pressed={optedIn}
              onClick={() => { setOptedIn((prev) => !prev); setSelectedTier("free"); }}
              style={{
                background: optedIn ? "#0f291e" : "#111827",
                color: optedIn ? "#4ade80" : "#e2e8f0",
                border: `1px solid ${optedIn ? "#22c55e" : "#334155"}`,
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {optedIn ? "Opted In (Base 8453)" : "Opt In to BEEMAX (Base 8453)"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button
              type="button"
              aria-pressed={selectedTier === "free"}
              onClick={() => setSelectedTier("free")}
              style={{
                background: selectedTier === "free" ? "#0c2d48" : "#070b14",
                color: selectedTier === "free" ? "#7dd3fc" : "#cbd5e1",
                border: `1px solid ${selectedTier === "free" ? "#38bdf8" : "#1e293b"}`,
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: selectedTier === "free" ? 700 : 500,
                cursor: "pointer",
              }}
            >
              Free Output Preview (0.000000 USDC)
            </button>

            <button
              type="button"
              aria-pressed={selectedTier === "base-usdc"}
              disabled={!optedIn}
              onClick={() => setSelectedTier("base-usdc")}
              style={{
                background: selectedTier === "base-usdc" ? "#0c2d48" : "#070b14",
                color: selectedTier === "base-usdc" ? "#7dd3fc" : "#cbd5e1",
                border: `1px solid ${selectedTier === "base-usdc" ? "#38bdf8" : "#1e293b"}`,
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: selectedTier === "base-usdc" ? 700 : 500,
                cursor: "pointer",
              }}
            >
              Approved Base USDC Output Tiers
            </button>
          </div>

          <div
            style={{
              marginTop: 14,
              background: "#070b14",
              border: "1px solid #1e293b",
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              color: "#cbd5e1",
            }}
          >
            {selectedTier === "free"
              ? "Active: 0.000000 USDC free preview • Wallet-free browsing & pre-limit previews for MAX-ART, MAX-GAMES, MAX-CHESS, MAX-SPORTS, MAX-MEDIA & MAX-SPACES • MAX Compute: 0.000000"
              : optedIn
              ? "Active: Opt-in Base Mainnet (8453) native USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) • Outputs Only"
              : "Opt in to BEEMAX (Base 8453) first to select an approved output tier; free previews stay available at 0.000000 USDC."}
          </div>
        </section>
        <BeemaxSpaceConcierge optedInBaseUsdc={optedIn} />
      </div>
    </section>
  );
};

export default LandingEntry;
