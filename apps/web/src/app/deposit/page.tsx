export default function Page() {
  return (
    <div className="max-w-lg mx-auto mt-10 rounded-2xl border border-border bg-panel p-8 text-center">
      <div className="text-5xl mb-3">🔒</div>
      <h1 className="text-2xl font-bold mb-2">Payments disabled</h1>
      <p className="text-gray-400">
        В исследовательском макете платежи отключены.
        <br />
        Payments are disabled in the research prototype.
      </p>
      <p className="text-xs text-gray-500 mt-4">
        This platform runs exclusively on virtual currency (RC). No real-money deposits,
        withdrawals, or payment providers are supported.
      </p>
    </div>
  );
}
