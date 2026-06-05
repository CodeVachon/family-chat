import { MessageSquare } from "lucide-react";

import { requireApprovedUser } from "@/lib/dal";

export default async function HomePage() {
    const user = await requireApprovedUser();

    return (
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                <MessageSquare className="size-7 text-muted-foreground" />
            </div>
            <h1 className="font-heading text-2xl font-semibold">
                Welcome, {user.name.split(" ")[0]}
            </h1>
            <p className="max-w-md text-muted-foreground">
                Channels and messaging are coming next. For now, your account is set up and
                approved.
            </p>
        </div>
    );
}
