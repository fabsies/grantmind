"use client";

import { useState, useMemo, useEffect } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { grantRegistryAbi } from "@/lib/abis/GrantRegistry";
import Link from 'next/link';
import styles from './Leaderboard.module.css';

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

const getStatusMap = (aiReviewed: boolean) => {
  if (!aiReviewed) return { text: "Pending Eval", style: "Gray" };
  return { text: "Under Review", style: "Amber" };
};

export default function LeaderboardPage() {
  const [filter, setFilter] = useState("All");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });

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

    const parsed = (proposalsData as unknown as { status: string; result: unknown }[])
      .filter((res) => res.status === "success" && !!res.result)
      .map((res, index) => {
        const { applicant, title, description, requestedAmount, recipientWallet, referenceLinks, exists, aiReviewed, aiScore, aiSummary } = res.result as {
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
        };

        let category = "General";
        const catMatch = description.match(/\[Category:\s*(.+?)\]/i);
        if (catMatch && catMatch[1]) {
          category = catMatch[1].trim();
        }

        return {
          index: index + 1,
          applicant, title, description, requestedAmount, recipientWallet, referenceLinks, exists, aiReviewed, aiScore, aiSummary, category
        };
      });

    return parsed.sort((a, b) => b.aiScore - a.aiScore);
  }, [proposalsData]);

  const filteredProposals = proposals.filter(p => filter === "All" || p.category === filter);

  if (!mounted) return null;

  return (
    <main className={styles.main}>
      <div className={styles.headerSection}>
        <div className={styles.breadcrumb}>
          <span>GrantMind</span>
          <span className={styles.breadcrumbSlash}>/</span>
          <span className={styles.breadcrumbActive}>Leaderboard</span>
        </div>
        <div className={styles.titleBox}>
          <div>
            <h1 className={styles.title}>
              Proposal <span className={styles.titleAccent}>Leaderboard</span>
            </h1>
          </div>
          <p className={styles.subtitle}>
            Real-time AI-ranked grant evaluations based on technical feasibility, community impact, and resource allocation efficiency.
          </p>
        </div>
      </div>

      <div className={styles.filters}>
        <button
          onClick={() => setFilter("All")}
          className={filter === "All" ? styles.filterBtnActive : styles.filterBtn}
        >
          <span className="material-symbols-outlined text-[14px]">filter_list</span> All
        </button>
        {["Infrastructure", "ZKP Research", "Developer Tooling", "DAO Governance"].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={filter === cat ? styles.filterBtnActive : styles.filterBtn}
          >
            {cat}
          </button>
        ))}
        <div className={styles.syncBox}>
          <span className={`material-symbols-outlined ${styles.syncIcon}`}>sync</span> LAST_SYNC: {timeStr}
        </div>
      </div>

      <div className={styles.tableContainer}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th className={styles.th}>Rank</th>
                <th className={styles.th}>Project Name</th>
                <th className={styles.th}>Category</th>
                <th className={styles.th}>AI Score</th>
                <th className={styles.th}>Funding</th>
                <th className={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6}>
                    <div className={styles.loadingBox}>Encrypting telemetry stream...</div>
                  </td>
                </tr>
              ) : filteredProposals.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className={styles.loadingBox}>No proposals found.</div>
                  </td>
                </tr>
              ) : (
                filteredProposals.map((p, index) => {
                  const statusInfo = getStatusMap(p.aiReviewed);
                  const isTop = index === 0;

                  return (
                    <tr key={p.index} className={styles.tr}>
                      <td className={styles.td}>
                        <span className={styles.rank}>{(index + 1).toString().padStart(2, '0')}</span>
                      </td>
                      <td className={styles.td}>
                        <Link href={`/proposals/${p.index}`} className={styles.projectBox}>
                          <span className={styles.projectName}>{p.title}</span>
                          <span className={styles.projectId}>ID: {p.index.toString().padStart(4, '0')}</span>
                        </Link>
                      </td>
                      <td className={styles.td}>
                        <span className={`${styles.categoryBadge} ${isTop ? styles.categoryActive : styles.categoryInactive}`}>
                          {p.category}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.scoreBox}>
                          <span className={`${styles.scoreValue} ${p.aiScore < 50 ? styles.scoreValueLow : ''}`}>
                            {p.aiReviewed ? p.aiScore.toString() : '--'}
                          </span>
                          {p.aiReviewed && (
                            <div className={styles.scoreTrack}>
                              <div
                                className={`${styles.scoreFill} ${p.aiScore < 50 ? styles.scoreFillLow : ''}`}
                                style={{ width: `${p.aiScore}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.funding}>{Number(formatUnits(p.requestedAmount, 18)).toLocaleString()} PAS</span>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.statusBox}>
                          <div className={styles[`statusDot${statusInfo.style}`]}></div>
                          <span className={styles[`statusText${statusInfo.style}`]}>
                            {statusInfo.text}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <span>Page [01] of [01]</span>
          <div className={styles.paginationBtns}>
            <button className={styles.pageBtn}>Prev_Page</button>
            <button className={styles.pageBtn}>Next_Page</button>
          </div>
        </div>
      </div>

      <div className={styles.analyticsGrid}>
        <div className={styles.analyticsCard}>
          <span className={`${styles.analyticsIcon} material-symbols-outlined`}>analytics</span>
          <h3 className={styles.analyticsTitle}>AI Accuracy</h3>
          <p className={styles.analyticsDesc}>
            Current model confidence interval: 94.2%. Scored against 1,200+ historical data points using decentralized compute clusters.
          </p>
        </div>
        <div className={styles.analyticsCard}>
          <span className={`${styles.analyticsIcon} material-symbols-outlined`}>monitoring</span>
          <h3 className={styles.analyticsTitle}>Network Health</h3>
          <p className={styles.analyticsDesc}>
            Grant treasury currently distributing $4.2M across active workstreams with real-time milestone verification.
          </p>
        </div>
        <div className={styles.analyticsCard}>
          <span className={`${styles.analyticsIcon} material-symbols-outlined`}>security</span>
          <h3 className={styles.analyticsTitle}>Secure Eval</h3>
          <p className={styles.analyticsDesc}>
            Encrypted proposal submission system with zero-knowledge verification protocols ensuring contributor privacy.
          </p>
        </div>
      </div>
    </main>
  );
}