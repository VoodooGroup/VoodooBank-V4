export function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTokenAmount(value, maximumFractionDigits = 0) {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits });
}

export function formatUsd(value) {
  if (!value || value <= 0) return '$0';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}