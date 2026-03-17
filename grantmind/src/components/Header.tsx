'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import styles from './Header.module.css';
import { FaucetWidget } from './FaucetWidget';

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnect = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect({ connector: injected() });
    }
  };

  const displayAddress = isConnected && address 
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : 'CONNECT WALLET';

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logoArea}>
          <div className={styles.logoIcon}>
            <div className={styles.logoInner}></div>
          </div>
          <span className={styles.logoText}>GrantMind</span>
        </Link>

        <div className={styles.links}>
          <Link href="/" className={styles.link}>EXPLORE</Link>
          <Link href="/submit" className={styles.link}>SUBMIT</Link>
          <Link href="/" className={styles.link}>LEADERBOARD</Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <FaucetWidget />
          <button 
            className={styles.connectButton}
            onClick={handleConnect}
          >
            {displayAddress}
          </button>
        </div>
      </nav>
    </header>
  );
}
