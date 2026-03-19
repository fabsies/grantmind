"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseAbi, parseUnits, decodeEventLog } from "viem";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { useToast } from "@/components/ToastContext";
import styles from './Submit.module.css';

const GRANT_REGISTRY_ABI = parseAbi([
  "function submitProposal(string title, string description, uint256 requestedAmount, address recipientWallet, string[] referenceLinks) external",
  "event ProposalSubmitted(uint256 indexed proposalId, address indexed applicant, string title)",
]);

export default function SubmitProposalPage() {
  const { address } = useAccount();
  const { addToast } = useToast();

  const [title, setTitle] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Infrastructure");
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState("");

  const [status, setStatus] = useState<"idle" | "submitting" | "evaluating" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [aiScore, setAiScore] = useState<{ score: number, summary: string, breakdown: object } | null>(null);

  const { data: hash, writeContractAsync } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      setErrorMsg("Please connect your wallet first.");
      return;
    }

    try {
      setStatus("submitting");
      setErrorMsg("");
      setAiScore(null);

      // We combine description and category so the frontend form design matches the single description contract field
      const formattedDescription = `[Category: ${category}]\n\n${description}`;
      const amountInWei = parseUnits(amount || "0", 18);

      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.grantRegistry as `0x\${string}`,
        abi: GRANT_REGISTRY_ABI,
        functionName: "submitProposal",
        args: [title, formattedDescription, amountInWei, recipient as `0x${string}`, [links]],
      });

      // Transaction is broadcasting, wait for confirmation
      setStatus("evaluating");

      // Since useWaitForTransactionReceipt is a hook and we want to trigger the API eagerly after confirmation,
      // we'll rely on a separate useEffect or we can use Wagmi's waitForTransactionReceipt action if imported from @wagmi/core.
      // Easiest is to wait for confirmation next render or using wagmi actions. 
      // For simplicity here, we'll let the hook confirm, then trigger the effect.
    } catch (err: unknown) {
      console.error(err);
      setStatus("error");
      const errorMsg = err instanceof Error ? err.message : "Failed to submit proposal";
      setErrorMsg((err as { shortMessage?: string })?.shortMessage || errorMsg);
    }
  };

  // Listen for confirmation to trigger oracle
  useEffect(() => {
    const handleConfirmation = async () => {
      if (isConfirmed && hash && receipt) {
        try {
          // Find the ProposalSubmitted event in the logs
          const log = receipt.logs.find((l) => {
            try {
              const decoded = decodeEventLog({
                abi: GRANT_REGISTRY_ABI,
                data: l.data as `0x\${string}`,
                topics: l.topics as [`0x\${string}`, ...`0x\${string}`[]],
              });
              return decoded.eventName === "ProposalSubmitted";
            } catch {
              return false;
            }
          });

          if (!log) {
            throw new Error("ProposalSubmitted event not found in receipt");
          }

          const decodedLog = decodeEventLog({
            abi: GRANT_REGISTRY_ABI,
            data: log.data as `0x\${string}`,
            topics: log.topics as [`0x\${string}`, ...`0x\${string}`[]],
          });

          const proposalId = typeof (decodedLog.args as { proposalId?: bigint }).proposalId === 'bigint'
            ? ((decodedLog.args as { proposalId: bigint }).proposalId).toString()
            : "";

          const response = await fetch('/api/oracle/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              proposalId,
              title,
              description: `[Category: \${category}]\\n\\n\${description}`,
              requestedAmount: amount,
              recipientAddress: recipient,
              links
            })
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "AI scoring failed");

          setAiScore(result);
          setStatus("success");
          addToast('Proposal submitted & AI score received!', 'success');
        } catch (error: unknown) {
          console.error("Failed to process confirmation/AI score", error);
          setStatus("error");
          const errMsg = "Transaction successful, but AI evaluation failed: " + (error instanceof Error ? error.message : "Unknown error");
          setErrorMsg(errMsg);
          addToast(errMsg, 'error');
        }
      }
    };
    handleConfirmation();
  }, [isConfirmed, hash, receipt, title, category, description, amount, recipient, links]);

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* Header & Progress */}
        <div className={styles.header}>
          <div className={styles.headerTitleBox}>
            <div>
              <h1 className={styles.title}>SUBMIT PROPOSAL</h1>
              <p className={styles.subtitle}>Deployment Phase: Technical Documentation</p>
            </div>
            <div className={styles.progressText}>
              <span className={styles.progressPercent}>60%</span>
              <p className={styles.progressLabel}>System Integrity</p>
            </div>
          </div>
          <div className={styles.progressBarTrack}>
            <div className={styles.progressBarFill}></div>
          </div>
          <div className={styles.steps}>
            <div className={`\${styles.step} \${styles.start}`}>
              <div className={styles.dot}></div>
              <span className={styles.stepLabelInactive}>Identity</span>
            </div>
            <div className={`\${styles.step} \${styles.center}`}>
              <div className={styles.dot}></div>
              <span className={styles.stepLabelActive}>Specs</span>
            </div>
            <div className={`\${styles.step} \${styles.center}`}>
              <div className={styles.dotInactive}></div>
              <span className={styles.stepLabelInactive}>Roadmap</span>
            </div>
            <div className={`\${styles.step} \${styles.end}`}>
              <div className={styles.dotInactive}></div>
              <span className={styles.stepLabelInactive}>Deploy</span>
            </div>
          </div>
        </div>

        <div className={styles.layoutGrid}>
          <form onSubmit={handleSubmit} className={styles.formArea}>
            {/* Main Form Surface */}
            <section className={styles.surface}>
              <div className={styles.formArea}>
                <div className={styles.formGrid}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Project Name</label>
                    <input
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={styles.hackerInput}
                      placeholder="e.g. NEURAL_BRIDGE_PROTOCOL"
                      type="text"
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Recipient_Wallet_Address</label>
                    <input
                      required
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className={styles.hackerInput}
                      placeholder="0x..."
                      type="text"
                    />
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Grant Amount(PAS)</label>
                    <input
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={styles.hackerInput}
                      placeholder="50000"
                      type="number"
                      min="0"
                      step="any"
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={styles.hackerInput}
                    >
                      <option>Infrastructure</option>
                      <option>ZKP Research</option>
                      <option>Developer Tooling</option>
                      <option>DAO Governance</option>
                    </select>
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Technical_Description</label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={styles.hackerInput}
                    placeholder="Provide system architecture overview..."
                    rows={4}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Github_Repository</label>
                  <div className={styles.inputIconWrapper}>
                    <span className={styles.inputIcon}>link</span>
                    <input
                      value={links}
                      onChange={(e) => setLinks(e.target.value)}
                      className={`\${styles.hackerInput} \${styles.inputWithIcon}`}
                      placeholder="https://github.com/..."
                      type="text"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Milestone Surface */}
            <section className={styles.surface}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>reorder</span>
                Milestone_Sequence
              </h3>

              <div className={styles.milestonesList}>
                <div className={styles.milestoneItem}>
                  <span className={styles.milestoneNumber}>01</span>
                  <div className={styles.milestoneContent}>
                    <p className={styles.milestoneTitle}>Core Engine Beta</p>
                    <p className={styles.milestoneDesc}>Completion of primary smart contracts and audit.</p>
                  </div>
                  <button type="button" className={styles.deleteIcon}>delete</button>
                </div>

                <button type="button" className={styles.addMilestoneBtn}>
                  + Append_New_Milestone
                </button>
              </div>
            </section>

            <div className={styles.actionRow}>
              <button type="button" className={styles.backBtn}>
                &lt; Back
              </button>
              <button
                type="submit"
                disabled={status === "submitting" || status === "evaluating"}
                className={styles.submitBtn}
              >
                {status === "submitting" ? "Awaiting Signature..." : (status === "evaluating" ? "Confirming on Chain..." : "Run AI Evaluation →")}
              </button>
            </div>

            {errorMsg && (
              <div className={styles.errorBanner}>
                [ERROR] {errorMsg}
              </div>
            )}
          </form>

          <aside className={styles.sidebar}>
            {/* AI Side Panel */}
            <div className={styles.aiPanel}>
              <div className={styles.watermark}>psychology</div>
              <h3 className={styles.aiTitle}>AI Neural Evaluation</h3>

              {!aiScore && status !== "evaluating" && (
                <>
                  <p className={styles.aiDesc}>Run predictive analysis on your proposal to detect potential risks and scoring before submission.</p>
                  <button type="button" className={styles.fakeBtn}>
                    <span className={styles.boltIcon}>bolt</span>
                    Run Evaluation.bin
                  </button>
                </>
              )}

              {status === "evaluating" && (
                <div className={styles.evaluatingBox}>
                  <div className={styles.spinner}></div>
                  <span className={styles.evaluatingText}>Running Neural Evaluation...</span>
                </div>
              )}

              {aiScore && (
                <div className={styles.scoreResultBox}>
                  <div className={styles.scoreSummary}>
                    {aiScore.summary}
                  </div>
                  <div className={styles.scoreRow}>
                    <span className={styles.scoreLabel}>Final Score:</span>
                    <span className={aiScore.score > 50 ? styles.scoreValueGreen : styles.scoreValueAmber}>
                      {aiScore.score}/100
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Tip Box */}
            <div className={styles.tipBox}>
              <h4 className={styles.tipTitle}>
                <span className={styles.tipIcon}>info</span>
                System_Tip
              </h4>
              <p className={styles.tipText}>
                Proposals with clear GitHub links and detailed milestones are 45% more likely to be fast-tracked by the Grant Council.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
