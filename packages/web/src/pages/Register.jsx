import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema } from '@ct/shared';
import { useAuth } from '../context/AuthContext.jsx';
import Field from '../components/Field.jsx';

export default function Register() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);

  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      // Pick up the browser's timezone so localDate is right from the first entry.
      profile: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    },
  });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await signUp(values);
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <main className="auth-page">
      <h1>Create an account</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Display name" error={formState.errors.profile?.displayName?.message}>
          <input autoComplete="name" {...register('profile.displayName')} />
        </Field>

        <Field label="Email" error={formState.errors.email?.message}>
          <input type="email" autoComplete="email" {...register('email')} />
        </Field>

        <Field
          label="Password"
          hint="At least 8 characters"
          error={formState.errors.password?.message}
        >
          <input type="password" autoComplete="new-password" {...register('password')} />
        </Field>

        <input type="hidden" {...register('profile.timezone')} />

        {serverError && <p className="form-error">{serverError}</p>}

        <button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <p className="muted">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </main>
  );
}
