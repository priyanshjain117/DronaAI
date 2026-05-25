'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import ThemeToggle from '@/components/ThemeToggle';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const token = useStore((state) => state.token);
  const setToken = useStore((state) => state.setToken);
  const setUser = useStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (mounted && token) {
      const next = new URLSearchParams(window.location.search).get('next') || '/dashboard';
      router.push(next);
    }
  }, [mounted, token, router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/signup', { email, password });
      queryClient.clear();
      setToken(response.data.access_token);
      setUser(response.data.user);
      const next = new URLSearchParams(window.location.search).get('next') || '/dashboard';
      router.push(next);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { detail?: string } } };
      setError(apiError.response?.data?.detail || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="learning-shell min-h-screen items-center justify-center p-4">
      
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <div className="w-11" />
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-lg shadow-orange-950/30">
              <BrainCircuit className="h-6 w-6 text-white" />
            </span>
            <span className="font-heading text-2xl font-bold tracking-normal text-slate-50">DronaAI</span>
          </Link>
          <ThemeToggle compact />
        </div>

        <Card className="premium-panel text-white">
          <CardHeader className="space-y-1">
            <CardTitle className="font-heading text-3xl font-bold tracking-normal">Create an account</CardTitle>
            <CardDescription className="text-slate-400">
              Start building your AI study workspace.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSignup}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="smart-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  className="smart-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="primary-action w-full" 
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create account'}
              </Button>
              <p className="text-sm text-center text-slate-400">
                Already have an account?{' '}
                <Link href="/login" className="text-orange-400 hover:text-orange-300 hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
