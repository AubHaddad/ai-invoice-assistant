import { signInWithE2E, signInWithGoogle } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isE2ETestAuth } from "@/lib/e2e/env";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.82-.07-1.64-.23-2.43H12v4.6h6.46a5.52 5.52 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.56-5.17 3.56-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.97-1.07 7.96-2.93l-3.87-3c-1.08.72-2.47 1.14-4.09 1.14-3.14 0-5.8-2.12-6.75-4.97H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.24A7.21 7.21 0 0 1 4.87 12c0-.78.13-1.53.38-2.24V6.67H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.33l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.36.61 4.61 1.8l3.45-3.45C17.96 1.14 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.67l3.98 3.09C6.2 6.87 8.86 4.75 12 4.75Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Invoice Assistant</CardTitle>
          <CardDescription>
            Sign in to upload invoices and ask questions in chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {isE2ETestAuth() ? (
            <form action={signInWithE2E}>
              <Button type="submit" size="lg" className="w-full">
                Sign in as test user
              </Button>
            </form>
          ) : null}
          <form action={signInWithGoogle}>
            <Button type="submit" size="lg" className="w-full">
              <GoogleIcon />
              Sign in with Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
