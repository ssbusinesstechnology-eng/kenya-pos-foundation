import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm, LoginForm, RegisterForm } from "@/components/auth/AuthForms";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · S&S POS" },
      {
        name: "description",
        content:
          "Sign in or create your S&S POS account to run sales and stock for your business in Kenya.",
      },
      { property: "og:title", content: "Sign in · S&S POS" },
      {
        property: "og:description",
        content: "Point of sale and inventory for small businesses, by S&S Tech Solutions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "register" | "forgot">("signin");

  if (mode === "forgot") {
    return (
      <AuthShell
        title="Reset your password"
        subtitle="We'll email you a secure link to choose a new password."
      >
        <ForgotPasswordForm onBack={() => setMode("signin")} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="S&S POS"
      subtitle="Sales, stock and customers in one calm place."
      footer={
        mode === "signin" ? (
          <Button variant="link" className="h-auto p-0" onClick={() => setMode("forgot")}>
            Forgot your password?
          </Button>
        ) : null
      }
    >
      <Tabs value={mode} onValueChange={(value) => setMode(value as "signin" | "register")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="register">Create account</TabsTrigger>
        </TabsList>
        <TabsContent value="signin" className="mt-6">
          <LoginForm />
        </TabsContent>
        <TabsContent value="register" className="mt-6">
          <RegisterForm />
        </TabsContent>
      </Tabs>
    </AuthShell>
  );
}
