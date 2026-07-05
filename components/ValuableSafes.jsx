import SafeItem from './SafeItem';

export default function ValuableSafes({ safeData, onSafeClick }) {
  const sorted = [...safeData].sort((a, b) =>
    Number(b.totalNormalizedLocked - a.totalNormalizedLocked),
  );
  const top3 = sorted.filter((s) => s.totalNormalizedLocked > 0n).slice(0, 3);
  const items = [];

  top3.forEach((safe) => {
    items.push(
      <SafeItem
        key={`top-${safe.safeNumber}`}
        safeNumber={Number(safe.safeNumber)}
        closed
        onClick={onSafeClick}
      />,
    );
  });

  for (let i = top3.length; i < 3; i++) {
    const n = i + 1;
    items.push(
      <SafeItem key={`placeholder-${n}`} safeNumber={n} closed={false} onClick={onSafeClick} />,
    );
  }

  return (
    <section className="most-valuable">
      <h2>Most Valuable Safes in Use</h2>
      <div id="valuableGrid" className="safe-grid">
        {items}
      </div>
    </section>
  );
}