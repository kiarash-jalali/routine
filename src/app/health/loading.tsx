export default function HealthLoading() {
  return (
    <main id="main-content" className="page-shell" aria-busy="true">
      <div className="page-inner">
        <div className="mb-7 space-y-3">
          <div className="skeleton h-10 w-44" />
          <div className="skeleton h-5 w-72 max-w-full" />
        </div>
        <div className="mb-5 skeleton h-11 w-48" />
        <div className="space-y-3">
          <div className="card h-32" />
          <div className="card h-32" />
        </div>
        <div className="mt-9 card h-64" />
      </div>
    </main>
  );
}
