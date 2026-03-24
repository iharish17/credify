export default function AboutPage() {
  return (
    <section className="page-stack">
      <header className="page-header-card">
        <span className="eyebrow">About Credify</span>
        <h1>Certificate operations, simplified for teams.</h1>
        <p>
          Credify helps educators, training teams, and event organizers generate
          personalized certificates from one template and one CSV source.
        </p>
      </header>

      <section className="about-grid">
        <article className="panel">
          <span className="panel-kicker">What It Solves</span>
          <h2>From manual edits to one-click batches</h2>
          <p>
            Instead of editing names one-by-one, you map your fields once, preview
            placement visually, and export all participant certificates as a ZIP.
          </p>
        </article>

        <article className="panel">
          <span className="panel-kicker">How It Works</span>
          <h2>Three simple steps</h2>
          <ol className="step-list">
            <li>Upload a certificate template and participant CSV.</li>
            <li>Place Name, Certificate ID, and QR overlays in preview.</li>
            <li>Generate and download your complete ZIP package.</li>
          </ol>
        </article>

        <article className="panel about-highlight">
          <span className="panel-kicker">Best For</span>
          <h2>Academic, corporate, events, and training</h2>
          <p>
            Whether you issue 30 certificates or 3,000, Credify is designed for
            repeatable delivery with consistent formatting and traceable IDs.
          </p>
        </article>
      </section>
    </section>
  );
}
