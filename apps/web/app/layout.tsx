import type { Metadata, Viewport } from "next";
import {
    Atkinson_Hyperlegible,
    Figtree,
    Geist_Mono,
    Inter,
    Merriweather,
    Nunito_Sans,
    Open_Sans
} from "next/font/google";
import { headers } from "next/headers";
import { connection } from "next/server";

import "@workspace/ui/globals.css";
import { ServiceWorkerRegistrar } from "@/components/app/service-worker-registrar";
import { ThemeProvider } from "@/components/theme-provider";
import { getSession } from "@/lib/dal";
import { getAppSettings } from "@/lib/queries/app-settings";
import { getUserPreferences } from "@/lib/queries/preferences";
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

const fontMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-mono"
});

// Selectable body fonts. Figtree is the default (its variable IS --font-sans);
// the others expose their own variable that globals.css swaps into --font-sans
// based on the user's data-font-family. Atkinson Hyperlegible is non-variable,
// so it needs explicit weights.
const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans" });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans" });
const atkinson = Atkinson_Hyperlegible({
    subsets: ["latin"],
    weight: ["400", "700"],
    variable: "--font-atkinson"
});

const fontVariables = [
    fontMono.variable,
    figtree.variable,
    inter.variable,
    openSans.variable,
    nunitoSans.variable,
    atkinson.variable,
    merriweatherHeading.variable
];

export default async function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    // CSP nonce set by the proxy middleware; hand it to next-themes so its
    // pre-paint inline theme script is allowed under the strict-dynamic policy.
    const nonce = (await headers()).get("x-nonce") ?? undefined;

    // Resolve the signed-in user's font prefs (if any) so the size/family are
    // applied to <html> on the server — no flash of the default on load. Falls
    // back to defaults for signed-out pages. getUserPreferences is request-
    // memoized, so the app layout reuses this same read.
    const session = await getSession();
    const prefs = session?.user ? await getUserPreferences(session.user.id) : null;

    return (
        <html
            data-component="RootLayout"
            lang="en"
            suppressHydrationWarning
            data-font-size={prefs?.fontSizeScale ?? "default"}
            data-font-family={prefs?.fontFamily ?? "figtree"}
            className={cn("antialiased", "font-sans", ...fontVariables)}
        >
            <body>
                <ThemeProvider nonce={nonce}>{children}</ThemeProvider>
                <Toaster />
                <ServiceWorkerRegistrar />
            </body>
        </html>
    );
}
