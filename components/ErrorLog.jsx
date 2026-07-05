export default function ErrorLog({ message, variant = 'error' }) {
  if (!message) {
    return <div className="error-log hidden" />;
  }

  return (
    <div className={`error-log${variant === 'success' ? ' success' : ''}`}>
      {message}
    </div>
  );
}