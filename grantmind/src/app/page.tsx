"use client";

import { useState, useMemo, useEffect } from "react";
import { useReadContract, useReadContracts, useConnect, useAccount, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { formatUnits } from "viem";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { grantRegistryAbi } from "@/lib/abis/GrantRegistry";
import Link from 'next/link';
import styles from './Home.module.css';

type Proposal = {
  index: number;
  applicant: string;
  title: string;
  description: string;
  requestedAmount: bigint;
  recipientWallet: string;
  referenceLinks: string[];
  exists: boolean;
  aiReviewed: boolean;
  aiScore: number;
  aiSummary: string;
  category: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  "Infrastructure":    "#4ade80",
  "ZKP Research":      "#a78bfa",
  "Developer Tooling": "#38bdf8",
  "DAO Governance":    "#fb923c",
  "General":           "#8888aa",
};

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  // ── Contract reads ────────────────────────────────────────────
  const { data: nextIdData } = useReadContract({
    address: CONTRACT_ADDRESSES.grantRegistry as `0x${string}`,
    abi: grantRegistryAbi,
    functionName: "nextProposalId",
  });

  const nextProposalId = nextIdData ? Number(nextIdData) : 1;
  const proposalIds = Array.from({ length: nextProposalId - 1 }, (_, i) => i + 1);

  const { data: proposalsData, isLoading } = useReadContracts({
    contracts: proposalIds.map((id) => ({
      address: CONTRACT_ADDRESSES.grantRegistry as `0x${string}`,
      abi: grantRegistryAbi,
      functionName: "getProposal",
      args: [BigInt(id)],
    })),
  });

  const proposals: Proposal[] = useMemo(() => {
    if (!proposalsData) return [];
    return (proposalsData as unknown as { status: string; result: unknown }[])
      .filter((res) => res.status === "success" && !!res.result)
      .map((res, index) => {
        const raw = res.result as {
          applicant: string; title: string; description: string;
          requestedAmount: bigint; recipientWallet: string;
          referenceLinks: string[]; exists: boolean;
          aiReviewed: boolean; aiScore: number; aiSummary: string;
        };
        let category = "General";
        const catMatch = raw.description.match(/\[Category:\s*(.+?)\]/i);
        if (catMatch?.[1]) category = catMatch[1].trim();
        return { index: index + 1, category, ...raw };
      })
      .sort((a, b) => b.aiScore - a.aiScore);
  }, [proposalsData]);

  const liveTop3 = proposals.slice(0, 3);
  const tableTop  = proposals.slice(0, 5);

  if (!mounted) return null;

  return (
    <main className={styles.main}>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <p className={styles.heroEyebrow}>// POWERED BY POLKADOT HUB</p>
          <h1 className={styles.heroHeadline}>
            <span className={styles.heroWhite}>AI-POWERED</span>
            <span className={styles.heroPurple}>DAO GRANT</span>
            <span className={styles.heroWhite}>ALLOCATION</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Revolutionizing community distribution through autonomous evaluation
            and transparent treasury logic. Verified by intelligence.
          </p>
          <div className={styles.walletBtns}>
            {isConnected ? (
              <button className={styles.walletBtnActive} onClick={() => disconnect()}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>account_balance_wallet</span>
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </button>
            ) : (
              <>
                <button
                  className={styles.walletBtn}
                  onClick={() => connect({ connector: injected() })}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>account_balance_wallet</span>
                  METAMASK
                </button>
                <button
                  className={`${styles.walletBtn} ${styles.walletBtnOutline}`}
                  onClick={() => connect({ connector: injected() })}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>link</span>
                  WALLETCONNECT
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live preview panel */}
        <div className={styles.livePanel}>
          <div className={styles.livePanelHeader}>
            <div className={styles.trafficDots}>
              <span className={styles.dotRed} />
              <span className={styles.dotYellow} />
              <span className={styles.dotGreen} />
            </div>
            <span className={styles.livePanelTitle}>LIVE PREVIEW // AUTONOMOUS_AGENT</span>
          </div>
          <div className={styles.livePanelBody}>
            {isLoading ? (
              [1,2,3].map(n => (
                <div key={n} className={styles.liveRow}>
                  <div className={`${styles.liveSkBar} ${styles.liveSkShort}`} />
                  <div className={`${styles.liveSkBar} ${styles.liveSkLong}`} style={{ flex: 1 }} />
                  <div className={`${styles.liveSkBar} ${styles.liveSkShort}`} />
                </div>
              ))
            ) : liveTop3.length === 0 ? (
              <p className={styles.liveEmpty}>No proposals yet.</p>
            ) : liveTop3.map((p, i) => (
              <Link key={p.index} href={`/proposals/${p.index}`} className={styles.liveRow}>
                <div className={styles.liveRowLeft}>
                  <span className={styles.liveId}>#GM-{String(p.index).padStart(3, '0')}</span>
                  <span className={styles.liveName}>{p.title.toUpperCase()}</span>
                </div>
                <div className={styles.liveRowRight}>
                  <span className={styles.liveAmount}>
                    {Number(formatUnits(p.requestedAmount, 18)).toLocaleString()} PAS
                  </span>
                  <div className={styles.liveScoreRow}>
                    <div className={styles.liveScoreTrack}>
                      <div
                        className={styles.liveScoreFill}
                        style={{ width: p.aiReviewed ? `${p.aiScore}%` : '0%' }}
                      />
                    </div>
                    <span className={styles.liveScoreLabel}>
                      {p.aiReviewed ? `AI SCORE ${p.aiScore}%` : 'PENDING'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOP PROPOSALS TABLE ─────────────────────────────────── */}
      <section className={styles.tableSection}>
        <div className={styles.tableSectionHeader}>
          <h2 className={styles.tableSectionTitle}>TOP PROPOSALS</h2>
          <span className={styles.viewAll}>VIEW ALL: DATASETS</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.thead}>
                <th className={styles.th}>PROPOSAL ID</th>
                <th className={styles.th}>PROJECT NAME</th>
                <th className={styles.th}>CATEGORY</th>
                <th className={styles.th}>FUNDING REQUEST</th>
                <th className={styles.th}>AI SCORE</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1,2,3].map(n => (
                  <tr key={n} className={styles.skeletonRow}>
                    {[1,2,3,4,5].map(c => (
                      <td key={c} className={styles.skeletonCell}>
                        <div className={`${styles.skBar} ${c === 2 ? styles.skLong : styles.skMed}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tableTop.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className={styles.emptyState}>
                      <span className={`material-symbols-outlined ${styles.emptyIcon}`}>inbox</span>
                      <p className={styles.emptyTitle}>No Proposals Found</p>
                      <p className={styles.emptyDesc}>No proposals have been submitted yet.</p>
                      <Link href="/submit" className={styles.emptyLink}>Submit a Proposal →</Link>
                    </div>
                  </td>
                </tr>
              ) : tableTop.map((p) => {
                const catColor = CATEGORY_COLORS[p.category] ?? '#8888aa';
                return (
                  <tr key={p.index} className={styles.tr}>
                    <td className={styles.td}>
                      <span className={styles.proposalId}>#GM-{String(p.index).padStart(3, '0')}</span>
                    </td>
                    <td className={styles.td}>
                      <Link href={`/proposals/${p.index}`} className={styles.projectName}>
                        {p.title.toUpperCase()}
                      </Link>
                    </td>
                    <td className={styles.td}>
                      <span
                        className={styles.catBadge}
                        style={{ color: catColor, borderColor: catColor, background: `${catColor}18` }}
                      >
                        {p.category.slice(0, 5).toUpperCase()}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.funding}>
                        {Number(formatUnits(p.requestedAmount, 18)).toLocaleString()} PAS
                      </span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.scoreCell}>
                        <div className={styles.scoreTrack}>
                          <div
                            className={styles.scoreFill}
                            style={{ width: p.aiReviewed ? `${p.aiScore}%` : '0%' }}
                          />
                        </div>
                        <span className={styles.scorePct}>
                          {p.aiReviewed ? `${p.aiScore}%` : '--'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── ANALYTICS CARDS ────────────────────────────────────── */}
      <div className={styles.analyticsGrid}>
        <div className={styles.analyticsCard}>
          <span className={`material-symbols-outlined ${styles.analyticsIcon}`}>analytics</span>
          <h3 className={styles.analyticsTitle}>AI Accuracy</h3>
          <p className={styles.analyticsDesc}>
            Current model confidence interval: 94.2%. Scored against 1,200+ historical data points using decentralized compute clusters.
          </p>
        </div>
        <div className={styles.analyticsCard}>
          <span className={`material-symbols-outlined ${styles.analyticsIcon}`}>monitoring</span>
          <h3 className={styles.analyticsTitle}>Network Health</h3>
          <p className={styles.analyticsDesc}>
            Grant treasury currently distributing $4.2M across active workstreams with real-time milestone verification.
          </p>
        </div>
        <div className={styles.analyticsCard}>
          <span className={`material-symbols-outlined ${styles.analyticsIcon}`}>security</span>
          <h3 className={styles.analyticsTitle}>Secure Eval</h3>
          <p className={styles.analyticsDesc}>
            Encrypted proposal submission system with zero-knowledge verification protocols ensuring contributor privacy.
          </p>
        </div>
      </div>

    </main>
  );
}