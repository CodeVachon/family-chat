import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@workspace/ui/components/card";

export default function LoginPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>Sign in to continue to Family Chat.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <LoginForm />
                <p className="text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <Link href="/signup" className="text-primary hover:underline">
                        Sign up
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}
