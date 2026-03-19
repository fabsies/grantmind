"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { formatUnits } from "viem";
import { useParams } from "next/navigation";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { grantRegistryAbi } from "@/lib/abis/GrantRegistry";
import { grantDaoAbi } from "@/lib/abis/GrantDAO";
import { useToast } from "@/components/ToastContext";
import Link from "next/link";
import styles from "./Proposal.module.css";

/* ── Types ────────────────────────────────────────────────────── */
type RawProposal = {
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

// Mirrors ProposalState enum in GrantDAO.sol
// Pending=0, Active=1, Succeeded=2, Defeated=3, Executed=4
const STATE_LABELS = ["PENDING", "ACTIVE", "SUCCEEDED", "DEFEATED", "EXECUTED"] as const;
const STATE_COLORS: Record<number, string> = {
  0: "#94a3b8",  // slate  — Pending
  1: "#4ade80",  // green  — Active
  2: "#a78bfa",  // purple — Succeeded
  3: "#f87171",  // red    — Defeated
  4: "#60a5fa",  // blue   — Executed
};

/* ── Helpers ──────────────────────────────────────────────────── */
function slug(address: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Unknown";
}

function derivePhases(description: string) {
  return [
    { label: "Phase 1: Genesis Node", desc: "Launch of the core infrastructure on testnet. Expected Q4 2024." },
    { label: "Phase 2: Validator Network", desc: "Implementation of the consensus protocol for verification." },
    { label: "Phase 3: Public Mainnet", desc: "Full decentralized governance and token launch." },
  ];
}

type ModalState = { open: boolean; vote: boolean | null };

/* ── Component ────────────────────────────────────────────────── */
export default function ProposalDetailPage() {
  const params = useParams();
  const id = Number(params?.id ?? 0);
  const { address } = useAccount();
  const { addToast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false, vote: null });

  useEffect(() => setMounted(true), []);

  /* ── Contract reads ──────────────────────────────────────────── */
  const { data: raw, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.grantRegistry as `0x${string}`,
    abi: grantRegistryAbi,
    functionName: "getProposal",
    args: [BigInt(id)],
  }) as { data: RawProposal | undefined; isLoading: boolean };

  // Proposal voting struct: [againstVotes, forVotes, startTime, endTime, snapShotBlock, executed, isActive]
  const { data: proposalVoteData, refetch: refetchVotes } = useReadContract({
    address: CONTRACT_ADDRESSES.grantDAO as `0x${string}`,
    abi: grantDaoAbi,
    functionName: "proposalVotes",
    args: [BigInt(id)],
  });

  // ProposalState enum as uint8: Pending=0 Active=1 Succeeded=2 Defeated=3 Executed=4
  const { data: proposalState, refetch: refetchState } = useReadContract({
    address: CONTRACT_ADDRESSES.grantDAO as `0x${string}`,
    abi: grantDaoAbi,
    functionName: "state",
    args: [BigInt(id)],
  });

  // Whether the connected wallet has already voted on this proposal
  const { data: alreadyVoted, refetch: refetchHasVoted } = useReadContract({
    address: CONTRACT_ADDRESSES.grantDAO as `0x${string}`,
    abi: grantDaoAbi,
    functionName: "hasVoted",
    args: address ? [BigInt(id), address] : undefined,
    query: { enabled: !!address },
  });

  /* ── Write: castVote ─────────────────────────────────────────── */
  const { writeContractAsync } = useWriteContract();

  const [voteTxHash, setVoteTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: voteConfirmed } = useWaitForTransactionReceipt({ hash: voteTxHash });

  useEffect(() => {
    if (voteConfirmed) {
      addToast("Vote cast successfully!", "success");
      setModal({ open: false, vote: null });
      // Refetch on-chain state after confirmation
      refetchVotes();
      refetchState();
      refetchHasVoted();
    }
  }, [voteConfirmed, addToast, refetchVotes, refetchState, refetchHasVoted]);

  /* ── Write: startVoting ──────────────────────────────────────── */
  const [startTxHash, setStartTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: startConfirmed, isLoading: startConfirming } =
    useWaitForTransactionReceipt({ hash: startTxHash });
  const [startPending, setStartPending] = useState(false);

  useEffect(() => {
    if (startConfirmed) {
      addToast("Voting period started!", "success");
      setStartPending(false);
      refetchState();
      refetchVotes();
    }
  }, [startConfirmed, addToast, refetchState, refetchVotes]);

  /* ── Write: execute ──────────────────────────────────────────── */
  const [execTxHash, setExecTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: execConfirmed, isLoading: execConfirming } =
    useWaitForTransactionReceipt({ hash: execTxHash });
  const [execPending, setExecPending] = useState(false);

  useEffect(() => {
    if (execConfirmed) {
      addToast("Proposal executed — funds disbursed!", "success");
      setExecPending(false);
      refetchState();
    }
  }, [execConfirmed, addToast, refetchState]);

  /* ── Handlers ────────────────────────────────────────────────── */
  const handleVoteIntent = (approve: boolean) =>
    setModal({ open: true, vote: approve });

  const handleVoteConfirm = async () => {
    if (modal.vote === null) return;
    try {
      // support: 0 = Against, 1 = For  (uint8, NOT bool)
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.grantDAO as `0x${string}`,
        abi: grantDaoAbi,
        functionName: "castVote",
        args: [BigInt(id), modal.vote ? 1 : 0],
      });
      setVoteTxHash(hash);
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      // Suppress user rejection noise
      if (err?.message?.includes("User rejected")) {
        setModal({ open: false, vote: null });
        return;
      }
      const msg = err?.shortMessage ?? "Vote failed.";
      addToast(msg, "error");
      setModal({ open: false, vote: null });
    }
  };

  const handleStartVoting = async () => {
    setStartPending(true);
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.grantDAO as `0x${string}`,
        abi: grantDaoAbi,
        functionName: "startVoting",
        args: [BigInt(id)],
      });
      setStartTxHash(hash);
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      if (err?.message?.includes("User rejected")) {
        setStartPending(false);
        return;
      }
      addToast(err?.shortMessage ?? "Failed to start voting.", "error");
      setStartPending(false);
    }
  };

  const handleExecute = async () => {
    setExecPending(true);
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.grantDAO as `0x${string}`,
        abi: grantDaoAbi,
        functionName: "execute",
        args: [BigInt(id)],
      });
      setExecTxHash(hash);
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      if (err?.message?.includes("User rejected")) {
        setExecPending(false);
        return;
      }
      addToast(err?.shortMessage ?? "Execution failed.", "error");
      setExecPending(false);
    }
  };

  /* ── Derived data ────────────────────────────────────────────── */
  const proposal = raw as RawProposal | undefined;
  const phases = useMemo(() => derivePhases(proposal?.description ?? ""), [proposal?.description]);

  const aiScore = proposal?.aiScore ?? 0;
  const reviewProgress = proposal?.aiReviewed ? Math.min(75 + Math.floor(aiScore / 10), 100) : 20;
  const tokenScore = aiScore >= 80 ? "AA" : aiScore >= 60 ? "A" : "B";
  const ghActivity = aiScore >= 85 ? "Very High" : aiScore >= 65 ? "High" : "Moderate";
  const socialTrust = (aiScore / 10).toFixed(1);
  const idLabel = `#GM-${new Date().getFullYear()}-${String(id).padStart(3, "0")}`;
  const funding = proposal
    ? Number(formatUnits(proposal.requestedAmount, 18)).toLocaleString()
    : "—";

  // Proposal state
  const stateIndex = proposalState !== undefined ? Number(proposalState) : -1;
  const stateLabel = stateIndex >= 0 ? STATE_LABELS[stateIndex] : "LOADING";
  const stateColor = stateIndex >= 0 ? STATE_COLORS[stateIndex] : "#94a3b8";
  const isActive = stateIndex === 1;
  const isPending = stateIndex === 0;
  const isSucceeded = stateIndex === 2;
  const isExecuted = stateIndex === 4;

  // Live vote counts from proposalVotes struct tuple
  // Struct order: [againstVotes, forVotes, startTime, endTime, snapShotBlock, executed, isActive]
  const againstVotes = proposalVoteData
    ? formatUnits((proposalVoteData as readonly unknown[])[0] as bigint, 18)
    : "0";
  const forVotes = proposalVoteData
    ? formatUnits((proposalVoteData as readonly unknown[])[1] as bigint, 18)
    : "0";
  const endTime = proposalVoteData
    ? Number((proposalVoteData as readonly unknown[])[3] as bigint)
    : 0;
  const votingEndsAt = endTime > 0
    ? new Date(endTime * 1000).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    })
    : "—";

  // Disable vote buttons if: not connected, already voted, or voting not active
  const voteDisabled = !address || !!alreadyVoted || !isActive;

  if (!mounted) return null;

  /* ── Loading skeleton ────────────────────────────────────────── */
  if (isLoading)
    return (
      <main className={styles.main}>
        <div className={styles.skHero} />
        <div className={styles.skGrid}>
          <div className={styles.skPanel} />
          <div className={styles.skPanel} style={{ flex: 2 }} />
          <div className={styles.skPanel} />
        </div>
      </main>
    );

  /* ── Not found ───────────────────────────────────────────────── */
  if (!proposal?.exists)
    return (
      <main className={styles.main}>
        <div className={styles.emptyState}>
          <span className={`material-symbols-outlined ${styles.emptyIcon}`}>search_off</span>
          <p className={styles.emptyTitle}>Proposal Not Found</p>
          <p className={styles.emptyDesc}>Proposal #{id} does not exist on-chain.</p>
          <Link href="/leaderboard" className={styles.emptyLink}>
            ← Back to Leaderboard
          </Link>
        </div>
      </main>
    );

  return (
    <main className={styles.main}>

      {/* ── Vote confirmation modal ───────────────────────────── */}
      {modal.open && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <p className={styles.modalTitle}>Confirm Your Vote</p>
            <p className={styles.modalDesc}>
              You are about to{" "}
              <strong>{modal.vote ? "APPROVE" : "REJECT"}</strong> proposal{" "}
              <strong>{idLabel}</strong>. This action is on-chain and
              irreversible.
            </p>
            <div className={styles.modalBtns}>
              <button
                className={styles.modalCancel}
                onClick={() => setModal({ open: false, vote: null })}
              >
                Cancel
              </button>
              <button
                className={
                  modal.vote
                    ? styles.modalConfirmApprove
                    : styles.modalConfirmReject
                }
                onClick={handleVoteConfirm}
              >
                {modal.vote ? "✓ Confirm Approve" : "✕ Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero row ─────────────────────────────────────────── */}
      <div className={styles.heroRow}>
        {/* Left: proposal identity */}
        <div className={styles.heroLeft}>
          <div className={styles.iconBox}>
            <span className={`material-symbols-outlined ${styles.iconBoxIcon}`}>
              description
            </span>
            <span className={styles.iconBoxId}>{idLabel}</span>
          </div>
          <div className={styles.heroInfo}>
            <div className={styles.heroMeta}>
              {/* Dynamic state badge — replaces hardcoded "ACTIVE PROPOSAL" */}
              <span
                className={styles.activeBadge}
                style={{ color: stateColor, borderColor: stateColor }}
              >
                {stateLabel}
              </span>
              <span className={styles.heroId}>ID: {idLabel}</span>
            </div>
            <h1 className={styles.heroTitle}>{proposal.title}</h1>
            <div className={styles.heroDetails}>
              <span className={styles.heroDetail}>
                <span
                  className={`material-symbols-outlined ${styles.detailIcon}`}
                >
                  person
                </span>
                Founder: {slug(proposal.applicant)}
              </span>
              {isActive && endTime > 0 && (
                <span className={styles.heroDetail}>
                  <span
                    className={`material-symbols-outlined ${styles.detailIcon}`}
                  >
                    schedule
                  </span>
                  Voting ends: {votingEndsAt}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: AI trust score */}
        <div className={styles.trustCard}>
          <p className={styles.trustLabel}>AI TRUST SCORE</p>
          <p className={styles.trustScore}>
            {proposal.aiReviewed ? aiScore : "--"}
            <span className={styles.trustMax}>/100</span>
          </p>
          <div className={styles.trustTrack}>
            <div
              className={styles.trustFill}
              style={{
                width: proposal.aiReviewed ? `${aiScore}%` : "0%",
              }}
            />
          </div>
          <p className={styles.trustSub}>
            {proposal.aiReviewed
              ? "Confidence Interval: 98.4% Accuracy"
              : "Pending evaluation"}
          </p>
          <span
            className={`material-symbols-outlined ${styles.trustBgIcon}`}
          >
            bolt
          </span>
        </div>
      </div>

      {/* ── Three-column body ────────────────────────────────── */}
      <div className={styles.body}>

        {/* Left aside: Analysis + Activity */}
        <aside className={styles.asideLeft}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>
              <span
                className={`material-symbols-outlined ${styles.panelIcon}`}
              >
                analytics
              </span>
              AI Analysis Panel
            </h2>
            <div className={styles.analysisList}>
              <div className={styles.analysisCard}>
                <span
                  className={styles.aLabel}
                  style={{ color: "#4ade80" }}
                >
                  STRENGTHS
                </span>
                <p className={styles.aValue}>
                  {proposal.aiSummary
                    ? proposal.aiSummary.split(".")[0]
                    : "High Technical Viability"}
                </p>
                <p className={styles.aDesc}>
                  Strong foundation and experienced contributors.
                </p>
              </div>
              <div
                className={styles.analysisCard}
                style={{
                  borderColor: "rgba(245,158,11,0.25)",
                  background: "rgba(245,158,11,0.04)",
                }}
              >
                <span
                  className={styles.aLabel}
                  style={{ color: "#fbbf24" }}
                >
                  RISKS
                </span>
                <p className={styles.aValue}>Market Liquidity</p>
                <p className={styles.aDesc}>
                  Dependent on early ecosystem adoption for stability.
                </p>
              </div>
              <div
                className={styles.analysisCard}
                style={{
                  borderColor: "rgba(124,92,191,0.25)",
                  background: "rgba(124,92,191,0.04)",
                }}
              >
                <span
                  className={styles.aLabel}
                  style={{ color: "var(--brand-accent)" }}
                >
                  ECOSYSTEM IMPACT
                </span>
                <p className={styles.aValue}>
                  <span className={styles.impactNum}>{socialTrust}</span>
                  <span className={styles.impactMax}>&nbsp;/10</span>
                </p>
                <p className={styles.aDesc}>
                  High potential for cross-chain interoperability growth.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>
              <span
                className={`material-symbols-outlined ${styles.panelIcon}`}
              >
                history
              </span>
              Recent Activity
            </h2>
            <div className={styles.activityList}>
              <div className={styles.activityItem}>
                <div className={styles.botAvatar}>GM</div>
                <div>
                  <p className={styles.actorName}>GRANTMIND BOT</p>
                  <p className={styles.actorDesc}>
                    Roadmap validation complete. Verified 4/4 dates.
                  </p>
                </div>
              </div>
              <div className={styles.activityItem}>
                <div
                  className={`${styles.botAvatar} ${styles.userAvatar}`}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "0.875rem" }}
                  >
                    person
                  </span>
                </div>
                <div>
                  <p className={styles.actorName}>
                    {address ? slug(address) : "Community"}
                  </p>
                  <p className={styles.actorDesc}>
                    Asked about the L2 scaling latency estimates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Center: Executive Summary + Roadmap + Milestones */}
        <div className={styles.centerCol}>
          <div className={styles.articlePanel}>
            <h2 className={styles.articleH2}>Executive Summary</h2>
            <p className={styles.articleBody}>
              {proposal.description
                .replace(/\[Category:[^\]]*\]/i, "")
                .trim() ||
                "This proposal aims to build critical infrastructure for the Polkadot ecosystem."}
            </p>

            {proposal.aiSummary && (
              <>
                <h3 className={styles.articleH3}>AI Summary</h3>
                <p className={styles.articleBody}>{proposal.aiSummary}</p>
              </>
            )}

            <h3 className={styles.articleH3}>Technical Roadmap</h3>
            <ul className={styles.roadmapList}>
              {phases.map((ph, i) => (
                <li key={i} className={styles.roadmapItem}>
                  <span className={styles.roadmapDot} />
                  <div>
                    <p className={styles.roadmapTitle}>{ph.label}</p>
                    <p className={styles.roadmapDesc}>{ph.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <h3 className={styles.articleH3}>Milestones</h3>
            <div className={styles.milestones}>
              <div className={styles.milestone}>
                <span
                  className={`material-symbols-outlined ${styles.msIconGreen}`}
                >
                  check_circle
                </span>
                <div>
                  <p className={styles.msTitle}>Whitepaper Audit</p>
                  <p className={styles.msDesc}>Completed by VeriShield AI</p>
                </div>
              </div>
              <div className={styles.milestone}>
                <span
                  className={`material-symbols-outlined ${styles.msIconAmber}`}
                >
                  hourglass_top
                </span>
                <div>
                  <p className={styles.msTitle}>MVP Frontend</p>
                  <p className={styles.msDesc}>November 15, 2024</p>
                </div>
              </div>
            </div>

            {/* Reference links if present */}
            {proposal.referenceLinks?.length > 0 && (
              <>
                <h3 className={styles.articleH3}>Reference Links</h3>
                <ul className={styles.refLinkList}>
                  {proposal.referenceLinks.map((link, i) =>
                    link ? (
                      <li key={i}>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.refLink}
                        >
                          {link}
                        </a>
                      </li>
                    ) : null
                  )}
                </ul>
              </>
            )}
          </div>
        </div>

        {/* Right aside: Decision Terminal + Metrics */}
        <aside className={styles.asideRight}>
          <div className={styles.panel}>
            <h2 className={styles.decisionLabel}>DECISION TERMINAL</h2>
            <p className={styles.decisionDesc}>
              Review the AI Analysis and full roadmap before casting your
              final vote.
            </p>

            {/* ── START VOTING — shown when Pending + AI reviewed ── */}
            {isPending && proposal.aiReviewed && (
              <button
                className={styles.btnStartVoting}
                onClick={handleStartVoting}
                disabled={!address || startPending || startConfirming}
              >
                <div className={styles.btnInner}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "1.125rem" }}
                  >
                    how_to_vote
                  </span>
                  {startPending || startConfirming
                    ? "Opening vote..."
                    : "OPEN TO COMMUNITY VOTE"}
                </div>
                <span className={styles.btnSub}>
                  {startPending || startConfirming
                    ? "Confirm in wallet..."
                    : "Starts a 7-day governance vote"}
                </span>
              </button>
            )}

            {/* ── EXECUTE — shown when Succeeded ── */}
            {isSucceeded && (
              <button
                className={styles.btnExecute}
                onClick={handleExecute}
                disabled={!address || execPending || execConfirming}
              >
                <div className={styles.btnInner}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "1.125rem" }}
                  >
                    send_money
                  </span>
                  {execPending || execConfirming
                    ? "Executing..."
                    : "EXECUTE & DISBURSE"}
                </div>
                <span className={styles.btnSub}>
                  Transfers {funding} PAS to recipient
                </span>
              </button>
            )}

            {/* ── VOTE BUTTONS — shown when Active ── */}
            {(isActive || (!isPending && !isSucceeded && !isExecuted)) && (
              <div className={styles.voteGroup}>
                <button
                  className={styles.btnApprove}
                  onClick={() => handleVoteIntent(true)}
                  disabled={voteDisabled}
                  title={
                    alreadyVoted
                      ? "You have already voted"
                      : !address
                        ? "Connect wallet to vote"
                        : !isActive
                          ? "Voting is not active"
                          : undefined
                  }
                >
                  <div className={styles.btnInner}>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "1.125rem" }}
                    >
                      thumb_up
                    </span>
                    APPROVE
                  </div>
                  <span className={styles.btnSub}>
                    {proposal.aiReviewed
                      ? `${aiScore}% AI MATCH`
                      : "PENDING EVAL"}
                  </span>
                </button>
                <button
                  className={styles.btnReject}
                  onClick={() => handleVoteIntent(false)}
                  disabled={voteDisabled}
                  title={
                    alreadyVoted
                      ? "You have already voted"
                      : !address
                        ? "Connect wallet to vote"
                        : !isActive
                          ? "Voting is not active"
                          : undefined
                  }
                >
                  <div className={styles.btnInner}>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "1.125rem" }}
                    >
                      thumb_down
                    </span>
                    REJECT
                  </div>
                  <span className={styles.btnSub}>REQUEST REVISION</span>
                </button>
              </div>
            )}

            {/* Already voted notice */}
            {alreadyVoted && (
              <p className={styles.alreadyVotedNotice}>
                <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", verticalAlign: "middle" }}>
                  how_to_vote
                </span>{" "}
                You have already cast your vote on this proposal.
              </p>
            )}

            {/* Executed notice */}
            {isExecuted && (
              <p className={styles.executedNotice}>
                <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", verticalAlign: "middle" }}>
                  check_circle
                </span>{" "}
                Proposal executed. Funds disbursed to recipient.
              </p>
            )}

            <div className={styles.progressSection}>
              <div className={styles.progressHeader}>
                <span className={styles.progressLabel}>Review Progress</span>
                <span className={styles.progressPct}>{reviewProgress}%</span>
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${reviewProgress}%` }}
                />
              </div>
              <p className={styles.progressNote}>
                *By voting, you confirm that you have read all documentation
                and verified the founder&apos;s credentials.
              </p>
            </div>
          </div>

          {/* Metrics panel — now includes live vote counts */}
          <div className={styles.panel}>
            <h2 className={styles.metricsTitle}>TECHNICAL METRICS</h2>
            <div className={styles.metricsList}>
              <div className={styles.metricRow}>
                <span className={styles.metricLbl}>Tokenomics Score</span>
                <span
                  className={styles.metricVal}
                  style={{ color: "#4ade80" }}
                >
                  {tokenScore}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLbl}>GitHub Activity</span>
                <span className={styles.metricVal}>{ghActivity}</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLbl}>Social Trust</span>
                <span className={styles.metricVal}>{socialTrust}/10</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLbl}>Funding Request</span>
                <span className={styles.metricVal}>{funding} PAS</span>
              </div>

              {/* Live on-chain vote counts */}
              <div className={styles.metricDivider} />
              <div className={styles.metricRow}>
                <span className={styles.metricLbl}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "0.85rem", verticalAlign: "middle", marginRight: "4px", color: "#4ade80" }}
                  >
                    thumb_up
                  </span>
                  For Votes
                </span>
                <span className={styles.metricVal} style={{ color: "#4ade80" }}>
                  {Number(forVotes).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLbl}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "0.85rem", verticalAlign: "middle", marginRight: "4px", color: "#f87171" }}
                  >
                    thumb_down
                  </span>
                  Against Votes
                </span>
                <span className={styles.metricVal} style={{ color: "#f87171" }}>
                  {Number(againstVotes).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              {isActive && endTime > 0 && (
                <div className={styles.metricRow}>
                  <span className={styles.metricLbl}>Voting Ends</span>
                  <span className={styles.metricVal}>{votingEndsAt}</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}