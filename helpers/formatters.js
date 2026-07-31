export function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTokenAmount(value, maximumFractionDigits = 0) {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits });
}

/**
 * Format USD for TVL. Small values need decimals (VDO is sub-cent priced);
 * large values stay compact whole dollars.
 */
export function formatUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '$0';
  if (n < 1) {
    return `$${n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  if (n < 1000) {
    return `$${n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${n.toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`;
}