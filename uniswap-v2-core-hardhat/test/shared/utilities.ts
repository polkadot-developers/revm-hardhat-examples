import { getBigInt, keccak256, toUtf8Bytes } from "ethers";

export const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes(
    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
  )
);

export function expandTo18Decimals(n: number): bigint {
  return getBigInt(n) * getBigInt("1000000000000000000");
}

export function encodePrice(
  reserve0: bigint,
  reserve1: bigint
): [bigint, bigint] {
  const Q112 = 2n ** 112n;
  return [(reserve1 * Q112) / reserve0, (reserve0 * Q112) / reserve1];
}
