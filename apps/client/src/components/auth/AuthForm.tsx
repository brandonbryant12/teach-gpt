import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, Link, useLocation } from 'react-router-dom';

import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../hooks/useAuth';

// --- Zod Schemas ---

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password is required' }), // Server-side validation is more robust
});

const registerSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' }),
  // Add confirm password later if needed
});

// Union schema for a single form approach
const authSchema = z.union([loginSchema, registerSchema]);

// --- Types ---
// Export these types so they can be imported by the client
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;

// --- Component Props ---
interface AuthFormProps {
  mode: 'login' | 'register';
}

// --- Component ---
export function AuthForm({ mode }: AuthFormProps) {
  const { login, register, isLoading, error: authError, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // Get current location

  // Redirect if already logged in
  useEffect(() => {
    if (token) {
       // Redirect from /login or /register to home if logged in
       const from = (location.state as { from?: Location })?.from?.pathname || "/";
       navigate(from, { replace: true });
    }
  }, [token, navigate, location]);

  const isLoginMode = mode === 'login';
  const currentSchema = isLoginMode ? loginSchema : registerSchema;

  const form = useForm<LoginFormValues | RegisterFormValues>({
    resolver: zodResolver(currentSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Keep local API error state
  const [apiError, setApiError] = useState<string | null>(null);

  // --- Handlers ---
  const onSubmit = async (values: LoginFormValues | RegisterFormValues) => {
    setApiError(null);
    try {
      if (isLoginMode) {
        await login(values as LoginFormValues); // Context login expects LoginCredentials
        // Redirect handled by useEffect or can be done here
        // navigate('/');
      } else {
        // Auto-login after registration is handled in AuthContext now
        await register(values as RegisterFormValues); // Context register expects RegisterUserData
        // Redirect handled by useEffect or can be done here
        // navigate('/');
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'An unknown error occurred');
      console.error(`${isLoginMode ? 'Login' : 'Registration'} failed:`, error);
    }
  };

  // Determine which error to display
  const displayError = apiError || authError;

  // --- Render ---
  return (
    <div className="flex justify-center items-center min-h-screen bg-muted/40"> {/* Added subtle background */}
      <Card className="w-[400px] shadow-lg"> {/* Added shadow */}
        <CardHeader className="text-center"> {/* Centered Header */}
          <CardTitle className="text-2xl font-bold"> {/* Larger Title */}
            {isLoginMode ? 'Welcome Back!' : 'Create an Account'}
          </CardTitle>
          <CardDescription>
            {isLoginMode
              ? 'Enter your credentials to access your account.'
              : 'Enter your email and password to register.'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                 <p className="text-sm text-red-600">
                   {/* Use type assertion as errors structure depends on the combined form state */}
                   {(form.formState.errors.password as { message?: string })?.message}
                 </p>
              )}
            </div>
             {displayError && (
                <p className="text-sm font-medium text-red-600 text-center"> {/* Centered Error */}
                    {displayError}
                </p>
             )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4"> {/* Footer items stack */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? (isLoginMode ? 'Logging in...' : 'Creating Account...')
                : (isLoginMode ? 'Login' : 'Create Account')}
            </Button>
             <p className="text-sm text-muted-foreground">
                {isLoginMode ? "Don't have an account? " : "Already have an account? "}
                <Link to={isLoginMode ? '/register' : '/login'} className="font-medium text-primary hover:underline">
                    {isLoginMode ? 'Register' : 'Login'}
                </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 