import Link from "next/link";

// Placeholder until the supervisor shell lands (step 3).
export default function Home() {
  return (
    <main id="main-content" className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-12">
      <h1 className="text-3xl font-semibold">Saakshi</h1>
      <p className="text-ink-muted">Supervisor screens are not built yet.</p>
      {process.env.NODE_ENV === "development" && (
        <Link
          href="/dev/ui"
          className="inline-flex min-h-12 w-fit items-center font-semibold text-primary underline underline-offset-4"
        >
          Open the UI kitchen sink
        </Link>
      )}
    </main>
  );
}
