import Link from "next/link";

import { SignupForm } from "@/components/auth/signup-form";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@workspace/ui/components/card";

export default function SignupPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Create your account</CardTitle>
                <CardDescription>
                    New accounts need approval before you can see channels.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <SignupForm />
                <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/login" className="text-primary hover:underline">
                        Sign in
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}
