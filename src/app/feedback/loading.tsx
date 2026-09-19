export default function FeedbackLoading() {
  return (
    <main id="main-content" className="page-shell" aria-busy="true">
      <div className="page-inner max-w-3xl">
        <div className="mb-7 space-y-3">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-10 w-64" />
          <div className="skeleton h-5 w-full max-w-xl" />
        </div>
        <div className="card h-96" />
      </div>
    </main>
  );
}
