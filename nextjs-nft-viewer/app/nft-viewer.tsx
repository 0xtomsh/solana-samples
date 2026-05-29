"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowUpDown,
  BadgeCheck,
  ChevronRight,
  Copy,
  ExternalLink,
  Grid3X3,
  ImageIcon,
  Layers3,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

type ChainId = "ethereum" | "polygon" | "base" | "arbitrum" | "optimism" | "solana";
type LoadState = "idle" | "loading" | "ready" | "error";
type SortMode = "name-asc" | "chain-asc" | "collection-asc";
type ViewMode = "dashboard" | "gallery" | "detail";

type EvmProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
  providers?: EvmProvider[];
};

type UnifiedNft = {
  id: string;
  chain: ChainId;
  owner: string;
  contractOrMint: string;
  tokenId: string;
  name: string;
  collection: string;
  image: string;
  metadataUri: string;
  description: string;
  tokenType: string;
  acquiredAt: string;
  attributes: Array<{ trait_type: string; value: string }>;
};

declare global {
  interface Window {
    ethereum?: EvmProvider;
  }
}

const CHAINS: Array<{ id: ChainId; label: string; shortLabel: string }> = [
  { id: "ethereum", label: "Ethereum", shortLabel: "ETH" },
  { id: "solana", label: "Solana", shortLabel: "SOL" },
  { id: "base", label: "Base", shortLabel: "BASE" },
  { id: "polygon", label: "Polygon", shortLabel: "POLY" },
  { id: "arbitrum", label: "Arbitrum", shortLabel: "ARB" },
  { id: "optimism", label: "Optimism", shortLabel: "OP" },
];

const EVM_CHAINS = CHAINS.filter((chain) => chain.id !== "solana").map(
  (chain) => chain.id
);

