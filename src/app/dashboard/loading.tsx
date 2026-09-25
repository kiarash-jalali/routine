export default function DashboardLoading() {
  return (
    <main id="main-content" className="page-shell" aria-busy="true">
      <div className="page-inner">
        <div className="mb-7 space-y-3">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-10 w-48" />
          <div className="skeleton h-5 w-72 max-w-full" />
        </div>
        <div className="card mb-7 h-28">
          <div className="skeleton h-5 w-24" />
          <div className="skeleton mt-5 h-12 w-full" />
        </div>
        <div className="stats-strip mb-7 grid grid-cols-3 gap-4 rounded-2xl px-5 py-5">
          <div className="skeleton h-12" />
          <div className="skeleton h-12" />
          <div className="skeleton h-12" />
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <div className="card h-56" />
            <div className="card h-72" />
          </div>
          <div className="space-y-6">
            <div className="card h-52" />
            <div className="card h-56" />
          </div>
        </div>
      </div>
    </main>
  );
}
