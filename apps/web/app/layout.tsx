import type { Metadata, Viewport } from "next";
import { Geist_Mono, Figtree, Merriweather } from "next/font/google";

import "@workspace/ui/globals.css";
import { ServiceWorkerRegistrar } from "@/components/app/service-worker-registrar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@workspace/ui/components/sonner";
import { cn } from "@workspace/ui/lib/utils";

export const metadata: Metadata = {
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Family Chat" },
    icons: { icon: "/icon.svg", apple: "/icon.svg" }
};

export const viewport: Viewport = {
    themeColor: "#2563eb"
};

const merriweatherHeading = Merriweather({ subsets: ["latin"], variable: "--font-heading" });

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-mono"
});

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            data-component="RootLayout"
            lang="en"
            suppressHydrationWarning
            className={cn(
                "antialiased",
                fontMono.variable,
                "font-sans",
                figtree.variable,
                merriweatherHeading.variable
            )}
        >
            <body>
                <ThemeProvider>{children}</ThemeProvider>
                <Toaster />
                <ServiceWorkerRegistrar />
            </body>
        </html>
    );
}
