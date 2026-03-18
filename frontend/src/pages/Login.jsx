import { GalleryVerticalEnd } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-6 px-6 py-10 md:px-10 lg:px-12 lg:py-16">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Urban Grid
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="bg-muted/60 relative hidden lg:block">
        <div className="flex h-full items-center justify-center">
          <img
            src="/undraw_ai-answers_uxgx.svg"
            alt="AI Response Illustration"
            className="max-w-xs p-6 md:max-w-sm lg:max-w-md"
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <blockquote className="space-y-2 text-foreground/60">
            <p className="text-lg">
              "This tool has saved us countless hours of manual review. The AI-powered insights are a game-changer."
            </p>
            <footer className="text-sm text-muted-foreground">Aryan Bokolia, Student</footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
