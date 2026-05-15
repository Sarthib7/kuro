import { Connection, PublicKey } from "@solana/web3.js";

export function makeConnection(rpcUrl?: string): Connection {
  return new Connection(rpcUrl ?? "https://api.mainnet-beta.solana.com", "confirmed");
}

export interface MintInfo {
  mint: string;
  decimals: number;
  supply: string;
  uiSupply: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
}

export async function getMintInfo(rpc: Connection, mint: string): Promise<MintInfo> {
  const info = await rpc.getParsedAccountInfo(new PublicKey(mint));
  if (!info.value) throw new Error(`Mint not found: ${mint}`);
  const data = info.value.data;
  if (!("parsed" in data)) throw new Error(`${mint} is not a parsed SPL token account`);
  const parsed = data.parsed.info as {
    decimals: number;
    supply: string;
    mintAuthority: string | null;
    freezeAuthority: string | null;
  };
  return {
    mint,
    decimals: parsed.decimals,
    supply: parsed.supply,
    uiSupply: Number(parsed.supply) / 10 ** parsed.decimals,
    mintAuthority: parsed.mintAuthority,
    freezeAuthority: parsed.freezeAuthority,
  };
}

export interface HolderSlice {
  address: string;
  uiAmount: number;
  pct: number;
}

export async function getTopHolders(
  rpc: Connection,
  mint: string,
  uiSupply: number,
): Promise<HolderSlice[]> {
  const res = await rpc.getTokenLargestAccounts(new PublicKey(mint));
  return res.value.map((a) => ({
    address: a.address.toBase58(),
    uiAmount: a.uiAmount ?? 0,
    pct: uiSupply > 0 ? ((a.uiAmount ?? 0) / uiSupply) * 100 : 0,
  }));
}
