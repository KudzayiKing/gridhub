import type { Metadata } from "next";
import { OfflineContent } from "./offline-content";

export const metadata: Metadata = {
  title: "Offline & PWA",
  description:
    "Gridhub is an offline-first progressive web app. Install it on Android, iPhone, iPad or desktop and keep working without a connection.",
  alternates: { canonical: "/offline" },
};

export default function OfflinePage() {
  return <OfflineContent />;
}
