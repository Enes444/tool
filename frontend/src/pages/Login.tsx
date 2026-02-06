import { useState } from "react";
import { api, setToken } from "../lib/api";
import { Card, CardBody, CardHeader } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader title="Welcome back" subtitle="Sign in to manage deals, proof vault and support desk." />
        <CardBody>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs muted">Email</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-xs muted">Password</div>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err ? <div className="text-sm text-rose-600 dark:text-rose-300">{err}</div> : null}
            <Button
              className="w-full"
              disabled={loading}
              variant="primary"
              onClick={async () => {
                setLoading(true);
                setErr(null);
                try {
                  const res = await api.login(email, password);
                  setToken(res.access_token);
                  nav("/");
                } catch (e: any) {
                  setErr(e.message || "Login failed");
                } finally {
                  setLoading(false);
                }
              }}
            >
              Sign in
            </Button>
            <div className="text-xs muted">Demo: admin@example.com / admin123</div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}