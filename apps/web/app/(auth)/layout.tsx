export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
            <div className="flex w-full max-w-sm flex-col gap-6">
                <div className="text-center">
                    <h1 className="font-heading text-2xl font-semibold">Family Chat</h1>
                </div>
                {children}
            </div>
        </div>
    );
}
