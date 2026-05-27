"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  CheckCircle2,
  CircleDollarSign,
  Copy,
  ExternalLink,
  PlugZap,
  Wallet,
} from "lucide-react";

type BalanceState =
  | { status: "idle"; sol: null }
  | { status: "loading"; sol: null }
  | { status: "ready"; sol: string }
  | { status: "error"; sol: null };

export function WalletDashboard() {
  const { connection } = useConnection();
  const { connected, publicKey, wallet } = useWallet();
  const [balance, setBalance] = useState<BalanceState>({
    status: "idle",
    sol: null,
  });
  const [copied, setCopied] = useState(false);

  const publicKeyText = publicKey?.toBase58() ?? "";
  const explorerUrl = publicKey
    ? `https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet`
    : "";

  const refreshBalance = useCallback(
    async (key: PublicKey) => {
      setBalance({ status: "loading", sol: null });

      try {
        const lamports = await connection.getBalance(key);
        setBalance({
          status: "ready",
          sol: (lamports / LAMPORTS_PER_SOL).toLocaleString(undefined, {
            maximumFractionDigits: 6,
          }),
        });
      } catch {
        setBalance({ status: "error", sol: null });
      }
    },
    [connection]
  );

  useEffect(() => {
    if (!publicKey) {
      setBalance({ status: "idle", sol: null });
      return;
    }

    void refreshBalance(publicKey);
  }, [publicKey, refreshBalance]);

  const copyAddress = async () => {
    if (!publicKeyText) return;

    await navigator.clipboard.writeText(publicKeyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <main className="mx-auto min-h-screen w-[min(1120px,calc(100%-32px))] py-12 text-[#e8f7ff] max-md:w-[min(720px,calc(100%-24px))] max-md:py-7">
      <section className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-8 border-b border-[#00ffd1]/25 py-12 pb-9 max-md:grid-cols-1">
        <div className="max-w-[760px]">
          <p className="text-xs font-extrabold uppercase text-[#00ffd1]">
            Solana Devnet Sample
          </p>
          <h1 className="my-3 text-[clamp(3rem,8vw,6.8rem)] font-black leading-[0.92] tracking-normal text-white drop-shadow-[0_0_28px_rgba(0,255,209,0.28)]">
            Solana Wallet Connect
          </h1>
          <p className="max-w-[660px] text-lg leading-8 text-[#a9b8d8]">
            Connect Phantom or Solflare on devnet, inspect the active wallet, and read the account balance from Solana RPC.
          </p>
        </div>
        <div className="flex justify-end max-md:justify-start">
          <WalletMultiButton />
        </div>
      </section>

      <section
        className="my-7 grid grid-cols-3 gap-4 max-md:grid-cols-1"
        aria-label="Wallet status"
      >
        <StatusCard
          icon={<PlugZap size={22} />}
          label="Connection"
          value={connected ? "Connected" : "Not connected"}
          detail={connected ? "Wallet adapter is active" : "Choose a wallet to begin"}
        />
        <StatusCard
          icon={<Wallet size={22} />}
          label="Wallet"
          value={wallet?.adapter.name ?? "No wallet selected"}
          detail="Phantom and Solflare adapters are configured"
        />
        <StatusCard
          icon={<CircleDollarSign size={22} />}
          label="Balance"
          value={balanceText(balance)}
          detail="Fetched from the Solana devnet cluster"
        />
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 rounded-lg border border-[#00ffd1]/25 bg-[#070b18]/80 p-5 text-[#e8f7ff] shadow-[0_0_34px_rgba(0,255,209,0.13)] max-md:grid-cols-1">
        <div>
          <p className="text-xs font-extrabold uppercase text-[#00ffd1]">
            Public key
          </p>
          <code className="mt-2 block max-w-full [overflow-wrap:anywhere] font-mono text-base leading-7 text-white">
            {publicKeyText || "Connect a wallet to show the address"}
          </code>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyAddress}
            disabled={!publicKeyText}
            title="Copy address"
            className="grid h-[42px] w-[42px] place-items-center rounded-md border border-[#00ffd1]/30 bg-[#00ffd1]/10 text-[#00ffd1] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
          </button>
          <a
            href={explorerUrl || undefined}
            aria-disabled={!explorerUrl}
            className="grid h-[42px] w-[42px] place-items-center rounded-md border border-[#ff3df2]/30 bg-[#ff3df2]/10 text-[#ff72f6] aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-45"
            target="_blank"
            rel="noreferrer"
            title="Open in Solana Explorer"
          >
            <ExternalLink size={18} />
          </a>
        </div>
      </section>
    </main>
  );
}

function StatusCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="min-h-[174px] rounded-lg border border-[#6f7cff]/25 bg-[#0b1024]/75 p-5 shadow-[0_18px_44px_rgba(0,0,0,0.34),0_0_28px_rgba(124,60,255,0.14)]">
      <div className="mb-6 grid h-[42px] w-[42px] place-items-center rounded-lg bg-[#00ffd1]/12 text-[#00ffd1] shadow-[0_0_24px_rgba(0,255,209,0.18)]">
        {icon}
      </div>
      <p className="text-xs font-extrabold uppercase text-[#ff72f6]">{label}</p>
      <strong className="mt-2 block min-h-8 text-2xl leading-tight text-white">
        {value}
      </strong>
      <span className="mt-2 block leading-6 text-[#a9b8d8]">{detail}</span>
    </article>
  );
}

function balanceText(balance: BalanceState) {
  if (balance.status === "ready") return `${balance.sol} SOL`;
  if (balance.status === "loading") return "Loading...";
  if (balance.status === "error") return "Unavailable";
  return "-";
}
