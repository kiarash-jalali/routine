export default function OnboardingLoading() {
  return (
    <main id="main-content" className="page-shell" aria-busy="true">
      <div className="page-inner max-w-xl">
        <div className="mb-7 flex items-center justify-between">
          <div className="skeleton h-12 w-12 rounded-2xl" />
          <div className="skeleton h-11 w-32" />
        </div>
        <div className="card h-[32rem]" />
      </div>
    </main>
  );
}
