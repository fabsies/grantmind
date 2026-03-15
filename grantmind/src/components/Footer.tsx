import React from 'react';
import Link from 'next/link';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.brandArea}>
            <div className={styles.logoWrapper}>
              <div className={styles.logoIcon}>
                <div className={styles.logoInner}></div>
              </div>
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
