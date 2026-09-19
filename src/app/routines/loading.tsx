export default function RoutinesLoading() {
  return (
    <main id="main-content" className="page-shell" aria-busy="true">
      <div className="page-inner">
        <div className="mb-7 space-y-3">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-10 w-48" />
          <div className="skeleton h-5 w-72 max-w-full" />
        </div>
        <div className="mb-6 flex gap-3">
          <div className="skeleton h-11 w-64 max-w-full" />
          <div className="skeleton h-5 w-24" />
        </div>
        <div className="card h-80" />
      </div>
    </main>
  );
}
