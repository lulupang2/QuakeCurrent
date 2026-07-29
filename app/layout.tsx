import type { Metadata } from "next";
import { headers } from "next/headers";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const DESCRIPTION =
  "USGS 지진 피드를 수집·정규화하고 실시간으로 전달하는 지구 관측 프로토타입.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const rawHost =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const host = rawHost.split(",")[0].trim();
  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https";

  let origin = "http://localhost:3000";
  try {
    origin = new URL(`${protocol}://${host}`).origin;
  } catch {
    // Keep a valid local metadata base when a development proxy sends a
    // malformed host header.
  }

  const socialImage = `${origin}/og-cycle-02.png`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: "QuakeCurrent — Live Earthquake Monitor",
      template: "%s · QuakeCurrent",
    },
    description: DESCRIPTION,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      url: origin,
      title: "QuakeCurrent — Live Earthquake Monitor",
      description: DESCRIPTION,
      siteName: "QuakeCurrent",
      locale: "ko_KR",
      images: [
        {
          url: socialImage,
          width: 1731,
          height: 909,
          alt: "QuakeCurrent Prototype, Plan, Autopilot, Review workflow",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "QuakeCurrent — Live Earthquake Monitor",
      description: DESCRIPTION,
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
