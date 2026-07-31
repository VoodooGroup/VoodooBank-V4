import SafeItem from './SafeItem';

export default function SafeGrid({ start, end, safeMap, onSafeClick, className = 'safes-grid' }) {
  const items = [];

  for (let n = start; n <= end; n++) {
    const safe = safeMap.get(n);
    // Locked amount is the source of truth (owner alone is not enough)
    const locked = safe?.totalNormalizedLocked;
    const closed = locked != null && locked > 0n;
    items.push(
      <SafeItem key={n} safeNumber={n} closed={closed} onClick={onSafeClick} />,
    );
  }

  return <div className={className}>{items}</div>;
}