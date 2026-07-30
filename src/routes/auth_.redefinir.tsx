import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth_/redefinir")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Nexo" },
      {
        name: "description",
        content: "Defina uma nova senha para sua conta no Nexo — Copiloto Corporativo.",
      },
      { property: "og:title", content: "Redefinir senha — Nexo" },
      {
        property: "og:description",
        content: "Defina uma nova senha para sua conta no Nexo — Copiloto Corporativo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setHasSession(true);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha redefinida. Você já está conectado.");
      navigate({ to: "/chat", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md p-8">
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar ao login
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Redefinir senha</h1>

        {!ready ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Validando link…
          </p>
        ) : !hasSession ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Link inválido ou expirado. Volte ao login e solicite um novo e-mail de
            recuperação.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha uma nova senha com pelo menos 8 caracteres.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirmar nova senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar nova senha
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}