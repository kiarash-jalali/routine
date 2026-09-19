export default function HistoryLoading() {
  return (
    <main id="main-content" className="page-shell" aria-busy="true">
      <div className="page-inner">
        <div className="mb-7 space-y-3">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-10 w-52" />
          <div className="skeleton h-5 w-80 max-w-full" />
        </div>
        <div className="space-y-6">
          <div className="card h-32" />
          <div className="card h-96" />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="card h-80" />
            <div className="card h-80" />
          </div>
        </div>
      </div>
    </main>
  );
}
