import type { Metadata, Viewport } from "next";
import { Geist_Mono, Figtree, Merriweather } from "next/font/google";
import { connection } from "next/server";

import "@workspace/ui/globals.css";
import { ServiceWorkerRegistrar } from "@/components/app/service-worker-registrar";
import { ThemeProvider } from "@/components/theme-provider";
import { getAppSettings } from "@/lib/queries/app-settings";
import { Toaster } from "@workspace/ui/components/sonner";
import { cn } from "@workspace/ui/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    // Resolve at request time so a renamed/re-iconed instance is reflected in
    // the document title and favicon (mirrors app/manifest.ts).
    await connection();
    const { name, iconUrl } = await getAppSettings();
    const icon = iconUrl ?? "/icon.svg";
    return {
        title: { default: name, template: `%s · ${name}` },
        appleWebApp: { capable: true, statusBarStyle: "default", title: name },
        icons: { icon, apple: icon }
    };
}

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
