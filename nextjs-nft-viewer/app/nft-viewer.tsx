"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  ExternalLink,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPF5uEbvf9Ss623VQ5DA"
);
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

type NftItem = {
  mint: string;
  tokenAccount: string;
  owner: string;
  amount: string;
  name: string;
  symbol: string;
  uri: string;
  image: string;
  metadataStatus: "ready" | "missing" | "unavailable";
};

type LoadState = "idle" | "loading" | "ready" | "error";

export function NftViewer() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [ownerInput, setOwnerInput] = useState("");
  const [items, setItems] = useState<NftItem[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("Connect a wallet or enter an owner address.");

  const connectedAddress = publicKey?.toBase58() ?? "";
  const activeOwner = ownerInput.trim() || connectedAddress;
  const canLoad = Boolean(activeOwner) && state !== "loading";

  const stats = useMemo(
    () => ({
      count: items.length,
      withMetadata: items.filter((item) => item.metadataStatus === "ready").length,
      withImages: items.filter((item) => item.image).length,
    }),
    [items]
  );

  const loadNfts = useCallback(async () => {
    if (!activeOwner) {
      setMessage("Connect a wallet or paste a Solana owner address.");
      return;
    }

    let owner: PublicKey;
    try {
      owner = new PublicKey(activeOwner);
    } catch {
      setState("error");
      setMessage("Owner address is not a valid Solana public key.");
      return;
    }

    setState("loading");
    setMessage("Scanning devnet token accounts...");

    try {
      const tokenAccounts = await fetchTokenAccounts(connection, owner);
      const nftAccounts = tokenAccounts.filter(({ account }) => {
        const parsed = account.data.parsed.info.tokenAmount;
        return parsed.decimals === 0 && parsed.amount === "1";
      });

      const nextItems = await Promise.all(
        nftAccounts.map(async ({ pubkey, account }) => {
          const info = account.data.parsed.info;
          const mint = new PublicKey(info.mint);
          const metadata = await fetchMetadata(connection, mint);

          return {
            mint: mint.toBase58(),
            tokenAccount: pubkey.toBase58(),
            owner: owner.toBase58(),
            amount: info.tokenAmount.amount,
            name: metadata.name || shortAddress(mint.toBase58()),
            symbol: metadata.symbol,
            uri: metadata.uri,
            image: metadata.image,
            metadataStatus: metadata.metadataStatus,
          };
        })
      );

      setItems(nextItems);
      setState("ready");
      setMessage(
        nextItems.length
          ? `Found ${nextItems.length} NFT-like token account${nextItems.length === 1 ? "" : "s"} on devnet.`
          : "No NFT-like token accounts were found for this owner on devnet."
      );
    } catch {
      setState("error");
      setMessage("Could not load NFTs from Solana devnet. Try again in a moment.");
    }
  }, [activeOwner, connection]);

  const useConnectedWallet = () => {
    if (!connectedAddress) return;
    setOwnerInput(connectedAddress);
  };

  return (
    <main className="mx-auto min-h-screen w-[min(1180px,calc(100%-32px))] py-10 text-slate-950 max-md:w-[min(760px,calc(100%-24px))] max-md:py-6">
      <section className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 border-b border-slate-300 pb-8 max-md:grid-cols-1">
        <div className="max-w-[760px]">
          <p className="text-xs font-extrabold uppercase text-teal-700">
            Solana Devnet Sample
          </p>
          <h1 className="my-3 text-[clamp(2.7rem,7vw,6.2rem)] font-black leading-[0.94] tracking-normal text-slate-950">
            NFT Viewer
          </h1>
          <p className="max-w-[680px] text-lg leading-8 text-slate-700">
            Connect a wallet or inspect any owner address, then resolve NFT metadata and media from devnet.
          </p>
        </div>
        <div className="flex justify-end max-md:justify-start">
          <WalletMultiButton />
        </div>
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-3 py-6 max-lg:grid-cols-1">
        <label className="block">
          <span className="mb-2 block text-xs font-extrabold uppercase text-slate-600">
            Owner address
          </span>
          <input
            value={ownerInput}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setOwnerInput(event.target.value)
            }
            placeholder={connectedAddress || "Paste a Solana public key"}
            className="h-12 w-full rounded-md border border-slate-300 bg-white px-4 font-mono text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          />
        </label>
        <button
          type="button"
          onClick={useConnectedWallet}
          disabled={!connectedAddress}
          title="Use connected wallet"
          className="grid h-12 w-12 place-items-center rounded-md border border-slate-300 bg-white text-slate-800 shadow-sm transition hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Wallet size={19} />
        </button>
        <button
          type="button"
          onClick={loadNfts}
          disabled={!canLoad}
          className="inline-flex h-12 min-w-[150px] items-center justify-center gap-2 rounded-md bg-slate-950 px-5 font-extrabold text-white shadow-[0_16px_32px_rgba(15,23,42,0.2)] transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-45 max-lg:w-full"
        >
          {state === "loading" ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Search size={18} />
          )}
          Load NFTs
        </button>
      </section>

      <section className="mb-6 grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <Metric label="NFT accounts" value={String(stats.count)} />
        <Metric label="Metadata" value={`${stats.withMetadata}/${stats.count}`} />
        <Metric label="Images" value={`${stats.withImages}/${stats.count}`} />
      </section>

      <section className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white/75 px-4 py-3 shadow-sm max-md:items-start">
        <p className="leading-6 text-slate-700">{message}</p>
        <button
          type="button"
          onClick={loadNfts}
          disabled={!canLoad}
          title="Refresh"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-300 bg-white text-slate-800 transition hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RefreshCw size={18} className={state === "loading" ? "animate-spin" : ""} />
        </button>
      </section>

      <section className="grid grid-cols-3 gap-4 pb-10 max-lg:grid-cols-2 max-md:grid-cols-1">
        {items.map((item) => (
          <NftCard key={item.tokenAccount} item={item} />
        ))}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-300 bg-white/80 p-4 shadow-sm">
      <p className="text-xs font-extrabold uppercase text-teal-700">{label}</p>
      <strong className="mt-2 block text-3xl leading-none text-slate-950">
        {value}
      </strong>
    </article>
  );
}

