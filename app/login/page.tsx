"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { prenom, nom, password, redirect: false });
    if (res?.error) {
      setError("Prénom, nom ou mot de passe incorrect.");
      setLoading(false);
    } else {
      // Le middleware redirige ensuite vers l'espace correspondant au rôle.
      window.location.href = "/";
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarDays className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">Vetelio</h1>
          <p className="text-sm text-muted-foreground">Connexion à votre espace</p>
        </div>

        <Card>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prénom</Label>
                  <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} required autoFocus />
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="(optionnel)" />
                </div>
              </div>
              <div>
                <Label>Mot de passe</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Démo — Admin : prénom « admin », mot de passe « admin1234 »
        </p>
      </div>
    </div>
  );
}
