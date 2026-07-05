import SafeItem from './SafeItem';

export default function SafeGrid({ start, end, safeMap, onSafeClick, className = 'safes-grid' }) {
  const items = [];

  for (let n = start; n <= end; n++) {
    const safe = safeMap.get(n);
    const closed = Boolean(safe?.owner && safe.totalNormalizedLocked > 0n);
    items.push(
      <SafeItem key={n} safeNumber={n} closed={closed} onClick={onSafeClick} />,
    );
  }

  return <div className={className}>{items}</div>;
}