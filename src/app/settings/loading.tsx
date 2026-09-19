export default function SettingsLoading() {
  return (
    <main id="main-content" className="page-shell" aria-busy="true">
      <div className="page-inner">
        <div className="mb-7 space-y-3">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-10 w-44" />
          <div className="skeleton h-5 w-72 max-w-full" />
        </div>
        <div className="grid gap-8 xl:grid-cols-2">
          <div className="card h-72" />
          <div className="card h-64" />
          <div className="card h-64" />
          <div className="card h-56" />
        </div>
      </div>
    </main>
  );
}
