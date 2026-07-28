import { AppSplash } from "@/components/app/app-splash";
import { getAppSettings } from "@/lib/queries/app-settings";

/**
 * Root-level loading fallback: the first thing painted after the OS splash on a
 * cold start, before the authed shell (or a signed-out page) has streamed in.
 *
 * `getAppSettings` is request-memoized and already resolved by the root layout's
 * `generateMetadata`, so branding it costs no extra query.
 */
export default async function RootLoading() {
    const { name, iconUrl } = await getAppSettings();
    return <AppSplash appName={name} appIconUrl={iconUrl} />;
}
