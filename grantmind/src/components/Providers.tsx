'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { CHAIN_CONFIG } from '@/config/contracts';

const passetHub = {
  id: CHAIN_CONFIG.id,
  name: 'Passet Hub Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'PAS',
    symbol: 'PAS',
  },
  rpcUrls: {
    default: { http: [CHAIN_CONFIG.rpcUrl] },
  },
} as const;

const config = createConfig({
  chains: [passetHub],
  connectors: [injected()],
  transports: {
    [passetHub.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
