import SafeGrid from './SafeGrid';

export default function SafesSection({ id, title, start, end, safeMap, onSafeClick, active }) {
  return (
    <section id={id} className={`page-section safes-section${active ? ' active' : ''}`}>
      <h2>{title}</h2>
      <SafeGrid start={start} end={end} safeMap={safeMap} onSafeClick={onSafeClick} />
    </section>
  );
}