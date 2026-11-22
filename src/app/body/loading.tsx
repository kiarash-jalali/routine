export default function BodyLoading() {
  return (
    <main id="main-content" className="page-shell" aria-busy="true">
      <div className="page-inner">
        <div className="mb-7 space-y-3">
          <div className="skeleton h-10 w-44" />
          <div className="skeleton h-5 w-72 max-w-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card h-28" />
          <div className="card h-28" />
          <div className="card h-28" />
        </div>
        <div className="mt-9 card h-64" />
      </div>
    </main>
  );
}
