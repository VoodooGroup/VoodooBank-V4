import { CLOSED_URL, OPEN_URL } from '../Contract_Files/constants';

export default function SafeItem({ safeNumber, closed, onClick }) {
  return (
    <div
      className={`safe-item${closed ? ' is-closed' : ''}`}
      onClick={() => onClick(safeNumber)}
    >
      <img src={closed ? CLOSED_URL : OPEN_URL} alt={`Safe ${safeNumber}`} />
      <p>{safeNumber}</p>
    </div>
  );
}