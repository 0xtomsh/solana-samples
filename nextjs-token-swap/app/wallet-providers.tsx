"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";

export type SwapNetworkId = "mainnet-beta" | "devnet" | "testnet";

type SwapNetworkConfig = {
  id: SwapNetworkId;
  label: string;
  adapterNetwork: WalletAdapterNetwork;
  endpoint: string;
  solscanCluster: string;
  jupiterSwap: boolean;
  mockSwap: boolean;
};

const NETWORK_CONFIGS: Record<SwapNetworkId, SwapNetworkConfig> = {
  "mainnet-beta": {
    id: "mainnet-beta",
    label: "Mainnet",
    adapterNetwork: WalletAdapterNetwork.Mainnet,
    endpoint:
      process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL ??
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
      clusterApiUrl(WalletAdapterNetwork.Mainnet),
    solscanCluster: "",
    jupiterSwap: true,
    mockSwap: false,
  },
  devnet: {
    id: "devnet",
    label: "Devnet",
    adapterNetwork: WalletAdapterNetwork.Devnet,
    endpoint:
      process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL ??
      clusterApiUrl(WalletAdapterNetwork.Devnet),
    solscanCluster: "?cluster=devnet",
    jupiterSwap: false,
    mockSwap: true,
  },
  testnet: {
    id: "testnet",
    label: "Testnet",
    adapterNetwork: WalletAdapterNetwork.Testnet,
    endpoint:
      process.env.NEXT_PUBLIC_SOLANA_TESTNET_RPC_URL ??
      clusterApiUrl(WalletAdapterNetwork.Testnet),
    solscanCluster: "?cluster=testnet",
    jupiterSwap: false,
    mockSwap: false,
  },
};

const SwapNetworkContext = createContext<{
  networkId: SwapNetworkId;
  network: SwapNetworkConfig;
  networks: SwapNetworkConfig[];
  setNetworkId: (networkId: SwapNetworkId) => void;
} | null>(null);

export function WalletProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [networkId, setNetworkId] = useState<SwapNetworkId>("mainnet-beta");
  const network = NETWORK_CONFIGS[networkId];
  const endpoint = useMemo(
    () => network.endpoint,
    [network]
  );
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: network.adapterNetwork }),
    ],
    [network]
  );
  const value = useMemo(
    () => ({
      networkId,
      network,
      networks: Object.values(NETWORK_CONFIGS),
      setNetworkId,
    }),
    [networkId, network]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[#eef4ff] text-[#11161f]">
        <div className="mx-auto grid min-h-screen w-[min(1180px,calc(100%-32px))] place-items-center px-4">
          <div className="rounded-lg border border-[#bfdbfe] bg-white/90 p-5 text-sm font-black text-[#2563eb] shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
            Loading token swap...
          </div>
        </div>
      </main>
    );
  }

  return (
    <SwapNetworkContext.Provider value={value}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </SwapNetworkContext.Provider>
  );
}

export function useSwapNetwork() {
  const value = useContext(SwapNetworkContext);
  if (!value) {
    throw new Error("useSwapNetwork must be used within WalletProviders.");
  }
  return value;
}