export function NftViewer() {
  const { publicKey } = useWallet();
  const [evmAddress, setEvmAddress] = useState("");
  const [manualEvmAddress, setManualEvmAddress] = useState("");
  const [manualSolanaAddress, setManualSolanaAddress] = useState("");
  const [items, setItems] = useState<UnifiedNft[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("Connect a wallet to open the dashboard.");
  const [query, setQuery] = useState("");
  const [chainFilter, setChainFilter] = useState<ChainId | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("collection-asc");
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [selectedId, setSelectedId] = useState("");
  const [isConnectingEvm, setIsConnectingEvm] = useState(false);

  const solanaAddress = publicKey?.toBase58() ?? "";
  const activeEvmAddress = manualEvmAddress.trim() || evmAddress;
  const activeSolanaAddress = manualSolanaAddress.trim() || solanaAddress;
  const hasConnectedWallet = Boolean(evmAddress || solanaAddress);
  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0];

  useEffect(() => {
    if (!selectedId && items[0]) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider?.request) return;

    void provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (Array.isArray(accounts) && typeof accounts[0] === "string") {
          setEvmAddress(accounts[0]);
        }
      })
      .catch(() => undefined);

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0];
      if (Array.isArray(accounts) && typeof accounts[0] === "string") {
        setEvmAddress(accounts[0]);
      } else {
        setEvmAddress("");
      }
    };

    provider.on?.("accountsChanged", handleAccountsChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items
      .filter((item) => chainFilter === "all" || item.chain === chainFilter)
      .filter((item) => {
        if (!normalizedQuery) return true;
        return [
          item.name,
          item.collection,
          item.chain,
          item.contractOrMint,
          item.tokenId,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sortMode === "name-asc") return a.name.localeCompare(b.name);
        if (sortMode === "chain-asc") return a.chain.localeCompare(b.chain);
        return a.collection.localeCompare(b.collection);
      });
  }, [chainFilter, items, query, sortMode]);

  const stats = useMemo(() => {
    const chains = new Set(items.map((item) => item.chain));
    const collections = new Set(items.map((item) => item.collection).filter(Boolean));
    const withMedia = items.filter((item) => item.image).length;

    return {
      total: items.length,
      chains: chains.size,
      collections: collections.size,
      withMedia,
    };
  }, [items]);

  const connectEvmWallet = async () => {
    setIsConnectingEvm(true);
    setState("loading");
    setMessage("Checking for an EVM wallet...");

    try {
      const provider = await getEvmProvider();

      if (!provider) {
        setState("error");
        setMessage(
          "No EVM wallet was detected. Install or unlock MetaMask, Rabby, Coinbase Wallet, or another injected EVM wallet."
        );
        return;
      }

      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      if (Array.isArray(accounts) && typeof accounts[0] === "string") {
        setEvmAddress(accounts[0]);
        setState("ready");
        setMessage("EVM wallet connected.");
        return;
      }

      setState("error");
      setMessage("The EVM wallet did not return an account.");
    } catch {
      setState("error");
      setMessage("EVM wallet connection was cancelled or failed.");
    } finally {
      setIsConnectingEvm(false);
    }
  };

  const loadNfts = useCallback(async () => {
    if (!activeEvmAddress && !activeSolanaAddress) {
      setMessage("Connect a wallet or paste at least one owner address.");
      return;
    }

    setState("loading");
    setMessage("Loading NFTs from Alchemy across selected chains...");

    const requests: Array<Promise<UnifiedNft[]>> = [];

    if (activeEvmAddress) {
      for (const chain of EVM_CHAINS) {
        requests.push(fetchNfts(chain, activeEvmAddress));
      }
    }

    if (activeSolanaAddress) {
      requests.push(fetchNfts("solana", activeSolanaAddress));
    }

    const results = await Promise.allSettled(requests);
    const nextItems = results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );
    const failedCount = results.filter((result) => result.status === "rejected").length;

    setItems(nextItems);
    setSelectedId(nextItems[0]?.id ?? "");
    setViewMode(nextItems.length ? "gallery" : "dashboard");
    setState(failedCount === results.length ? "error" : "ready");
    setMessage(
      nextItems.length
        ? `Loaded ${nextItems.length} NFTs${failedCount ? `, with ${failedCount} chain request issue${failedCount === 1 ? "" : "s"}` : ""}.`
        : failedCount
          ? "Alchemy could not return NFTs. Check ALCHEMY_API_KEY and wallet addresses."
          : "No NFTs were found for the connected addresses."
    );
  }, [activeEvmAddress, activeSolanaAddress]);

  const copyAddress = async (value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  if (!hasConnectedWallet) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0d0f0f] p-6 text-white max-md:p-3">
        <section className="w-[min(520px,100%)] rounded-lg border border-white/10 bg-[#050808] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.62)]">
          <div className="grid place-items-center text-center">
            <div className="grid h-20 w-20 place-items-center rounded-lg bg-[#a7ff10] text-black shadow-[0_0_38px_rgba(167,255,16,0.3)]">
              <Sparkles size={34} />
            </div>
            <p className="mt-6 text-xs font-black uppercase text-[#a7ff10]">
              Multi-chain NFT Viewer
            </p>
            <h1 className="mt-3 text-4xl font-black leading-none tracking-normal max-md:text-3xl">
              Connect wallet
            </h1>
            <p className="mt-4 max-w-[380px] text-sm leading-6 text-slate-400">
              Connect an EVM wallet or a Solana wallet to open the dashboard.
            </p>
          </div>

          <div
            className={`mt-6 rounded-lg border px-3 py-2 text-center text-sm font-bold leading-6 ${
              state === "error"
                ? "border-red-400/30 bg-red-500/10 text-red-200"
                : "border-white/10 bg-white/[0.04] text-slate-300"
            }`}
          >
            {message}
          </div>

          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={connectEvmWallet}
              disabled={isConnectingEvm}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#a7ff10] px-4 font-black text-black transition hover:bg-white"
            >
              {isConnectingEvm ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Wallet size={18} />
              )}
              {isConnectingEvm ? "Checking wallet..." : "Connect EVM"}
            </button>
            <div className="solana-wallet-button">
              <WalletMultiButton />
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d0f0f] p-6 text-white max-md:p-3">
      <section className="mx-auto grid w-[min(1320px,100%)] grid-cols-[minmax(0,1fr)_360px] gap-4 max-xl:grid-cols-1">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#050808] shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
          <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-5 max-lg:flex-col max-lg:items-start">
            <div>
              <p className="text-xs font-black uppercase text-[#a7ff10]">
                Multi-chain NFT command center
              </p>
              <h1 className="mt-2 text-4xl font-black leading-none tracking-normal max-md:text-3xl">
                Wallet dashboard
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("dashboard")}
                className={navClass(viewMode === "dashboard")}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setViewMode("gallery")}
                className={navClass(viewMode === "gallery")}
              >
                Gallery
              </button>
              <button
                type="button"
                onClick={() => selectedItem && setViewMode("detail")}
                disabled={!selectedItem}
                className={navClass(viewMode === "detail")}
              >
                Detail
              </button>
            </div>
          </header>

          <section className="px-6 py-5">
            <WalletManager
              activeEvmAddress={activeEvmAddress}
              activeSolanaAddress={activeSolanaAddress}
              connectEvmWallet={connectEvmWallet}
              evmAddress={evmAddress}
              isConnectingEvm={isConnectingEvm}
              manualEvmAddress={manualEvmAddress}
              manualSolanaAddress={manualSolanaAddress}
              onCopy={copyAddress}
              onManualEvmAddress={setManualEvmAddress}
              onManualSolanaAddress={setManualSolanaAddress}
              solanaAddress={solanaAddress}
            />
          </section>

          <section className="grid grid-cols-[1fr_auto] items-center gap-4 px-6 pb-5 max-lg:grid-cols-1">
            <div
              className={`rounded-lg border px-4 py-3 text-sm font-bold leading-6 ${
                state === "error"
                  ? "border-red-400/30 bg-red-500/10 text-red-200"
                  : "border-white/10 bg-white/[0.04] text-slate-300"
              }`}
            >
              {message}
            </div>
            <button
              type="button"
              onClick={loadNfts}
              disabled={state === "loading"}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#a7ff10] px-5 font-black text-black shadow-[0_0_30px_rgba(167,255,16,0.24)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === "loading" ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Layers3 size={18} />
              )}
              Load NFTs
            </button>
          </section>

          <section className="grid grid-cols-4 gap-3 px-6 pb-5 max-lg:grid-cols-2 max-md:grid-cols-1">
            <Metric icon={<Grid3X3 size={18} />} label="NFTs" value={stats.total} />
            <Metric icon={<ShieldCheck size={18} />} label="Chains" value={stats.chains} />
            <Metric icon={<BadgeCheck size={18} />} label="Collections" value={stats.collections} />
            <Metric icon={<ImageIcon size={18} />} label="Media" value={stats.withMedia} />
          </section>

          <section className="mx-6 mb-5 rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_170px_190px] gap-3 max-lg:grid-cols-1">
              <label className="relative block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  size={18}
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search NFTs, collections, chains"
                  className="h-11 w-full rounded-md border border-white/10 bg-black/30 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#a7ff10]"
                />
              </label>
              <select
                value={chainFilter}
                onChange={(event) =>
                  setChainFilter(event.target.value as ChainId | "all")
                }
                className="h-11 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-white outline-none focus:border-[#a7ff10]"
              >
                <option value="all">All chains</option>
                {CHAINS.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.label}
                  </option>
                ))}
              </select>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-11 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-white outline-none focus:border-[#a7ff10]"
              >
                <option value="collection-asc">Sort by collection</option>
                <option value="name-asc">Sort by name</option>
                <option value="chain-asc">Sort by chain</option>
              </select>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
          </section>

          {viewMode === "dashboard" ? (
            <DashboardPanel />
          ) : viewMode === "detail" && selectedItem ? (
            <DetailPanel item={selectedItem} />
          ) : (
            <Gallery
              items={filteredItems}
              selectedId={selectedId}
              onSelect={(item) => {
                setSelectedId(item.id);
                setViewMode("detail");
              }}
            />
          )}
        </div>

        <aside className="rounded-lg border border-white/10 bg-[#15171c] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.36)]">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">Portfolio</h2>
            <span className="rounded-full bg-[#a7ff10] px-3 py-1 text-xs font-black text-black">
              {filteredItems.length} visible
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {CHAINS.map((chain, index) => {
              const count = items.filter((item) => item.chain === chain.id).length;
              return (
                <button
                  key={chain.id}
                  type="button"
                  onClick={() => setChainFilter(chain.id)}
                  className={`flex w-full items-center justify-between rounded-lg p-4 text-left transition hover:translate-x-1 ${
                    index % 3 === 0
                      ? "bg-[#a7ff10] text-black"
                      : index % 3 === 1
                        ? "bg-[#1748ff] text-white"
                        : "bg-[#090b0d] text-white"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-black uppercase">
                      {chain.label}
                    </span>
                    <span className="mt-1 block text-xs font-bold opacity-70">
                      {chain.shortLabel}
                    </span>
                  </span>
                  <span className="text-2xl font-black">{count}</span>
                </button>
              );
            })}
          </div>

          {selectedItem ? (
            <div className="mt-5 rounded-lg bg-[#090b0d] p-4">
              <p className="text-xs font-black uppercase text-[#a7ff10]">
                Selected NFT
              </p>
              <h3 className="mt-2 truncate text-xl font-black">{selectedItem.name}</h3>
              <p className="mt-1 truncate text-sm text-slate-400">
                {selectedItem.collection}
              </p>
              <button
                type="button"
                onClick={() => setViewMode("detail")}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-black text-black"
              >
                Open metadata
                <ChevronRight size={16} />
              </button>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function DashboardPanel() {
  return (
    <section className="px-6 pb-6">
      <div className="rounded-lg border border-white/10 bg-[#0b1015] p-5">
        <p className="text-xs font-black uppercase text-[#a7ff10]">Workflow</p>
        <h2 className="mt-2 text-3xl font-black">Unified NFT inventory</h2>
        <div className="mt-5 grid grid-cols-3 gap-3 max-lg:grid-cols-1">
          {[
            "Connect EVM and Solana wallets.",
            "Load live NFTs through Alchemy API routes.",
            "Search, sort, filter, and open metadata detail views.",
          ].map((item, index) => (
            <div
              key={item}
              className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-lg bg-white/[0.04] p-3"
            >
              <span className="grid h-11 w-11 place-items-center rounded-md bg-[#1748ff] text-sm font-black">
                {index + 1}
              </span>
              <span className="font-bold text-slate-200">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gallery({
  items,
  selectedId,
  onSelect,
}: {
  items: UnifiedNft[];
  selectedId: string;
  onSelect: (item: UnifiedNft) => void;
}) {
  if (!items.length) {
    return (
      <section className="px-6 pb-8">
        <div className="grid min-h-[280px] place-items-center rounded-lg border border-dashed border-white/15 bg-white/[0.03] text-center">
          <div>
            <ImageIcon className="mx-auto text-slate-500" size={42} />
            <p className="mt-4 text-lg font-black">No NFTs to display</p>
            <p className="mt-2 text-sm text-slate-400">
              Load a wallet or adjust search and chain filters.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-4 gap-4 px-6 pb-6 max-xl:grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          className={`overflow-hidden rounded-lg border text-left transition hover:-translate-y-1 ${
            item.id === selectedId
              ? "border-[#a7ff10] bg-[#111820]"
              : "border-white/10 bg-[#0b1015]"
          }`}
        >
          <div className="grid aspect-square place-items-center bg-[#15171c]">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt={item.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <ImageIcon size={40} className="text-slate-500" />
            )}
          </div>
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="rounded-md bg-[#a7ff10] px-2 py-1 text-xs font-black uppercase text-black">
                {chainLabel(item.chain)}
              </span>
              <ArrowUpDown size={15} className="text-slate-500" />
            </div>
            <h2 className="truncate text-lg font-black text-white">{item.name}</h2>
            <p className="mt-1 truncate text-sm font-bold text-slate-400">
              {item.collection}
            </p>
          </div>
        </button>
      ))}
    </section>
  );
}

function DetailPanel({ item }: { item: UnifiedNft }) {
  return (
    <section className="grid grid-cols-[0.9fr_1.1fr] gap-5 px-6 pb-6 max-lg:grid-cols-1">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1015]">
        <div className="grid aspect-square place-items-center bg-[#15171c]">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={56} className="text-slate-500" />
          )}
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-[#0b1015] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[#1748ff] px-3 py-1 text-xs font-black uppercase">
            {chainLabel(item.chain)}
          </span>
          <span className="rounded-md bg-[#a7ff10] px-3 py-1 text-xs font-black uppercase text-black">
            {item.tokenType || "NFT"}
          </span>
        </div>
        <h2 className="mt-4 text-4xl font-black leading-tight tracking-normal">
          {item.name}
        </h2>
        <p className="mt-2 text-lg font-bold text-slate-300">{item.collection}</p>
        <p className="mt-5 min-h-20 text-sm leading-7 text-slate-400">
          {item.description || "No description metadata was returned for this NFT."}
        </p>

        <div className="mt-5 grid gap-3">
          <MetadataRow label="Contract / mint" value={item.contractOrMint} />
          <MetadataRow label="Token ID" value={item.tokenId} />
          <MetadataRow label="Owner" value={item.owner} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {item.metadataUri ? (
            <a
              href={item.metadataUri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-black text-black"
            >
              Metadata
              <ExternalLink size={15} />
            </a>
          ) : null}
          <a
            href={explorerUrl(item)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 px-4 text-sm font-black text-white"
          >
            Explorer
            <ExternalLink size={15} />
          </a>
        </div>

        <div className="mt-6">
          <p className="mb-3 text-xs font-black uppercase text-[#a7ff10]">Attributes</p>
          <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
            {(item.attributes.length ? item.attributes : [{ trait_type: "Status", value: "No traits" }]).map(
              (attribute) => (
                <div
                  key={`${attribute.trait_type}-${attribute.value}`}
                  className="rounded-lg bg-white/[0.04] p-3"
                >
                  <p className="truncate text-xs font-black uppercase text-slate-500">
                    {attribute.trait_type}
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-white">
                    {attribute.value}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function WalletManager({
  activeEvmAddress,
  activeSolanaAddress,
  connectEvmWallet,
  evmAddress,
  isConnectingEvm,
  manualEvmAddress,
  manualSolanaAddress,
  onCopy,
  onManualEvmAddress,
  onManualSolanaAddress,
  solanaAddress,
}: {
  activeEvmAddress: string;
  activeSolanaAddress: string;
  connectEvmWallet: () => void;
  evmAddress: string;
  isConnectingEvm: boolean;
  manualEvmAddress: string;
  manualSolanaAddress: string;
  onCopy: (value: string) => void;
  onManualEvmAddress: (value: string) => void;
  onManualSolanaAddress: (value: string) => void;
  solanaAddress: string;
}) {
  const hasConnectedWallet = Boolean(evmAddress || solanaAddress);
  const [isExpanded, setIsExpanded] = useState(!hasConnectedWallet);

  useEffect(() => {
    setIsExpanded(!hasConnectedWallet);
  }, [hasConnectedWallet]);

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035]">
      <div className="flex items-center justify-between gap-3 px-4 py-3 max-md:flex-col max-md:items-stretch">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase text-slate-500">
              Wallets
            </p>
            {evmAddress ? (
              <span className="rounded-md bg-[#a7ff10] px-2 py-1 text-xs font-black uppercase text-black">
                EVM connected
              </span>
            ) : null}
            {solanaAddress ? (
              <span className="rounded-md bg-[#1748ff] px-2 py-1 text-xs font-black uppercase text-white">
                Solana connected
              </span>
            ) : null}
          </div>
          <p className="mt-2 truncate font-mono text-sm text-slate-300">
            {[activeEvmAddress, activeSolanaAddress]
              .filter(Boolean)
              .map(formatCompactAddress)
              .join(" / ")}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-sm font-black text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]"
        >
          <ChevronRight
            className={`transition ${isExpanded ? "rotate-90" : ""}`}
            size={16}
          />
          {isExpanded ? "Hide wallets" : "Show wallets"}
        </button>
      </div>

      {isExpanded ? (
        <div className="grid grid-cols-2 gap-4 border-t border-white/10 p-4 max-lg:grid-cols-1">
          <WalletAccountCard
            accent="lime"
            activeAddress={activeEvmAddress}
            connectedAddress={evmAddress}
            connectControl={
              <button
                type="button"
                onClick={connectEvmWallet}
                disabled={isConnectingEvm}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#a7ff10] px-3 text-sm font-black text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isConnectingEvm ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Wallet size={16} />
                )}
                {isConnectingEvm ? "Checking..." : evmAddress ? "Reconnect" : "Connect"}
              </button>
            }
            label="EVM wallet"
            manualAddress={manualEvmAddress}
            onCopy={onCopy}
            onManualAddress={onManualEvmAddress}
            placeholder="Paste EVM address override"
          />
          <WalletAccountCard
            accent="blue"
            activeAddress={activeSolanaAddress}
            connectedAddress={solanaAddress}
            connectControl={
              <div className="solana-wallet-button wallet-inline-button">
                <WalletMultiButton />
              </div>
            }
            label="Solana wallet"
            manualAddress={manualSolanaAddress}
            onCopy={onCopy}
            onManualAddress={onManualSolanaAddress}
            placeholder="Paste Solana address override"
          />
        </div>
      ) : null}
    </section>
  );
}

function WalletAccountCard({
  accent,
  activeAddress,
  connectedAddress,
  connectControl,
  label,
  onCopy,
  manualAddress,
  onManualAddress,
  placeholder,
}: {
  accent: "lime" | "blue";
  activeAddress: string;
  connectedAddress: string;
  connectControl: React.ReactNode;
  label: string;
  manualAddress: string;
  onCopy: (value: string) => void;
  onManualAddress: (value: string) => void;
  placeholder: string;
}) {
  const isOverridden = Boolean(manualAddress.trim());

  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-black uppercase ${
              accent === "lime" ? "text-[#a7ff10]" : "text-[#6d8cff]"
            }`}
          >
            {label}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-1 text-xs font-black uppercase ${
                connectedAddress
                  ? "bg-[#a7ff10] text-black"
                  : "bg-white/[0.07] text-slate-400"
              }`}
            >
              {connectedAddress ? "Connected" : "Not connected"}
            </span>
            {isOverridden ? (
              <span className="rounded-md bg-[#1748ff] px-2 py-1 text-xs font-black uppercase text-white">
                Override
              </span>
            ) : null}
          </div>
        </div>
        {connectControl}
      </div>

      <div className="mt-4 rounded-lg bg-black/25 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-black uppercase text-slate-500">
            Active address
          </p>
          <button
            type="button"
            onClick={() => onCopy(activeAddress)}
            disabled={!activeAddress}
            title="Copy address"
            className="grid h-8 w-8 place-items-center rounded-md border border-white/10 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Copy size={15} />
          </button>
        </div>
        <code className="block min-h-10 [overflow-wrap:anywhere] font-mono text-sm leading-5 text-slate-200">
          {activeAddress || "Connect wallet or paste an override address"}
        </code>
      </div>

      <label className="mt-3 block">
        <span className="mb-2 block text-xs font-black uppercase text-slate-500">
          View another address
        </span>
        <input
          value={manualAddress}
          onChange={(event) => onManualAddress(event.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#a7ff10]"
        />
      </label>
    </article>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 text-[#a7ff10]">{icon}</div>
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <strong className="mt-2 block text-3xl font-black leading-none">{value}</strong>
    </article>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.04] p-3">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-all font-mono text-sm text-slate-200">
        {value || "-"}
      </p>
    </div>
  );
}

async function fetchNfts(chain: ChainId, owner: string) {
  const params = new URLSearchParams({ chain, owner, limit: "48" });
  const response = await fetch(`/api/nfts?${params.toString()}`);
  const data = (await response.json()) as { items?: UnifiedNft[]; error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "NFT request failed");
  }

  return data.items ?? [];
}

async function getEvmProvider() {
  if (window.ethereum?.request) {
    return window.ethereum.providers?.[0] ?? window.ethereum;
  }

  return new Promise<EvmProvider | null>((resolve) => {
    let resolved = false;

    const finish = (provider: EvmProvider | null) => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener("eip6963:announceProvider", handleProvider);
      resolve(provider);
    };

    const handleProvider = (event: Event) => {
      const provider = (event as CustomEvent<{ provider?: EvmProvider }>).detail
        ?.provider;
      if (provider?.request) {
        finish(provider);
      }
    };

    window.addEventListener("eip6963:announceProvider", handleProvider);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.setTimeout(() => finish(null), 700);
  });
}

function navClass(active: boolean) {
  return `h-10 rounded-md px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
    active ? "bg-[#a7ff10] text-black" : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
  }`;
}

function chainLabel(chain: ChainId) {
  return CHAINS.find((item) => item.id === chain)?.shortLabel ?? chain;
}

function formatCompactAddress(address: string) {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function explorerUrl(item: UnifiedNft) {
  if (item.chain === "solana") {
    return `https://explorer.solana.com/address/${item.contractOrMint}`;
  }
  if (item.chain === "polygon") {
    return `https://polygonscan.com/token/${item.contractOrMint}?a=${item.tokenId}`;
  }
  if (item.chain === "base") {
    return `https://basescan.org/token/${item.contractOrMint}?a=${item.tokenId}`;
  }
  if (item.chain === "arbitrum") {
    return `https://arbiscan.io/token/${item.contractOrMint}?a=${item.tokenId}`;
  }
  if (item.chain === "optimism") {
    return `https://optimistic.etherscan.io/token/${item.contractOrMint}?a=${item.tokenId}`;
  }

  return `https://etherscan.io/token/${item.contractOrMint}?a=${item.tokenId}`;
}
