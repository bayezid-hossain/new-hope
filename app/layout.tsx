import { LoadingProvider } from "@/components/providers/loading-provider";
import { Toaster } from "@/components/ui/sonner";
import { TwoFactorGuard } from "@/modules/auth/ui/components/two-factor-guard";
import { TRPCReactProvider } from "@/trpc/client";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { NuqsAdapter } from "nuqs/adapters/next";
import "./globals.css";
const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Feed Reminder",
  description: "A reminder app that helps you stay on top of your feeds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <NuqsAdapter>
      {" "}
      <TRPCReactProvider>
        <html lang="en">
          <body
            className={`${inter.className} antialiased`}
          >
            <NextTopLoader showSpinner={false} color="#1c1917" />
            <LoadingProvider>
              <Toaster />
              <TwoFactorGuard>
                {children}
              </TwoFactorGuard>
            </LoadingProvider>
          </body>
        </html>
      </TRPCReactProvider>
    </NuqsAdapter>
  );
}
