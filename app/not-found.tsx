import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo size="md" />
      <p className="eyebrow">404</p>
      <h1 className="display-xl text-3xl">Nothing in this place.</h1>
      <p className="text-[13px] leading-relaxed text-fg-muted">
        That page does not exist. It may have moved, or the link may be incomplete.
      </p>
      <div className="flex gap-2">
        <Button variant="primary" size="md" iconRight="arrowRight" asChild>
          <Link href="/">Back home</Link>
        </Button>
        <Button variant="secondary" size="md" asChild>
          <Link href="/app">Open workspace</Link>
        </Button>
      </div>
    </div>
  );
}
