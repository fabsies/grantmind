import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.brandArea}>
            <div className={styles.logoWrapper}>
              <Image
                src="/grantmind_logo.png"
                alt="GrantMind"
                width={28}
                height={28}
                style={{ imageRendering: 'pixelated' }}
              />
              <span className={styles.logoText}>GrantMind</span>
            </div>
            <p className={styles.copyright}>© 2024 GRANTMIND_PROTOCOL. ALL RIGHTS RESERVED.</p>
          </div>

          <div className={styles.links}>
            <Link href="/" className={styles.link}>DOCUMENTATION</Link>
            <Link href="/" className={styles.link}>GITHUB</Link>
            <Link href="/" className={styles.link}>DISCORD</Link>
          </div>

          <div className={styles.statusBadge}>
            <div className={styles.statusDot}></div>
            <span className={styles.statusText}>System Operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
