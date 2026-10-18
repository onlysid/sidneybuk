import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// While developing, the site may be opened from this machine by any of its names, or from a phone on the same network by this machine's address.
const devOrigins = [
  "localhost",
  "127.0.0.1",
  "*.local",
  // Home and office networks, for opening it from a phone.
  "10.*.*.*",
  "192.168.*.*",
  "172.*.*.*",
  ...Object.values(networkInterfaces()).flatMap((list) => (list ?? []).filter((a) => a.family === "IPv4").map((a) => a.address)),
  ...(process.env.DEV_ORIGINS ?? "").split(",").map((x) => x.trim()).filter(Boolean),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: devOrigins,
  // Do not write notes for coding assistants into the project while developing.
  agentRules: false,
  // The little "N" badge Next shows while developing sits on top of the bar at the bottom of the page.
  devIndicators: false,
  // Builds a self-contained server in .next/standalone, which is what the Docker image runs.
  output: "standalone",
  serverExternalPackages: ["pg", "@react-pdf/renderer"],
  // This folder is the whole project, whatever else happens to sit in the folders above it.
  outputFileTracingRoot: __dirname,
  // The CV's PDF reads its typefaces from disk at run time; make sure the Docker image carries them.
  outputFileTracingIncludes: { "/cv/pdf": ["./lib/cv/fonts/**", "./public/icons/icon-512.png"] },
  turbopack: { root: __dirname },
  // Lets a page say forbidden(), which shows app/forbidden.tsx.
  experimental: { authInterrupts: true },
};

export default nextConfig;
