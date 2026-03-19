"use client";

import { useState, useMemo, useEffect } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { grantRegistryAbi } from "@/lib/abis/GrantRegistry";
import Link from "next/link";
import styles from "./Leaderboard.module.css";

type Proposal = {
  index: number;
  title: string;
  description: string;
  requestedAmount: bigint;
  exists: boolean;
  aiReviewed: boolean;
  aiScore: number;
  aiSummary: string;
  category: string;
};

type StatusInfo = { label: string; color: "green" | "gray" | "amber" };

function getStatus(p: Proposal): StatusInfo {
  if (!p.aiReviewed) return { label: "PENDING", color: "gray" };
  if (p.aiScore >= 75) return { label: "UNDER REVIEW", color: "green" };
  if (p.aiScore >= 50) return { label: "UNDER REVIEW", color: "green" };
  return { label: "ACTION REQUIRED", color: "amber" };
}

const FILTERS = ["ALL", "INFRASTRUCTURE", "TOOLING", "DEFI", "SOCIAL"];

export default function LeaderboardPage() {
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [time, setTime] = useState("");

  useEffect(() => {
    setMounted(true);
    const tick = () =>
      setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

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
      .filter((r) => r.status === "success" && !!r.result)
      .map((r, i) => {
        const raw = r.result as {
          title: string; description: string; requestedAmount: bigint;
          exists: boolean; aiReviewed: boolean; aiScore: number; aiSummary: string;
        };
        let category = "GENERAL";
        const m = raw.description.match(/\[Category:\s*(.+?)\]/i);
        if (m?.[1]) category = m[1].trim().toUpperCase();
        return { index: i + 1, category, ...raw };
      })
      .sort((a, b) => b.aiScore - a.aiScore);
  }, [proposalsData]);

  const filtered = proposals.filter(
    (p) => filter === "ALL" || p.category === filter
  );

  if (!mounted) return null;

  return (
    <main className={styles.main}>
      {/* ── Breadcrumb ──────────────────────────────────────── */}
      <div className={styles.breadcrumb}>
        <Link href="/" className={styles.breadcrumbLink}>GrantMind</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbActive}>Leaderboard</span>
      </div>

      {/* ── Heading ─────────────────────────────────────────── */}
      <div className={styles.headingBlock}>
        <h1 className={styles.heading}>
          <span className={styles.headingWhite}>PROPOSAL </span>
          <span className={styles.headingPurple}>LEADERBOARD</span>
        </h1>
        <p className={styles.subtitle}>
          Real-time AI-ranked grant evaluations based on technical feasibility,
          community impact, and resource allocation efficiency.
        </p>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? styles.filterActive : styles.filterBtn}
          >
            {f === "ALL" && (
              <span className={`material-symbols-outlined ${styles.filterIcon}`}>
                filter_list
              </span>
            )}
            {f}
          </button>
        ))}
        <div className={styles.syncBox}>
          <span className={`material-symbols-outlined ${styles.syncIcon}`}>sync</span>
          LAST_SYNC: {time}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.theadRow}>
              <th className={styles.th}>RANK</th>
              <th className={styles.th}>PROJECT NAME</th>
              <th className={styles.th}>CATEGORY</th>
              <th className={styles.th}>AI SCORE</th>
              <th className={styles.th}>FUNDING</th>
              <th className={styles.th}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [1, 2, 3, 4].map((n) => (
                <tr key={n} className={styles.skRow}>
                  {[1,2,3,4,5,6].map((c) => (
                    <td key={c} className={styles.skCell}>
                      <div className={`${styles.skBar} ${c === 2 ? styles.skLong : styles.skMed}`} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.emptyState}>
                    <span className={`material-symbols-outlined ${styles.emptyIcon}`}>inbox</span>
                    <p className={styles.emptyTitle}>No Proposals Found</p>
                    <p className={styles.emptyDesc}>
                      {filter !== "ALL"
                        ? `No proposals in the "${filter}" category yet.`
                        : "No proposals submitted yet."}
                    </p>
                    <Link href="/submit" className={styles.emptyLink}>Submit a Proposal →</Link>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => {
                const status = getStatus(p);
                const score = p.aiReviewed ? p.aiScore.toFixed(1) : "--";
                const funding = `$${Number(formatUnits(p.requestedAmount, 18)).toLocaleString()}`;
                const idLabel = `ID: ${p.index.toString().padStart(4, "0")}-X`;
                return (
                  <tr key={p.index} className={styles.tr}>
                    <td className={styles.td}>
                      <span className={styles.rank}>{String(i + 1).padStart(2, "0")}</span>
                    </td>
                    <td className={styles.td}>
                      <Link href={`/proposals/${p.index}`} className={styles.projectCell}>
                        <span className={styles.projectName}>{p.title.toUpperCase()}</span>
                        <span className={styles.projectId}>{idLabel}</span>
                      </Link>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.catBadge}>{p.category}</span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.scoreCell}>
                        <span className={styles.scoreNum}>{score}</span>
                        {p.aiReviewed && (
                          <div className={styles.scoreTrack}>
                            <div className={styles.scoreFill} style={{ width: `${p.aiScore}%` }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.funding}>{funding}</span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.statusCell}>
                        <span className={`${styles.statusDot} ${styles[`dot${status.color}`]}`} />
                        <span className={`${styles.statusLabel} ${styles[`label${status.color}`]}`}>
                          {status.label}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className={styles.pagination}>
          <span>PAGE [01] OF [{Math.ceil(filtered.length / 10) || 1}]</span>
          <div className={styles.pageBtns}>
            <button className={styles.pageBtn}>Prev_Page</button>
            <button className={styles.pageBtn}>Next_Page</button>
          </div>
        </div>
      </div>

      {/* ── Analytics Cards ─────────────────────────────────── */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={`material-symbols-outlined ${styles.cardIcon}`}>analytics</span>
          <h3 className={styles.cardTitle}>AI ACCURACY</h3>
          <p className={styles.cardDesc}>
            Current model confidence interval: 94.2%. Scored against 1,200+ historical
            data points using decentralized compute clusters.
          </p>
        </div>
        <div className={styles.card}>
          <span className={`material-symbols-outlined ${styles.cardIcon}`}>monitoring</span>
          <h3 className={styles.cardTitle}>NETWORK HEALTH</h3>
          <p className={styles.cardDesc}>
            Grant treasury currently distributing $4.2M across 14 active workstreams
            with real-time milestone verification.
          </p>
        </div>
        <div className={styles.card}>
          <span className={`material-symbols-outlined ${styles.cardIcon}`}>security</span>
          <h3 className={styles.cardTitle}>SECURE EVAL</h3>
          <p className={styles.cardDesc}>
            Encrypted proposal submission system with zero-knowledge verification
            protocols ensuring contributor privacy.
          </p>
        </div>
      </div>
    </main>
  );
}
