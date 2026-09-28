"use client";

/**
 * Last-resort boundary for a failure in the root layout, where the error
 * boundary itself cannot render. It must render its own <html> and <body>,
 * and it deliberately has no dependency on any of the app's providers, fonts or
 * components -- if those are what broke, using them here would break again.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
            Buildora could not start
          </h1>
          <p style={{ marginTop: "0.5rem", lineHeight: 1.5 }}>
            Something went wrong before the page could load. Reloading usually
            fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              height: "3rem",
              padding: "0 1.25rem",
              borderRadius: "0.5rem",
              border: 0,
              background: "#1d4ed8",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
