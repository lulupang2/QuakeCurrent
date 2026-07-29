import type { Metadata } from "next";
import { headers } from "next/headers";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const DESCRIPTION =
  "USGS 지진 피드를 수집·정규화하고 재연결 가능한 REST·WebSocket 경계로 전달하는 풀스택 지구 관측 프로토타입.";

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

  const socialImage = `${origin}/og.png`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: "QuakeCurrent — Earthquake Data Prototype",
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
      title: "QuakeCurrent — Full-stack Earthquake Data Prototype",
      description: DESCRIPTION,
      siteName: "QuakeCurrent",
      locale: "ko_KR",
      images: [
        {
          url: socialImage,
          width: 1731,
          height: 909,
          alt: "지진 피드를 끊겨도 복구되는 데이터 프로토타입으로 만든 QuakeCurrent",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "QuakeCurrent — Full-stack Earthquake Data Prototype",
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
