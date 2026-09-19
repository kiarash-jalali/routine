export default function CheckinLoading() {
  return (
    <main id="main-content" className="page-shell" aria-busy="true">
      <div className="page-inner max-w-3xl">
        <div className="mb-7 space-y-3">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-10 w-52" />
          <div className="skeleton h-5 w-72 max-w-full" />
        </div>
        <div className="space-y-6">
          <div className="card h-56" />
          <div className="card h-56" />
          <div className="card h-24" />
        </div>
      </div>
    </main>
  );
}
