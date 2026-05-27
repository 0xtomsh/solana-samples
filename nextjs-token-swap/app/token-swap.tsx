"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  ArrowDownUp,
  ChevronDown,
  ExternalLink,
  History,
  Info,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useSwapNetwork, type SwapNetworkId } from "./wallet-providers";

type Token = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  accent: string;
  gradient: string;
  mark: string;
  native?: boolean;
};

type QuoteResponse = {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: "ExactIn" | "ExactOut";
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    percent?: number;
    bps?: number;
    swapInfo: {
      ammKey: string;
      label?: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
  }>;
  contextSlot?: number;
  timeTaken?: number;
};

type SwapResult = {
  signature: string;
  from: string;
  to: string;
  inputAmount: string;
  outputAmount: string;
  slippage: number;
  route: string;
  createdAt: string;
  networkLabel: string;
  solscanCluster: string;
  mock: boolean;
};

type StatusMessage = {
  tone: "info" | "success" | "error";
  text: string;
  link?: string;
} | null;

const TOKENS: Token[] = [
  {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    accent: "#60a5fa",
    gradient: "linear-gradient(135deg, #22d3ee 0%, #6366f1 52%, #a855f7 100%)",
    mark: "S",
    native: true,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    accent: "#2775ca",
    gradient: "linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)",
    mark: "$",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkYBa1n97NgtUhJp",
    decimals: 6,
    accent: "#26a17b",
    gradient: "linear-gradient(135deg, #14b8a6 0%, #22c55e 100%)",
    mark: "T",
  },
  {
    symbol: "BONK",
    name: "Bonk",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
    accent: "#f6d34f",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #facc15 52%, #fb7185 100%)",
    mark: "B",
  },
];

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1];
const HISTORY_KEY = "nextjs-token-swap-history";
const MOCK_PRICES_USD: Record<string, number> = {
  SOL: 158,
  USDC: 1,
  USDT: 1,
  BONK: 0.000022,
};

