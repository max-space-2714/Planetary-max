import React, { useState } from "react";
import BeemaxSpaceConcierge from "../components/BeemaxSpaceConcierge";
import "../components/BeemaxSpaceConcierge.css";

export const LandingEntry: React.FC = () => {
  const [optedIn, setOptedIn] = useState(false);
  const [selectedTier, setSelectedTier] = useState<"free" | "base-usdc">("free");

  return (
    <div className="beemax-entry">
      <div className="beemax-entry-inner">
        <section aria-label="BEEMAX Public Entry" className="beemax-entry-card">
          <div className="beemax-entry-header">
            <div>
              <span className="beemax-eyebrow">BEEMAX / MAX-INTERNET</span>
              <h1>BEEMAX • MAX-INTERNET Entry</h1>
            </div>
            <button
              className="beemax-opt-in"
              type="button"
              aria-pressed={optedIn}
              onClick={() => { setOptedIn((prev) => !prev); setSelectedTier("free"); }}
            >
              {optedIn ? "Opted In (Base 8453)" : "Opt In to BEEMAX (Base 8453)"}
            </button>
          </div>

          <div className="beemax-metadata" aria-label="BEEMAX access status">
            <span>MAX Compute: <strong>0.000000</strong></span>
            <span>Base USDC (8453)</span>
            <span>Outputs Only</span>
            <span>Zero-Write GET /</span>
            <span>write_performed: false</span>
          </div>

          <div className="beemax-tier-heading">
            <span className="beemax-eyebrow">OUTPUT ACCESS</span>
          </div>
          <div className="beemax-tier-grid">
            <button
              className="beemax-tier"
              type="button"
              aria-pressed={selectedTier === "free"}
              onClick={() => setSelectedTier("free")}
            >
              <span className="beemax-tier-indicator" aria-hidden="true" />
              <span>Free Output Preview (0.000000 USDC)</span>
            </button>
            <button
              className="beemax-tier"
              type="button"
              aria-pressed={selectedTier === "base-usdc"}
              disabled={!optedIn}
              onClick={() => setSelectedTier("base-usdc")}
            >
              <span className="beemax-tier-indicator" aria-hidden="true" />
              <span>Base USDC Output Tier (1.000000 USDC)</span>
            </button>
          </div>
          <div className="beemax-tier-note">
            {selectedTier === "free"
              ? "Active: 0.000000 USDC free preview • Wallet-free browsing & pre-limit previews for MAX-ART, MAX-GAMES, MAX-CHESS, MAX-SPORTS, MAX-MEDIA & MAX-SPACES • MAX Compute: 0.000000"
              : optedIn
              ? "Active: Opt-in Base Mainnet (8453) native USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) • Outputs Only"
              : "Opt in to BEEMAX (Base 8453) first to select the 1.000000 USDC tier; free previews stay available at 0.000000 USDC."}
          </div>
        </section>
        <BeemaxSpaceConcierge optedInBaseUsdc={optedIn} />
      </div>
    </div>
  );
};

export default LandingEntry;
