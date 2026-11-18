import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center"><h1 className="text-2xl font-bold">Report not found</h1><p className="mt-2 text-sm text-muted">It may have been deleted, expired (guest reports last 24 hours) or belong to another account.</p><Link className="mt-4 inline-block text-accent underline" href="/app">Back to overview</Link></div>
  );
}
