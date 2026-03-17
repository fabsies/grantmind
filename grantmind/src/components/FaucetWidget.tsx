'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { governanceTokenAbi } from '@/lib/abis/GovernanceToken';
import { useToast } from './ToastContext';
import styles from './FaucetWidget.module.css';

const GOVERNANCE_TOKEN_ADDRESS = '0x4730aC8A9489c093c4DA1ff8B039d872213C27D5';

export function FaucetWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { address, isConnected } = useAccount();
  const { addToast } = useToast();

  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: GOVERNANCE_TOKEN_ADDRESS,
    abi: governanceTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
    }
  });

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isConfirmed) {
      refetchBalance();
      addToast('100 GMT claimed successfully!', 'success');
    }
  }, [isConfirmed, refetchBalance, addToast]);

  useEffect(() => {
    if (writeError) {
      const msg = (writeError as { shortMessage?: string })?.shortMessage;
      addToast(msg || 'Claim failed. Faucet cooldown may be active.', 'error');
    }
  }, [writeError, addToast]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isConnected) return null;

  const handleClaim = () => {
    writeContract({
      address: GOVERNANCE_TOKEN_ADDRESS,
      abi: governanceTokenAbi,
      functionName: 'faucet',
    });
  };

  const formattedBalance = balanceData !== undefined 
    ? parseFloat(formatUnits(balanceData as bigint, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : '0';

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button 
        className={styles.toggle} 
        onClick={() => setIsOpen(!isOpen)}
        title="Token Faucet"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>water_drop</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <h4 className={styles.title}>Governance Token</h4>
            <span className={styles.balance}>{formattedBalance} <span className={styles.ticker}>GMT</span></span>
          </div>
          <div className={styles.body}>
            <p className={styles.desc}>
              Claim testnet tokens to vote on proposals. Limit once per day.
            </p>
            <button 
              className={styles.claimBtn} 
              onClick={handleClaim}
              disabled={isPending || isConfirming}
            >
              {isPending ? 'Confirming...' : isConfirming ? 'Minting...' : 'Claim 100 GMT'}
            </button>
            {writeError && (
              <p className={styles.error}>
                {(writeError as any).shortMessage || 'Failed to claim. Faucet cooldown might be active.'}
              </p>
            )}
            {isConfirmed && (
              <p className={styles.success}>Tokens claimed successfully!</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
