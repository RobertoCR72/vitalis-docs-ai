import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const searchSchema = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Entrar — Nexo" },
      { name: "description", content: "Acesse o Nexo — Copiloto Corporativo com sua conta." },
    ],
  }),
  component: AuthPage,
});

function safeNext(next?: string) {
  if (!next) return "/chat";
  if (!next.startsWith("/") || next.startsWith("//")) return "/chat";
  return next;
}

function AuthPage() {
  const { next } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: safeNext(next), replace: true });
    });
  }, [navigate, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Bem-vindo(a) ao Nexo.");
      navigate({ to: safeNext(next), replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setLoading(false);
    }
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/redefinir`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("Se o e-mail existir, enviamos um link de recuperação.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o e-mail.");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "forgot") {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <Card className="w-full max-w-md p-8">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setResetSent(false);
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Voltar ao login
          </button>
          <h1 className="mt-4 text-2xl font-semibold">Esqueci minha senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe seu e-mail e enviaremos um link para redefinir a senha.
          </p>
          {resetSent ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Se houver uma conta para <span className="font-medium text-foreground">{email}</span>,
              o link de recuperação chegará em instantes. Verifique também a caixa de spam.
            </p>
          ) : (
            <form onSubmit={sendReset} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="reset-email">E-mail</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar link de recuperação
              </Button>
            </form>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md p-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Acessar o Nexo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesso restrito a usuários provisionados pelo administrador. Não use dados reais.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode("forgot")}
          className="mt-4 text-sm text-primary underline-offset-4 hover:underline"
        >
          Esqueci minha senha
        </button>
        <p className="mt-4 text-xs text-muted-foreground">
          Cadastro público desabilitado. Solicite acesso ao administrador do projeto.
        </p>
      </Card>
    </div>
  );
}