export function TokenSwap() {
  const { connection } = useConnection();
  const { connected, publicKey, signMessage, signTransaction } = useWallet();
  const { networkId, network, networks, setNetworkId } = useSwapNetwork();
  const [fromSymbol, setFromSymbol] = useState("SOL");
  const [toSymbol, setToSymbol] = useState("USDC");
  const [amount, setAmount] = useState("0.01");
  const [slippageMode, setSlippageMode] = useState<"preset" | "custom">(
    "preset",
  );
  const [slippage, setSlippage] = useState(0.5);
  const [customSlippage, setCustomSlippage] = useState("0.5");
  const [balances, setBalances] = useState<Record<string, number | null>>({});
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<StatusMessage>(null);
  const [history, setHistory] = useState<SwapResult[]>([]);
  const quoteRequestId = useRef(0);

  const fromToken = tokenBySymbol(fromSymbol);
  const toToken = tokenBySymbol(toSymbol);
  const inputAmount = Number(amount);
  const safeInputAmount =
    Number.isFinite(inputAmount) && inputAmount > 0 ? inputAmount : 0;
  const activeSlippage =
    slippageMode === "custom" ? Number(customSlippage) : slippage;
  const safeSlippage =
    Number.isFinite(activeSlippage) && activeSlippage > 0
      ? activeSlippage
      : 0.5;
  const fromBalance = balances[fromToken.symbol] ?? null;
  const toBalance = balances[toToken.symbol] ?? null;
  const displayFromBalance =
    connected && !balanceLoading ? (fromBalance ?? 0) : fromBalance;
  const displayToBalance =
    connected && !balanceLoading ? (toBalance ?? 0) : toBalance;
  const hasLoadedFromBalance =
    connected && !balanceLoading && displayFromBalance !== null;
  const hasZeroFromBalance = hasLoadedFromBalance && displayFromBalance <= 0;

  const routeLabel = useMemo(() => formatRoute(quote), [quote]);
  const swapEnabled = network.jupiterSwap || network.mockSwap;
  const walletCanApprove = network.jupiterSwap
    ? !!signTransaction
    : network.mockSwap
      ? !!signMessage
      : false;
  const walletLabel = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "No wallet";

  const canQuote =
    swapEnabled &&
    safeInputAmount > 0 &&
    fromToken.symbol !== toToken.symbol &&
    safeSlippage > 0;
  const hasEnoughBalance =
    !connected ||
    displayFromBalance === null ||
    (displayFromBalance > 0 && safeInputAmount <= displayFromBalance);
  const canOpenConfirm =
    connected &&
    safeInputAmount > 0 &&
    !!quote &&
    !!publicKey &&
    walletCanApprove &&
    swapEnabled &&
    hasEnoughBalance &&
    !quoteLoading &&
    !swapLoading;

  const refreshBalances = useCallback(async () => {
    if (!publicKey) {
      setBalances({});
      return;
    }

    setBalanceLoading(true);
    try {
      const entries = await Promise.all(
        TOKENS.map(async (token) => {
          const balance = token.native
            ? await getSolBalance(connection, publicKey)
            : await getSplBalance(connection, publicKey, token);
          return [token.symbol, balance] as const;
        }),
      );
      setBalances(Object.fromEntries(entries));
    } catch (error) {
      setMessage({
        tone: "error",
        text: classifyError(error, "Failed to refresh balances."),
      });
    } finally {
      setBalanceLoading(false);
    }
  }, [connection, publicKey]);

  const getQuote = useCallback(async () => {
    const requestId = quoteRequestId.current + 1;
    quoteRequestId.current = requestId;

    if (network.mockSwap) {
      setQuoteLoading(true);
      setQuote(null);
      setMessage(null);
      window.setTimeout(() => {
        if (quoteRequestId.current !== requestId) return;
        setQuote(createMockQuote(fromToken, toToken, amount, safeSlippage));
        setQuoteLoading(false);
      }, 320);
      return;
    }

    if (!network.jupiterSwap) {
      setQuote(null);
      setQuoteLoading(false);
      setMessage({
        tone: "info",
        text: `${network.label} is enabled for wallet connection, balances, and explorer links. Swap execution is disabled on this network.`,
      });
      return;
    }

    if (!canQuote) {
      setQuote(null);
      return;
    }

    setQuoteLoading(true);
    setMessage(null);
    try {
      const rawAmount = toRawAmount(amount, fromToken.decimals);
      const params = new URLSearchParams({
        inputMint: fromToken.mint,
        outputMint: toToken.mint,
        amount: rawAmount.toString(),
        slippageBps: Math.round(safeSlippage * 100).toString(),
      });
      const response = await fetch(`/api/jupiter/quote?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Quote request failed.");
      }

      if (quoteRequestId.current !== requestId) return;
      setQuote(payload as QuoteResponse);
    } catch (error) {
      if (quoteRequestId.current !== requestId) return;
      setQuote(null);
      setMessage({
        tone: "error",
        text: classifyError(error, "Failed to fetch a Jupiter quote."),
      });
    } finally {
      setQuoteLoading(false);
    }
  }, [
    amount,
    canQuote,
    fromToken,
    network,
    safeSlippage,
    swapEnabled,
    toToken,
  ]);

  useEffect(() => {
    const stored = window.localStorage.getItem(HISTORY_KEY);
    if (stored) {
      setHistory(
        (JSON.parse(stored) as Partial<SwapResult>[]).map((item) => ({
          signature: item.signature ?? "",
          from: item.from ?? "",
          to: item.to ?? "",
          inputAmount: item.inputAmount ?? "0",
          outputAmount: item.outputAmount ?? "0",
          slippage: item.slippage ?? 0,
          route: item.route ?? "-",
          createdAt: item.createdAt ?? new Date().toISOString(),
          networkLabel: item.networkLabel ?? "Mainnet",
          solscanCluster: item.solscanCluster ?? "",
          mock: item.mock ?? false,
        })),
      );
    }
  }, []);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  useEffect(() => {
    quoteRequestId.current += 1;
    setBalances({});
    setQuote(null);
    setMessage(null);
  }, [networkId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void getQuote();
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [getQuote]);

  const updateHistory = (result: SwapResult) => {
    setHistory((current) => {
      const next = [result, ...current].slice(0, 8);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const swapTokens = () => {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    setQuote(null);
    setMessage(null);
  };

  const setMaxAmount = () => {
    if (fromBalance === null) return;
    const reserve = fromToken.native ? 0.01 : 0;
    setAmount(decimalInputValue(Math.max(fromBalance - reserve, 0)));
  };

  const executeSwap = async () => {
    if (!quote || !publicKey) return;

    if (network.mockSwap) {
      await executeMockSwap();
      return;
    }

    if (!signTransaction || !network.jupiterSwap) return;

    setSwapLoading(true);
    setConfirmOpen(false);
    setMessage({ tone: "info", text: "Building Jupiter swap transaction..." });

    try {
      const swapResponse = await fetch("/api/jupiter/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: publicKey.toBase58(),
        }),
      });
      const swapPayload = await swapResponse.json();

      if (!swapResponse.ok || !swapPayload.swapTransaction) {
        throw new Error(swapPayload.error ?? "Swap transaction build failed.");
      }

      setMessage({ tone: "info", text: "Waiting for wallet signature..." });
      const transaction = VersionedTransaction.deserialize(
        base64ToUint8Array(swapPayload.swapTransaction),
      );
      const signedTransaction = await signTransaction(transaction);

      setMessage({
        tone: "info",
        text: "Sending transaction to Solana RPC...",
      });
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          maxRetries: 3,
          skipPreflight: false,
        },
      );

      setMessage({ tone: "info", text: "Confirming transaction..." });
      const confirmation = await connection.confirmTransaction(
        signature,
        "finalized",
      );

      if (confirmation.value.err) {
        throw new Error(
          `RPC confirmation failed: ${JSON.stringify(confirmation.value.err)}`,
        );
      }

      const result = {
        signature,
        from: fromToken.symbol,
        to: toToken.symbol,
        inputAmount: formatTokenAmount(quote.inAmount, fromToken.decimals),
        outputAmount: formatTokenAmount(quote.outAmount, toToken.decimals),
        slippage: quote.slippageBps / 100,
        route: routeLabel,
        createdAt: new Date().toISOString(),
        networkLabel: network.label,
        solscanCluster: network.solscanCluster,
        mock: false,
      };

      updateHistory(result);
      setMessage({
        tone: "success",
        text: `Swap confirmed: ${result.inputAmount} ${result.from} to ${result.outputAmount} ${result.to}`,
        link: solscanTxUrl(signature, network.solscanCluster),
      });
      await refreshBalances();
      await getQuote();
    } catch (error) {
      setMessage({
        tone: "error",
        text: classifyError(error, "Swap failed."),
      });
    } finally {
      setSwapLoading(false);
    }
  };

  const executeMockSwap = async () => {
    if (!quote || !publicKey || !signMessage) return;

    setSwapLoading(true);
    setConfirmOpen(false);
    setMessage({
      tone: "info",
      text: "Requesting wallet approval for the devnet mock swap...",
    });

    try {
      const approval = await signMessage(
        new TextEncoder().encode(
          `Mock Jupiter devnet swap: ${amount} ${fromToken.symbol} to ${formatTokenAmount(
            quote.outAmount,
            toToken.decimals,
          )} ${toToken.symbol}`,
        ),
      );

      setMessage({
        tone: "info",
        text: "Simulating Jupiter route execution on devnet...",
      });
      await delay(900);

      const signature = `mock-${bytesToHex(approval).slice(0, 40)}`;
      const result = {
        signature,
        from: fromToken.symbol,
        to: toToken.symbol,
        inputAmount: formatTokenAmount(quote.inAmount, fromToken.decimals),
        outputAmount: formatTokenAmount(quote.outAmount, toToken.decimals),
        slippage: quote.slippageBps / 100,
        route: routeLabel,
        createdAt: new Date().toISOString(),
        networkLabel: "Devnet Mock",
        solscanCluster: network.solscanCluster,
        mock: true,
      };

      updateHistory(result);
      setMessage({
        tone: "success",
        text: `Mock swap completed: ${result.inputAmount} ${result.from} to ${result.outputAmount} ${result.to}. No devnet swap transaction was sent.`,
      });
      await refreshBalances();
      await getQuote();
    } catch (error) {
      setMessage({
        tone: "error",
        text: classifyError(error, "Mock swap failed."),
      });
    } finally {
      setSwapLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-transparent text-[#11161f]">
      <div className="mx-auto grid min-h-screen w-[min(1180px,calc(100%-32px))] grid-rows-[auto_1fr] gap-6 py-7 max-md:w-[min(720px,calc(100%-24px))]">
        <header className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#164e63] p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] max-sm:flex-col max-sm:items-stretch">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-[#67e8f9]">
              {network.label}{" "}
              {network.jupiterSwap
                ? "Jupiter swap"
                : network.mockSwap
                  ? "Jupiter mock"
                  : "wallet mode"}
            </p>
            <h1 className="mt-2 text-[clamp(1.8rem,5vw,4rem)] font-black leading-none tracking-normal">
              0xtomsh Solana
              <br />
              Token Swap
            </h1>
          </div>
          <div className="flex items-center justify-end gap-3 max-sm:justify-between">
            <NetworkSelect
              networkId={networkId}
              networks={networks}
              onChange={setNetworkId}
            />
            <span className="inline-flex h-11 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-bold text-white shadow-sm">
              <Wallet size={17} />
              {walletLabel}
            </span>
            <WalletMultiButton />
          </div>
        </header>

        <section className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-6 max-lg:grid-cols-1">
          <div className="grid gap-5">
            <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
              <Metric
                icon={<Zap size={18} />}
                label="Route"
                value={
                  swapEnabled ? routeLabel : `${network.label} balances only`
                }
                tone="cyan"
              />
              <Metric
                icon={<RefreshCw size={18} />}
                label="Receive"
                value={
                  quote
                    ? `${formatTokenAmount(quote.outAmount, toToken.decimals)} ${toToken.symbol}`
                    : quoteLoading
                      ? "Loading quote"
                      : swapEnabled
                        ? "-"
                        : "Mainnet only"
                }
                tone="indigo"
              />
              <Metric
                icon={<ShieldCheck size={18} />}
                label="Impact"
                value={quote ? `${toPercent(quote.priceImpactPct)}%` : "-"}
                tone="amber"
              />
            </div>

            <div className="rounded-lg border border-[#bfdbfe] bg-white/95 p-4 shadow-[0_28px_80px_rgba(37,99,235,0.14),0_10px_30px_rgba(15,23,42,0.08)]">
              <TokenInput
                label="Sell"
                token={fromToken}
                amount={amount}
                balance={displayFromBalance}
                balanceLoading={balanceLoading}
                onAmountChange={(value) => {
                  setAmount(value.replaceAll(",", ""));
                  setMessage(null);
                }}
                onTokenChange={(symbol) => {
                  setFromSymbol(symbol);
                  if (symbol === toSymbol) setToSymbol(fromSymbol);
                  setQuote(null);
                  setMessage(null);
                }}
                onMax={setMaxAmount}
              />
              {hasZeroFromBalance ? (
                <div className="mt-3">
                  <StatusPanel
                    className=""
                    message={{
                      tone: "error",
                      text: `${fromToken.symbol} balance is 0. Add funds or switch the sell token before swapping.`,
                    }}
                  />
                </div>
              ) : null}

              <div className="my-3 flex justify-center">
                <button
                  type="button"
                  onClick={swapTokens}
                  className="grid h-11 w-11 place-items-center rounded-md border border-[#06b6d4]/20 bg-gradient-to-br from-[#2563eb] to-[#06b6d4] text-white shadow-[0_12px_26px_rgba(6,182,212,0.26)] transition hover:from-[#4f46e5] hover:to-[#0891b2]"
                  title="Switch tokens"
                >
                  <ArrowDownUp size={18} />
                </button>
              </div>

              <TokenInput
                label="Buy"
                token={toToken}
                amount={
                  quote
                    ? formatTokenAmount(quote.outAmount, toToken.decimals)
                    : ""
                }
                balance={displayToBalance}
                balanceLoading={balanceLoading}
                readOnly
                onTokenChange={(symbol) => {
                  setToSymbol(symbol);
                  if (symbol === fromSymbol) setFromSymbol(toSymbol);
                  setQuote(null);
                  setMessage(null);
                }}
              />

              <div className="mt-4 grid gap-3 rounded-lg border border-[#dbeafe] bg-[#f3f7ff] p-4">
                <div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
                  <span className="inline-flex items-center gap-2 text-sm font-black text-[#2563eb]">
                    <Settings2 size={16} className="text-[#0891b2]" />
                    Slippage
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {SLIPPAGE_OPTIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setSlippageMode("preset");
                          setSlippage(value);
                        }}
                        className={slippageButtonClass(
                          slippageMode === "preset" && slippage === value,
                        )}
                      >
                        {value}%
                      </button>
                    ))}
                    <label className="grid h-9 grid-cols-[1fr_auto] items-center rounded-md bg-white px-2">
                      <input
                        value={customSlippage}
                        onChange={(event) => {
                          setSlippageMode("custom");
                          setCustomSlippage(event.target.value);
                        }}
                        onFocus={() => setSlippageMode("custom")}
                        inputMode="decimal"
                        className="min-w-0 bg-transparent text-sm font-black outline-none"
                        aria-label="Custom slippage"
                      />
                      <span className="text-xs font-black text-[#5b6472]">
                        %
                      </span>
                    </label>
                  </div>
                </div>

                <QuoteRow
                  label="Minimum received"
                  value={
                    quote
                      ? `${formatTokenAmount(
                          quote.otherAmountThreshold,
                          toToken.decimals,
                        )} ${toToken.symbol}`
                      : "-"
                  }
                />
                <QuoteRow
                  label="Network fee"
                  value="~0.000005 SOL + priority fee"
                />
                <QuoteRow
                  label="Jupiter slippage"
                  value={`${quote?.slippageBps ? quote.slippageBps / 100 : safeSlippage}%`}
                />
              </div>

              {message ? <StatusPanel message={message} /> : null}

              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 max-sm:grid-cols-1">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={!canOpenConfirm}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#2563eb] via-[#4f46e5] to-[#06b6d4] px-5 text-base font-black text-white shadow-[0_18px_42px_rgba(79,70,229,0.28)] transition hover:from-[#1d4ed8] hover:via-[#4338ca] hover:to-[#0891b2] disabled:cursor-not-allowed disabled:bg-none disabled:bg-[#cbd5e1] disabled:text-[#64748b] disabled:shadow-none"
                >
                  {quoteLoading || swapLoading ? (
                    <Loader2 className="animate-spin" size={19} />
                  ) : null}
                  {buttonText({
                    connected,
                    walletCanApprove,
                    amount: safeInputAmount,
                    hasQuote: !!quote,
                    hasEnoughBalance,
                    hasZeroBalance: hasZeroFromBalance,
                    tokenSymbol: fromToken.symbol,
                    swapEnabled,
                    mockSwap: network.mockSwap,
                    quoteLoading,
                    swapLoading,
                  })}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void refreshBalances();
                    void getQuote();
                  }}
                  className="grid h-14 min-w-14 place-items-center rounded-md border border-[#bfdbfe] bg-white text-[#1e3a8a] shadow-sm transition hover:bg-[#eef5ff]"
                  title="Refresh balances and quote"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>
          </div>

          <aside className="grid gap-4">
            <div className="rounded-lg border border-[#22d3ee]/20 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#164e63] p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.24)]">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-black tracking-normal">
                  Order Preview
                </h2>
                <span className="rounded-md bg-[#f59e0b]/15 px-2 py-1 text-xs font-black text-[#fde68a]">
                  {network.label}
                </span>
              </div>
              <div className="grid gap-4">
                <PreviewToken
                  token={fromToken}
                  label="Pay"
                  amount={safeInputAmount ? amount : "0"}
                />
                <div className="h-px bg-white/12" />
                <PreviewToken
                  token={toToken}
                  label="Receive"
                  amount={
                    quote
                      ? formatTokenAmount(quote.outAmount, toToken.decimals)
                      : "0"
                  }
                />
              </div>
              <div className="mt-5 rounded-md border border-white/10 bg-white/10 p-3 text-sm leading-6 text-[#dbeafe]">
                {connected
                  ? network.jupiterSwap
                    ? "Jupiter builds missing token-account setup instructions into the swap transaction when needed."
                    : network.mockSwap
                      ? "Devnet uses a Jupiter-like mock route and wallet message approval. No swap transaction is sent."
                      : `${network.label} is available for wallet and balance testing. Jupiter routes are mainnet-only in this app.`
                  : "Connect Phantom or Solflare to fetch balances and execute swaps."}
              </div>
            </div>

            <div className="rounded-lg border border-[#bfdbfe] bg-white/95 p-5 shadow-[0_18px_44px_rgba(37,99,235,0.08)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black tracking-normal">
                  Token Balances
                </h2>
                {balanceLoading ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : null}
              </div>
              <div className="grid gap-3">
                {TOKENS.map((token) => (
                  <div
                    key={token.symbol}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3"
                  >
                    <TokenMark token={token} />
                    <div>
                      <p className="font-black">{token.symbol}</p>
                      <p className="text-sm text-[#5b6472]">{token.name}</p>
                    </div>
                    <p className="font-mono text-sm font-bold">
                      {formatBalance(
                        connected && !balanceLoading
                          ? (balances[token.symbol] ?? 0)
                          : balances[token.symbol],
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <HistoryPanel history={history} />
          </aside>
        </section>
      </div>

      {confirmOpen && quote ? (
        <ConfirmModal
          fromToken={fromToken}
          toToken={toToken}
          amount={amount}
          quote={quote}
          routeLabel={routeLabel}
          networkLabel={network.label}
          mockSwap={network.mockSwap}
          swapLoading={swapLoading}
          onClose={() => setConfirmOpen(false)}
          onConfirm={executeSwap}
        />
      ) : null}
    </main>
  );
}

function TokenInput({
  label,
  token,
  amount,
  balance,
  balanceLoading,
  readOnly = false,
  onAmountChange,
  onTokenChange,
  onMax,
}: {
  label: string;
  token: Token;
  amount: string;
  balance: number | null;
  balanceLoading: boolean;
  readOnly?: boolean;
  onAmountChange?: (value: string) => void;
  onTokenChange: (value: string) => void;
  onMax?: () => void;
}) {
  return (
    <div className="rounded-lg border border-[#dbeafe] bg-gradient-to-br from-white to-[#f8fbff] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm font-black uppercase text-[#5b6472]">
          {label}
        </span>
        <span className="text-sm font-bold text-[#5b6472]">
          {token.symbol} Balance:{" "}
          {balanceLoading ? "..." : formatBalance(balance)}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_230px] gap-3 max-sm:grid-cols-1">
        <input
          value={amount}
          readOnly={readOnly}
          inputMode="decimal"
          onChange={(event) => onAmountChange?.(event.target.value)}
          placeholder="0"
          className="min-h-14 min-w-0 bg-transparent text-4xl font-black tracking-normal text-[#0f172a] outline-none placeholder:text-[#9aa8bd] read-only:text-[#475569] max-sm:text-3xl"
        />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="relative">
            <select
              value={token.symbol}
              onChange={(event) => onTokenChange(event.target.value)}
              className="h-14 w-full appearance-none rounded-md border border-[#bfdbfe] bg-white py-0 pl-12 pr-9 text-base font-black outline-none transition focus:border-[#2563eb] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
            >
              {TOKENS.map((option) => (
                <option key={option.symbol} value={option.symbol}>
                  {option.symbol}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <TokenMark token={token} small />
            </span>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5b6472]"
              size={17}
            />
          </label>
          {onMax ? (
            <button
              type="button"
              onClick={onMax}
              disabled={balance === null || balance <= 0}
              className="h-14 rounded-md bg-[#dbeafe] px-3 text-sm font-black text-[#1d4ed8] transition hover:bg-[#bfdbfe] disabled:cursor-not-allowed disabled:text-[#8a93a3] disabled:opacity-60"
            >
              MAX
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NetworkSelect({
  networkId,
  networks,
  onChange,
}: {
  networkId: SwapNetworkId;
  networks: Array<{ id: SwapNetworkId; label: string; jupiterSwap: boolean }>;
  onChange: (networkId: SwapNetworkId) => void;
}) {
  return (
    <label className="relative">
      <select
        value={networkId}
        onChange={(event) => onChange(event.target.value as SwapNetworkId)}
        className="h-11 min-w-[132px] appearance-none rounded-md border border-white/15 bg-white/10 py-0 pl-3 pr-9 text-sm font-black text-white shadow-sm outline-none transition focus:border-[#93c5fd]"
        aria-label="Network"
      >
        {networks.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
            {item.jupiterSwap ? " Swap" : ""}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#bfdbfe]"
        size={16}
      />
    </label>
  );
}

function Metric({
  icon,
  label,
  value,
  tone = "blue",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "blue" | "cyan" | "indigo" | "amber";
}) {
  const toneClass = {
    blue: "bg-[#dbeafe] text-[#1d4ed8]",
    cyan: "bg-[#cffafe] text-[#0891b2]",
    indigo: "bg-[#e0e7ff] text-[#4f46e5]",
    amber: "bg-[#fef3c7] text-[#b45309]",
  }[tone];

  return (
    <article className="min-h-[116px] rounded-lg border border-[#bfdbfe] bg-white/95 p-4 shadow-[0_16px_42px_rgba(37,99,235,0.09)]">
      <div
        className={`mb-4 flex h-9 w-9 items-center justify-center rounded-md shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ${toneClass}`}
      >
        {icon}
      </div>
      <p className="text-xs font-black uppercase text-[#5b6472]">{label}</p>
      <strong className="mt-1 block break-words text-lg leading-tight">
        {value}
      </strong>
    </article>
  );
}

function QuoteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="inline-flex items-center gap-2 font-bold text-[#5b6472]">
        <Info size={14} />
        {label}
      </span>
      <strong className="text-right">{value}</strong>
    </div>
  );
}

function PreviewToken({
  token,
  label,
  amount,
}: {
  token: Token;
  label: string;
  amount: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3">
      <TokenMark token={token} />
      <div>
        <p className="text-sm font-bold text-[#aeb8b4]">{label}</p>
        <p className="mt-1 text-2xl font-black">
          {amount} {token.symbol}
        </p>
      </div>
    </div>
  );
}

function StatusPanel({
  message,
  className = "mt-4",
}: {
  message: NonNullable<StatusMessage>;
  className?: string;
}) {
  const toneClassName =
    message.tone === "success"
      ? "border-[#2563eb]/20 bg-[#eff6ff] text-[#1e3a8a]"
      : message.tone === "error"
        ? "border-[#b42318]/20 bg-[#fff0ee] text-[#8f1d14]"
        : "border-[#2775ca]/20 bg-[#eef5ff] text-[#164b84]";

  return (
    <div
      className={`${className} rounded-md border p-3 text-sm font-bold ${toneClassName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span>{message.text}</span>
        {message.link ? (
          <a
            href={message.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 underline"
          >
            Solscan
            <ExternalLink size={14} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function HistoryPanel({ history }: { history: SwapResult[] }) {
  return (
    <div className="rounded-lg border border-[#bfdbfe] bg-white/95 p-5 shadow-[0_18px_44px_rgba(37,99,235,0.08)]">
      <div className="mb-4 flex items-center gap-2">
        <History size={18} />
        <h2 className="text-lg font-black tracking-normal">Swap History</h2>
      </div>
      {history.length ? (
        <div className="grid gap-3">
          {history.map((item) => (
            <a
              key={item.signature}
              href={
                item.mock
                  ? undefined
                  : solscanTxUrl(item.signature, item.solscanCluster)
              }
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[#dbeafe] bg-[#f8fbff] p-3 transition hover:bg-[#eef5ff]"
            >
              <div className="flex items-center justify-between gap-3">
                <strong>
                  {item.from} to {item.to}
                </strong>
                {item.mock ? (
                  <span className="rounded-md bg-[#eef5ff] px-2 py-1 text-xs font-black text-[#2563eb]">
                    Mock
                  </span>
                ) : (
                  <ExternalLink size={14} />
                )}
              </div>
              <p className="mt-1 text-sm text-[#5b6472]">
                {item.inputAmount} {item.from} to {item.outputAmount} {item.to}
              </p>
              <p className="mt-1 text-xs font-bold text-[#5b6472]">
                {item.networkLabel}
              </p>
              <p className="mt-1 font-mono text-xs text-[#5b6472]">
                {item.signature.slice(0, 10)}...{item.signature.slice(-8)}
              </p>
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-[#5b6472]">
          Successful swaps will appear here and persist in this browser.
        </p>
      )}
    </div>
  );
}

function ConfirmModal({
  fromToken,
  toToken,
  amount,
  quote,
  routeLabel,
  networkLabel,
  mockSwap,
  swapLoading,
  onClose,
  onConfirm,
}: {
  fromToken: Token;
  toToken: Token;
  amount: string;
  quote: QuoteResponse;
  routeLabel: string;
  networkLabel: string;
  mockSwap: boolean;
  swapLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f172a]/55 p-4">
      <div className="w-[min(520px,100%)] rounded-lg border border-[#bfdbfe] bg-white p-5 shadow-[0_28px_100px_rgba(15,23,42,0.36)]">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-black">Confirm Swap</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md bg-[#eef5ff]"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-3">
          <QuoteRow
            label="Swap"
            value={`${amount} ${fromToken.symbol} to ${formatTokenAmount(
              quote.outAmount,
              toToken.decimals,
            )} ${toToken.symbol}`}
          />
          <QuoteRow
            label="Minimum received"
            value={`${formatTokenAmount(
              quote.otherAmountThreshold,
              toToken.decimals,
            )} ${toToken.symbol}`}
          />
          <QuoteRow label="Slippage" value={`${quote.slippageBps / 100}%`} />
          <QuoteRow label="Network fee" value="~0.000005 SOL + priority fee" />
          <QuoteRow label="Route" value={routeLabel} />
          <QuoteRow
            label="Price impact"
            value={`${toPercent(quote.priceImpactPct)}%`}
          />
        </div>
        <div className="mt-5 rounded-md bg-[#fff7e6] p-3 text-sm font-bold leading-6 text-[#7a4b00]">
          {mockSwap
            ? `${networkLabel} uses a wallet message approval and mock Jupiter execution. No swap transaction is sent.`
            : "This signs and submits a real mainnet transaction. Confirm token, amount, and route in your wallet before approving."}
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={swapLoading}
          className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#2563eb] to-[#0ea5e9] px-5 font-black text-white shadow-[0_16px_36px_rgba(37,99,235,0.28)] disabled:cursor-not-allowed disabled:bg-none disabled:bg-[#cbd5e1]"
        >
          {swapLoading ? <Loader2 className="animate-spin" size={18} /> : null}
          {mockSwap ? "Approve mock swap" : "Sign and send swap"}
        </button>
      </div>
    </div>
  );
}

function TokenMark({
  token,
  small = false,
}: {
  token: Token;
  small?: boolean;
}) {
  const sizeClass = small ? "h-7 w-7" : "h-10 w-10";
  const innerSizeClass = small ? "h-[18px] w-[18px]" : "h-7 w-7";
  const markClass = small ? "text-[10px]" : "text-xs";

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/70 ${sizeClass}`}
      style={{
        background: token.gradient,
        boxShadow: `0 10px 22px ${token.accent}38`,
      }}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.85),transparent_28%)]" />
      <span className="absolute -bottom-2 -right-2 h-6 w-6 rounded-full bg-white/18" />
      <span
        className={`relative grid place-items-center rounded-full bg-white/22 font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${innerSizeClass} ${markClass}`}
      >
        {token.mark}
      </span>
    </span>
  );
}

async function getSolBalance(
  connection: { getBalance: (key: PublicKey) => Promise<number> },
  publicKey: PublicKey,
) {
  const lamports = await connection.getBalance(publicKey);
  return lamports / LAMPORTS_PER_SOL;
}

async function getSplBalance(
  connection: {
    getParsedTokenAccountsByOwner: (
      owner: PublicKey,
      filter: { mint: PublicKey },
    ) => Promise<{
      value: Array<{
        account: {
          data: {
            parsed: {
              info: {
                tokenAmount: {
                  amount: string;
                };
              };
            };
          };
        };
      }>;
    }>;
  },
  publicKey: PublicKey,
  token: Token,
) {
  const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
    mint: new PublicKey(token.mint),
  });
  const rawBalance = accounts.value.reduce(
    (total, item) =>
      total + BigInt(item.account.data.parsed.info.tokenAmount.amount),
    BigInt(0),
  );
  return Number(rawBalance) / 10 ** token.decimals;
}

function tokenBySymbol(symbol: string) {
  return TOKENS.find((token) => token.symbol === symbol) ?? TOKENS[0];
}

function createMockQuote(
  fromToken: Token,
  toToken: Token,
  amount: string,
  slippage: number,
): QuoteResponse {
  const numericAmount = Number(amount);
  const safeAmount =
    Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount : 0;
  const fromPrice = MOCK_PRICES_USD[fromToken.symbol] ?? 1;
  const toPrice = MOCK_PRICES_USD[toToken.symbol] ?? 1;
  const priceImpact = safeAmount > 10 ? 0.0042 : 0.0012;
  const outputAmount = safeAmount * (fromPrice / toPrice) * (1 - priceImpact);
  const slippageMultiplier = 1 - slippage / 100;

  return {
    inputMint: fromToken.mint,
    inAmount: toRawAmount(amount, fromToken.decimals).toString(),
    outputMint: toToken.mint,
    outAmount: numberToRawAmount(outputAmount, toToken.decimals),
    otherAmountThreshold: numberToRawAmount(
      outputAmount * slippageMultiplier,
      toToken.decimals,
    ),
    swapMode: "ExactIn",
    slippageBps: Math.round(slippage * 100),
    priceImpactPct: priceImpact.toString(),
    routePlan: [
      {
        percent: 100,
        swapInfo: {
          ammKey: "DevnetMockJupiterRoute111111111111111111111",
          label: "Mock Jupiter Devnet",
          inputMint: fromToken.mint,
          outputMint: toToken.mint,
          inAmount: toRawAmount(amount, fromToken.decimals).toString(),
          outAmount: numberToRawAmount(outputAmount, toToken.decimals),
          feeAmount: "0",
          feeMint: fromToken.mint,
        },
      },
    ],
    contextSlot: Date.now(),
    timeTaken: 0.03,
  };
}

function toRawAmount(value: string, decimals: number) {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) return BigInt(0);
  const [whole, fraction = ""] = normalized.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return (
    BigInt(whole || "0") * BigInt(10) ** BigInt(decimals) +
    BigInt(paddedFraction || "0")
  );
}

function numberToRawAmount(value: number, decimals: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return toRawAmount(value.toFixed(decimals), decimals).toString();
}

function formatTokenAmount(rawAmount: string, decimals: number) {
  const raw = BigInt(rawAmount);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  const fractionText = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  const compactFraction = fractionText.slice(0, decimals > 6 ? 6 : decimals);
  return compactFraction
    ? `${whole.toString()}.${compactFraction}`
    : whole.toString();
}

function decimalInputValue(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(8)).toString();
}

function formatBalance(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value > 10_000 ? 0 : 6,
  });
}

function formatRoute(quote: QuoteResponse | null) {
  if (!quote?.routePlan?.length) return "-";
  return quote.routePlan
    .map((route) => {
      const share =
        typeof route.percent === "number"
          ? route.percent
          : typeof route.bps === "number"
            ? route.bps / 100
            : null;
      return share === null
        ? (route.swapInfo.label ?? "AMM")
        : `${route.swapInfo.label ?? "AMM"} ${share}%`;
    })
    .join(" / ");
}

function toPercent(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return (numeric * 100).toFixed(numeric > 0.01 ? 2 : 4);
}

function slippageButtonClass(active: boolean) {
  return `h-9 rounded-md px-3 text-sm font-black transition ${
    active
      ? "bg-[#11161f] text-white"
      : "bg-white text-[#11161f] hover:bg-[#dbeafe]"
  }`;
}

function buttonText({
  connected,
  walletCanApprove,
  amount,
  hasQuote,
  hasEnoughBalance,
  hasZeroBalance,
  tokenSymbol,
  swapEnabled,
  mockSwap,
  quoteLoading,
  swapLoading,
}: {
  connected: boolean;
  walletCanApprove: boolean;
  amount: number;
  hasQuote: boolean;
  hasEnoughBalance: boolean;
  hasZeroBalance: boolean;
  tokenSymbol: string;
  swapEnabled: boolean;
  mockSwap: boolean;
  quoteLoading: boolean;
  swapLoading: boolean;
}) {
  if (!connected) return "Connect wallet to swap";
  if (!walletCanApprove) {
    return mockSwap
      ? "Wallet cannot sign messages"
      : "Wallet cannot sign transactions";
  }
  if (!swapEnabled) return "Swap is disabled";
  if (hasZeroBalance) return `No ${tokenSymbol} balance`;
  if (amount <= 0) return "Enter an amount";
  if (!hasEnoughBalance) return "Insufficient balance";
  if (quoteLoading)
    return mockSwap ? "Preparing mock quote" : "Getting Jupiter quote";
  if (!hasQuote) return "No route available";
  if (swapLoading) return mockSwap ? "Mock swapping" : "Swapping";
  return mockSwap ? "Review mock swap" : "Review swap";
}

function base64ToUint8Array(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function solscanTxUrl(signature: string, cluster: string) {
  return `https://solscan.io/tx/${signature}${cluster}`;
}

function classifyError(error: unknown, fallback: string) {
  const text = error instanceof Error ? error.message : String(error);
  const lower = text.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("rejected")) {
    return "User rejected the wallet signature.";
  }
  if (lower.includes("insufficient") || lower.includes("0x1")) {
    return "Insufficient balance for the input amount, token account rent, or network fees.";
  }
  if (lower.includes("slippage") || lower.includes("exceeded")) {
    return "Swap failed because the route moved beyond the selected slippage.";
  }
  if (
    lower.includes("blockhash") ||
    lower.includes("confirm") ||
    lower.includes("rpc")
  ) {
    return `RPC error while sending or confirming the transaction. ${text}`;
  }
  if (lower.includes("no routes") || lower.includes("route")) {
    return "Jupiter could not find a route for this pair and amount.";
  }

  return `${fallback} ${text}`;
}
