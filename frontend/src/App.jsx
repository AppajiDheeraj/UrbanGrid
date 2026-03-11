function App() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.6),_rgba(241,245,249,1))] px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
          UrbanGrid Platform
        </p>
        <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-6xl">
          Smart city workflows in one modern control center.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">
          Track citizen requests, verification pipelines, and contractor progress with a
          single transparent system designed for city-scale operations.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <button className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800">
            Create your first workspace
          </button>
          <button className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300">
            View system flow
          </button>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Citizen intake",
              body: "Centralize and categorize complaints with geo-aware metadata.",
            },
            {
              title: "Tender pipeline",
              body: "Coordinate approvals, bids, and award decisions in one view.",
            },
            {
              title: "Execution visibility",
              body: "Monitor project milestones with automated status updates.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

export default App
