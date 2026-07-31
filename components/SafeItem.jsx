import { CLOSED_URL, OPEN_URL } from '../Contract_Files/constants';

export default function SafeItem({ safeNumber, closed, onClick }) {
  return (
    <div
      className={`safe-item${closed ? ' is-closed' : ''}`}
      onClick={() => onClick(safeNumber)}
      data-safe-state={closed ? 'closed' : 'open'}
      title={closed ? `Safe ${safeNumber} — locked` : `Safe ${safeNumber} — open`}
    >
      <img
        src={closed ? CLOSED_URL : OPEN_URL}
        alt={closed ? `Safe ${safeNumber} locked` : `Safe ${safeNumber} open`}
      />
      <p>{safeNumber}</p>
    </div>
  );
}