function NftCard({ item }: { item: NftItem }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="grid aspect-square place-items-center bg-slate-100">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImageIcon size={44} className="text-slate-400" />
        )}
      </div>
      <div className="p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black text-slate-950">
              {item.name}
            </h2>
            <p className="mt-1 text-sm font-bold text-pink-700">
              {item.symbol || "No symbol"}
            </p>
          </div>
          <StatusBadge status={item.metadataStatus} />
        </div>
        <AddressRow label="Mint" value={item.mint} />
        <AddressRow label="Token account" value={item.tokenAccount} />
        {item.uri ? (
          <a
            href={item.uri}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-teal-700 hover:text-teal-900"
          >
            Metadata URI
            <ExternalLink size={15} />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: NftItem["metadataStatus"] }) {
  const label =
    status === "ready" ? "Metadata" : status === "missing" ? "No metadata" : "URI blocked";

  return (
    <span className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-extrabold uppercase text-slate-600">
      {label}
    </span>
  );
}

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-extrabold uppercase text-slate-500">{label}</p>
      <a
        href={`https://explorer.solana.com/address/${value}?cluster=devnet`}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block truncate font-mono text-sm text-slate-800 hover:text-teal-700"
      >
        {value}
      </a>
    </div>
  );
}

async function fetchTokenAccounts(
  connection: ReturnType<typeof useConnection>["connection"],
  owner: PublicKey
) {
  const [legacy, token2022] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    }),
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_2022_PROGRAM_ID,
    }),
  ]);

  return [...legacy.value, ...token2022.value];
}

async function fetchMetadata(
  connection: ReturnType<typeof useConnection>["connection"],
  mint: PublicKey
): Promise<Pick<NftItem, "name" | "symbol" | "uri" | "image" | "metadataStatus">> {
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  const account = await connection.getAccountInfo(metadataPda);

  if (!account) {
    return { name: "", symbol: "", uri: "", image: "", metadataStatus: "missing" };
  }

  const decoded = decodeTokenMetadata(account.data);
  if (!decoded.uri) {
    return { ...decoded, image: "", metadataStatus: "ready" };
  }

  try {
    const response = await fetch(decoded.uri);
    if (!response.ok) throw new Error("metadata uri failed");
    const json = (await response.json()) as { image?: unknown };
    return {
      ...decoded,
      image: typeof json.image === "string" ? json.image : "",
      metadataStatus: "ready",
    };
  } catch {
    return { ...decoded, image: "", metadataStatus: "unavailable" };
  }
}

function decodeTokenMetadata(data: Uint8Array) {
  let offset = 1 + 32 + 32;
  const name = readRustString(data, offset);
  offset = name.nextOffset;
  const symbol = readRustString(data, offset);
  offset = symbol.nextOffset;
  const uri = readRustString(data, offset);

  return {
    name: cleanMetadataText(name.value),
    symbol: cleanMetadataText(symbol.value),
    uri: cleanMetadataText(uri.value),
  };
}

function readRustString(data: Uint8Array, offset: number) {
  const length =
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24);
  const start = offset + 4;
  const end = start + length;

  return {
    value: new TextDecoder().decode(data.slice(start, end)),
    nextOffset: end,
  };
}

function cleanMetadataText(value: string) {
  return value.replaceAll("\u0000", "").trim();
}

function shortAddress(value: string) {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
