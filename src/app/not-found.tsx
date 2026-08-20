import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div
      data-testid="not-found"
      className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6"
    >
      <FileQuestion className="w-12 h-12 text-ink-faint" aria-hidden="true" />
      <p className="text-5xl font-extrabold text-ink-faint mt-2">404</p>
      <h1 className="text-xl font-bold text-ink mt-2">Page Not Found</h1>
      <p className="text-xs text-ink-secondary mt-1 max-w-sm">
        The route you requested does not exist or has been moved. Use the navigation menu or head back to the
        dashboard.
      </p>
      <Link
        href="/"
        className="mt-5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition shadow-xs"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
