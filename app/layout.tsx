import { LoadingProvider } from "@/components/providers/loading-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
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
        <html lang="en" suppressHydrationWarning>
          <body
            className={`${inter.className} antialiased`}
          >
            <NextTopLoader showSpinner={false} color="var(--primary)" height={3} />
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <LoadingProvider>
                <Toaster />
                {children}
              </LoadingProvider>
            </ThemeProvider>
          </body>
        </html>
      </TRPCReactProvider>
    </NuqsAdapter>
  );
}
