import { NextResponse } from "next/server";

type ChainId = "ethereum" | "polygon" | "base" | "arbitrum" | "optimism" | "solana";

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

const EVM_HOSTS: Record<Exclude<ChainId, "solana">, string> = {
  ethereum: "eth-mainnet.g.alchemy.com",
  polygon: "polygon-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  arbitrum: "arb-mainnet.g.alchemy.com",
  optimism: "opt-mainnet.g.alchemy.com",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner")?.trim();
  const chain = searchParams.get("chain") as ChainId | null;
  const limit = Number(searchParams.get("limit") ?? "48");

  if (!owner || !chain) {
    return NextResponse.json(
      { error: "owner and chain are required", items: [] },
      { status: 400 }
    );
  }

  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "ALCHEMY_API_KEY is not configured",
        items: [],
      },
      { status: 503 }
    );
  }

  try {
    const items =
      chain === "solana"
        ? await fetchSolanaNfts({ apiKey, owner, limit })
        : await fetchEvmNfts({ apiKey, owner, chain, limit });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      { error: `Could not load ${chain} NFTs`, items: [] },
      { status: 502 }
    );
  }
}

async function fetchEvmNfts({
  apiKey,
  owner,
  chain,
  limit,
}: {
  apiKey: string;
  owner: string;
  chain: Exclude<ChainId, "solana">;
  limit: number;
}): Promise<UnifiedNft[]> {
  const url = new URL(
    `https://${EVM_HOSTS[chain]}/nft/v3/${apiKey}/getNFTsForOwner`
  );
  url.searchParams.set("owner", owner);
  url.searchParams.set("withMetadata", "true");
  url.searchParams.set("pageSize", String(limit));
  url.searchParams.set("excludeFilters[]", "SPAM");

  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) throw new Error("Alchemy EVM request failed");

  const data = (await response.json()) as {
    ownedNfts?: Array<{
      contract?: { address?: string; name?: string };
      tokenId?: string;
      tokenType?: string;
      name?: string;
      description?: string;
      tokenUri?: string;
      image?: { cachedUrl?: string; originalUrl?: string; pngUrl?: string };
      raw?: {
        metadata?: {
          name?: string;
          description?: string;
          image?: string;
          attributes?: Array<{ trait_type?: unknown; value?: unknown }>;
        };
        tokenUri?: string;
      };
      acquiredAt?: { blockTimestamp?: string };
    }>;
  };

  return (data.ownedNfts ?? []).map((nft) => {
    const contract = nft.contract?.address ?? "";
    const tokenId = nft.tokenId ?? "";
    const rawImage = nft.raw?.metadata?.image;
    const image =
      nft.image?.cachedUrl ??
      nft.image?.pngUrl ??
      nft.image?.originalUrl ??
      (typeof rawImage === "string" ? normalizeMediaUrl(rawImage) : "");

    return {
      id: `${chain}:${contract}:${tokenId}`,
      chain,
      owner,
      contractOrMint: contract,
      tokenId,
      name: nft.name ?? nft.raw?.metadata?.name ?? shortAddress(contract),
      collection: nft.contract?.name ?? "Unknown collection",
      image,
      metadataUri: nft.tokenUri ?? nft.raw?.tokenUri ?? "",
      description: nft.description ?? nft.raw?.metadata?.description ?? "",
      tokenType: nft.tokenType ?? "NFT",
      acquiredAt: nft.acquiredAt?.blockTimestamp ?? "",
      attributes: normalizeAttributes(nft.raw?.metadata?.attributes),
    };
  });
}

async function fetchSolanaNfts({
  apiKey,
  owner,
  limit,
}: {
  apiKey: string;
  owner: string;
  limit: number;
}): Promise<UnifiedNft[]> {
  const response = await fetch(`https://solana-mainnet.g.alchemy.com/v2/${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 60 },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAssetsByOwner",
      params: {
        ownerAddress: owner,
        page: 1,
        limit,
        sortBy: {
          sortBy: "created",
          sortDirection: "desc",
        },
        options: {
          showUnverifiedCollections: true,
          showCollectionMetadata: true,
          showFungible: false,
          showZeroBalance: false,
        },
      },
    }),
  });
  if (!response.ok) throw new Error("Alchemy Solana request failed");

  const data = (await response.json()) as {
    result?: {
      items?: Array<{
        id?: string;
        content?: {
          metadata?: {
            name?: string;
            description?: string;
            symbol?: string;
            attributes?: Array<{ trait_type?: unknown; value?: unknown }>;
          };
          files?: Array<{ uri?: string; mime?: string }>;
          links?: { image?: string };
          json_uri?: string;
        };
        grouping?: Array<{ group_key?: string; group_value?: string }>;
        creators?: Array<{ address?: string }>;
      }>;
    };
  };

  return (data.result?.items ?? []).map((asset) => {
    const mint = asset.id ?? "";
    const collection =
      asset.grouping?.find((group) => group.group_key === "collection")?.group_value ??
      asset.content?.metadata?.symbol ??
      "Solana collection";
    const fileImage = asset.content?.files?.find((file) =>
      file.mime?.startsWith("image/")
    )?.uri;

    return {
      id: `solana:${mint}`,
      chain: "solana",
      owner,
      contractOrMint: mint,
      tokenId: mint,
      name: asset.content?.metadata?.name ?? shortAddress(mint),
      collection,
      image: normalizeMediaUrl(asset.content?.links?.image ?? fileImage ?? ""),
      metadataUri: asset.content?.json_uri ?? "",
      description: asset.content?.metadata?.description ?? "",
      tokenType: "Metaplex",
      acquiredAt: "",
      attributes: normalizeAttributes(asset.content?.metadata?.attributes),
    };
  });
}

function normalizeAttributes(
  attributes: Array<{ trait_type?: unknown; value?: unknown }> | undefined
) {
  return (attributes ?? [])
    .filter((attribute) => attribute.trait_type != null && attribute.value != null)
    .map((attribute) => ({
      trait_type: String(attribute.trait_type),
      value: String(attribute.value),
    }));
}

function normalizeMediaUrl(value: string) {
  if (value.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${value.replace("ipfs://", "")}`;
  }

  return value;
}

function shortAddress(value: string) {
  if (!value) return "Untitled NFT";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
