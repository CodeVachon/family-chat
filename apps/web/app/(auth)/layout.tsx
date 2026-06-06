import { getAppSettings } from "@/lib/queries/app-settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
    const { name, iconUrl } = await getAppSettings();
    return (
        <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
            <div className="flex w-full max-w-sm flex-col gap-6">
                <div className="flex flex-col items-center gap-2 text-center">
                    {iconUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={iconUrl} alt="" className="size-10 rounded-lg" />
                    )}
                    <h1 className="font-heading text-2xl font-semibold">{name}</h1>
                </div>
                {children}
            </div>
        </div>
    );
}
