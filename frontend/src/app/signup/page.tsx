import { Suspense } from "react";
import { AuthForm } from "@/app/login/page";

export default function SignupPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-primary font-bold">Loading...</div>}>
            <AuthForm defaultMode="register" />
        </Suspense>
    );
}
