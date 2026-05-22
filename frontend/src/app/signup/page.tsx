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

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const token = useStore((state) => state.token);
  const setToken = useStore((state) => state.setToken);
  const setUser = useStore((state) => state.setUser);
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
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-600/10 rounded-full blur-[120px] -z-10" />
      
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <BrainCircuit className="h-8 w-8 text-orange-500" />
            <span className="font-bold text-2xl tracking-tight text-white">DronaAI</span>
          </Link>
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl text-white">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Create an account</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your email below to create your account
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSignup}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm bg-red-500/10 border border-red-500/20 text-red-400 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="bg-white/5 border-white/10 focus-visible:ring-orange-500"
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
                  className="bg-white/5 border-white/10 focus-visible:ring-orange-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full bg-orange-600 hover:bg-orange-500 text-white" 
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
