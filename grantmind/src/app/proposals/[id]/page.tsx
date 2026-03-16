"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseAbi, formatUnits } from "viem";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import Link from 'next/link';
import styles from './Proposal.module.css';

const GRANT_REGISTRY_ABI = [
  {
    name: "getProposal",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "applicant", type: "address" },
          { name: "title", type: "string" },
          { name: "description", type: "string" },
          { name: "requestedAmount", type: "uint256" },
          { name: "recipientWallet", type: "address" },
          { name: "referenceLinks", type: "string[]" },
          { name: "exists", type: "bool" },
          { name: "aiReviewed", type: "bool" },
          { name: "aiScore", type: "uint8" },
          { name: "aiSummary", type: "string" }
        ]
      }
    ]
  }
] as const;

const GRANT_DAO_ABI = parseAbi([
  "function castVote(uint256 _proposalId, uint8 support) external"
]);

type Proposal = {
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
  cleanDescription: string;
};

const getStatusMap = (aiReviewed: boolean) => {
  if (!aiReviewed) return { text: "Pending Eval", style: "Gray" };
  return { text: "Under Review", style: "Amber" };
};

export default function ProposalDetailPage() {
  const params = useParams();
  const proposalId = params.id as string;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [voteTerminalVisible, setVoteTerminalVisible] = useState(false);
  const [voteAction, setVoteAction] = useState<"APPROVE" | "REJECT" | null>(null);

  const { data: proposalData, isLoading, isError, error } = useReadContract({
    address: CONTRACT_ADDRESSES.grantRegistry as `0x${string}`,
    abi: GRANT_REGISTRY_ABI,
    functionName: "getProposal",
    args: [BigInt(proposalId || 0)],
    query: {
      enabled: !!proposalId,
    }
  });

  console.log("DEBUG", { proposalId, proposalData, isLoading, isError, error });

  const { data: hash, writeContractAsync } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const proposal: Proposal | null = useMemo(() => {
    if (!proposalData) return null;

    const { applicant, title, description, requestedAmount, recipientWallet, referenceLinks, exists, aiReviewed, aiScore, aiSummary } = proposalData as {
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
    let cleanDescription = description;

    if (catMatch && catMatch[1]) {
      category = catMatch[1].trim();
      cleanDescription = description.replace(catMatch[0], "").trim();
    }

    return {
      applicant, title, description, requestedAmount, recipientWallet, referenceLinks, exists, aiReviewed, aiScore, aiSummary, category, cleanDescription
    };
  }, [proposalData]);

  const handleVote = async (support: 0 | 1) => {
    setVoteAction(support === 1 ? "APPROVE" : "REJECT");
    setVoteTerminalVisible(true);

    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.grantDAO as `0x${string}`,
        abi: GRANT_DAO_ABI,
        functionName: "castVote",
        args: [BigInt(proposalId), support],
      });
    } catch (error) {
      console.error("Voting failed:", error);
    }
  };

  if (!mounted) return null;

  if (isLoading) {
    return <main className={styles.main}><div className={styles.loadingBox}>Decrypting Proposal Data...</div></main>;
  }

  if (isError || (!isLoading && proposalData === undefined)) {
    return (
      <main className={styles.main}>
        <div className={styles.loadingBox} style={{ animation: 'none', color: '#ef4444' }}>
          Error 404: Proposal ID Not Found
        </div>
      </main>
    );
  }

  if (!proposal) {
    return <main className={styles.main}><div className={styles.loadingBox}>Processing Proposal Data...</div></main>;
  }

  const statusInfo = getStatusMap(proposal.aiReviewed);
  const formattedScore = proposal.aiReviewed ? proposal.aiScore : '--';
  const confidenceInterval = proposal.aiReviewed ? (proposal.aiScore > 80 ? "98.4%" : "84.2%") : "N/A";

  return (
    <main className={styles.main}>
      {voteTerminalVisible ? (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <div className={styles.pulseWrapper}>
              <div className={styles.pulseCircleOuter}>
                <div className={styles.pulseCircleInner}></div>
                <span className="material-symbols-outlined text-4xl" style={{ color: "var(--brand-accent)" }}>how_to_vote</span>
              </div>
            </div>

            <h1 className={styles.overlayTitle}>
              {isConfirmed ? "Vote Successfully Cast" : "Submitting Vote to DAO..."}
            </h1>

            <p className={styles.overlayDesc}>
              {isConfirmed
                ? "Your vote has been permanently recorded on the blockchain."
                : "Your proposal contribution is being broadcasted to the governance contract. Please stay on this page."}
            </p>

            <div className={styles.txProgress}>
              <div className={styles.txProgressHeader}>
                <span className={styles.txProgressLabel}>Transaction Status</span>
                <span className={styles.txProgressVal}>{isConfirmed ? "100%" : (isConfirming ? "65%" : "10%")}</span>
              </div>
              <div className={styles.txProgressBar}>
                <div
                  className={styles.txProgressFill}
                  style={{ width: isConfirmed ? "100%" : (isConfirming ? "65%" : "10%") }}
                ></div>
              </div>
              {hash && (
                <div className={styles.txHashRow}>
                  <span className="material-symbols-outlined text-sm">database</span>
                  <span>{hash.slice(0, 6)}...{hash.slice(-4)}</span>
                </div>
              )}
            </div>

            <div className={styles.txStepsGrid}>
              <div className={`${styles.txStep} ${hash ? styles.stepSuccess : styles.stepActive}`}>
                <span className={`material-symbols-outlined ${hash ? styles.stepIconSuccess : styles.stepIconActive}`}>
                  {hash ? "check_circle" : "pending"}
                </span>
                <div>
                  <p className={styles.stepLabel} style={{ color: hash ? "#22c55e" : "var(--brand-accent)" }}>Step 1</p>
                  <p className={styles.stepText}>Wallet Signed</p>
                </div>
              </div>

              <div className={`${styles.txStep} ${isConfirming ? styles.stepActive : (isConfirmed ? styles.stepSuccess : styles.stepPending)}`}>
                <span className={`material-symbols-outlined ${isConfirming ? styles.stepIconActive : (isConfirmed ? styles.stepIconSuccess : styles.stepIconPending)}`}>
                  {isConfirmed ? "check_circle" : (isConfirming ? "pending" : "radio_button_unchecked")}
                </span>
                <div>
                  <p className={styles.stepLabel} style={{ color: isConfirmed ? "#22c55e" : (isConfirming ? "var(--brand-accent)" : "#8888aa") }}>Step 2</p>
                  <p className={styles.stepText} style={{ color: isConfirming || isConfirmed ? "inherit" : "#8888aa" }}>Broadcasting</p>
                </div>
              </div>

              <div className={`${styles.txStep} ${isConfirmed ? styles.stepSuccess : styles.stepPending}`}>
                <span className={`material-symbols-outlined ${isConfirmed ? styles.stepIconSuccess : styles.stepIconPending}`}>
                  {isConfirmed ? "check_circle" : "radio_button_unchecked"}
                </span>
                <div>
                  <p className={styles.stepLabel} style={{ color: isConfirmed ? "#22c55e" : "#8888aa" }}>Step 3</p>
                  <p className={styles.stepText} style={{ color: isConfirmed ? "inherit" : "#8888aa" }}>Confirmation</p>
                </div>
              </div>
            </div>

            <div className={styles.terminalOutput}>
              <div className={styles.terminalHeader}>
                <div className={`${styles.terminalDot} ${styles.tdRed}`}></div>
                <div className={`${styles.terminalDot} ${styles.tdYellow}`}></div>
                <div className={`${styles.terminalDot} ${styles.tdGreen}`}></div>
                <span className={styles.terminalTitle}>Terminal Output</span>
              </div>
              <div className={styles.terminalLines}>
                <p className={styles.termLine}>
                  <span className={styles.termCheck}>✓</span> <span className={styles.termTextGrey}>Initializing provider connection...</span>
                </p>
                <p className={styles.termLine}>
                  <span className={styles.termCheck}>✓</span> <span className={styles.termTextGrey}>Encoding `{voteAction}` vote data [Prop ID: {proposalId}]...</span>
                </p>
                {hash && (
                  <p className={styles.termLine}>
                    <span className={styles.termArrow}>→</span> <span className={styles.termTextActive}>Broadcasting to DAO contract...</span>
                  </p>
                )}
                {isConfirming && (
                  <p className={styles.termLine}>
                    <span className={styles.termArrow}>→</span> <span className={styles.termTextActive}>Waiting for block confirmation [Attempt 1]...</span>
                  </p>
                )}
                {!isConfirmed ? (
                  <p className={styles.termLine} style={{ animation: "pulse 2s infinite" }}>
                    <span className={styles.termTextGrey}>_ Syncing nodes...</span>
                  </p>
                ) : (
                  <p className={styles.termLine}>
                    <span className={styles.termCheck}>✓</span> <span className={styles.termTextActive} style={{ color: "#22c55e" }}>Transaction Confirmed!</span>
                  </p>
                )}
              </div>
            </div>

            {isConfirmed && (
              <div className={styles.overlayNav}>
                <Link href="/" className={styles.btnSecondary} onClick={() => setVoteTerminalVisible(false)}>
                  <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Leaderboard
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <section className={styles.heroSection}>
        <div className={styles.heroLeft}>
          <div className={styles.idBlock}>
            <span className={`material-symbols-outlined ${styles.idIcon}`}>description</span>
            <span className={styles.idText}>#PROP-{proposalId.padStart(4, '0')}</span>
          </div>

          <div className={styles.heroInfo}>
            <div className={styles.statusRow}>
              <span className={`${styles.statusBadge} ${statusInfo.style === 'Green' ? styles.statusBadgeGreen : (statusInfo.style === 'Gray' ? styles.statusBadgeGray : '')}`}>
                {statusInfo.text}
              </span>
              <span className={styles.heroId}>ID: #PROP-{proposalId.padStart(4, '0')}</span>
            </div>
            <h1 className={styles.heroTitle}>{proposal.title}</h1>

            <div className={styles.metaRow}>
              <div className={styles.metaItem}>
                <span className={`material-symbols-outlined ${styles.metaIcon}`}>person</span>
                <span className={styles.metaText}>Proposer: {proposal.applicant.slice(0, 6)}...{proposal.applicant.slice(-4)}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={`material-symbols-outlined ${styles.metaIcon}`}>payments</span>
                <span className={styles.metaText}>Amount: {Number(formatUnits(proposal.requestedAmount, 18)).toLocaleString()} PAS</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.scoreCard}>
          <div className={styles.scoreBgIcon}>
            <span className="material-symbols-outlined">bolt</span>
          </div>
          <p className={styles.scoreLabel}>AI Trust Score</p>
          <div className={styles.scoreValue}>
            {formattedScore}
            <span className={styles.scoreMax}>/100</span>
          </div>

          <div className={styles.scoreTrack}>
            <div
              className={`${styles.scoreFill} ${proposal.aiReviewed && proposal.aiScore < 50 ? styles.scoreFillLow : ''}`}
              style={{ width: proposal.aiReviewed ? `${proposal.aiScore}%` : "0%" }}
            ></div>
          </div>
          <p className={styles.scoreSubtext}>Confidence Interval: {confidenceInterval} Accuracy</p>
        </div>
      </section>

      <div className={styles.mainGrid}>

        <aside className={styles.asideLeft}>
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>
              <span className={`material-symbols-outlined ${styles.panelIcon}`}>analytics</span>
              AI Analysis Panel
            </h3>

            <div className={styles.analysisList}>
              {proposal.aiReviewed ? (
                <>
                  <div className={`${styles.analysisItem} ${styles.analysisStrengths}`}>
                    <p className={`${styles.analysisLabel} ${styles.labelGreen}`}>Evaluation</p>
                    <p className={styles.analysisValue}>Oracle Verified</p>
                    <p className={styles.analysisDesc}>{proposal.aiSummary}</p>
                  </div>
                  <div className={`${styles.analysisItem} ${styles.analysisImpact}`}>
                    <p className={`${styles.analysisLabel} ${styles.labelPurple}`}>Ecosystem Fit</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f0f0f0' }}>{proposal.category}</span>
                    </div>
                    <p className={styles.analysisDesc}>Aligned with decentralized protocol specs.</p>
                  </div>
                </>
              ) : (
                <div className={`${styles.analysisItem} ${styles.analysisRisks}`}>
                  <p className={`${styles.analysisLabel} ${styles.labelYellow}`}>Pending</p>
                  <p className={styles.analysisValue}>Awaiting Evaluation</p>
                  <p className={styles.analysisDesc}>The Neural Oracle is currently analyzing this proposal&apos;s feasibility.</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className={styles.centerContent}>
          <article className={styles.articlePanel}>
            <h2 className={styles.articleTitle}>Executive Summary</h2>
            <div className={styles.prose}>
              {proposal.cleanDescription.split('\n').map((paragraph, idx) => (
                paragraph.trim() !== "" && <p key={idx}>{paragraph}</p>
              ))}
            </div>
          </article>
        </div>

        <aside className={styles.asideRight}>
          <div className={styles.panel} style={{ position: 'sticky', top: '6rem' }}>
            <h3 className={styles.decisionLabel}>Decision Terminal</h3>
            <p className={styles.decisionDesc}>Review the AI Analysis before casting your final vote on-chain.</p>

            <div className={styles.btnGroup}>
              <button
                className={styles.btnApprove}
                onClick={() => handleVote(1)}
                disabled={!proposal.exists}
              >
                <div className={styles.btnInner}>
                  <span className="material-symbols-outlined">thumb_up</span>
                  <span>APPROVE</span>
                </div>
                <span className={styles.btnSub}>Record &quot;For&quot; Vote</span>
              </button>

              <button
                className={styles.btnReject}
                onClick={() => handleVote(0)}
                disabled={!proposal.exists}
              >
                <div className={styles.btnInner}>
                  <span className="material-symbols-outlined">thumb_down</span>
                  <span>REJECT</span>
                </div>
                <span className={styles.btnSub}>Record &quot;Against&quot; Vote</span>
              </button>
            </div>

            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--brand-border)' }}>
              <p style={{ fontSize: '0.625rem', color: '#8888aa', fontStyle: 'italic', lineHeight: 1.5 }}>
                *By voting, you broadcast a signed transaction to the GrantDAO contract, establishing immutable consensus based on technical merit.
              </p>
            </div>
          </div>

          <div className={styles.panel}>
            <h3 className={styles.decisionLabel}>Technical Metrics</h3>
            <div className={styles.metricsList}>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Category</span>
                <span className={styles.metricVal}>{proposal.category}</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Recipient</span>
                <span className={styles.metricVal}>{proposal.recipientWallet.slice(0, 6)}...{proposal.recipientWallet.slice(-4)}</span>
              </div>
            </div>
          </div>
        </aside>

      </div>
    </main>
  );
}