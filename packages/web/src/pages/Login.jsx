import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginSchema } from '@ct/shared';
import { useAuth } from '../context/AuthContext.jsx';
import Field from '../components/Field.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState(null);

  // The SAME Zod schema the server validates against. One definition of what a
  // valid login is, so the client can never disagree with the API about it.
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await login(values);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <main className="auth-page">
      <h1>Sign in</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Email" error={formState.errors.email?.message}>
          <input type="email" autoComplete="email" {...register('email')} />
        </Field>

        <Field label="Password" error={formState.errors.password?.message}>
          <input type="password" autoComplete="current-password" {...register('password')} />
        </Field>

        {serverError && <p className="form-error">{serverError}</p>}

        <button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="muted">
        No account yet? <Link to="/register">Create one</Link>
      </p>
    </main>
  );
}
