import { useState, type FormEvent } from 'react';
import { replateService } from '../services/replateService';
import type { AuthSession, Campus } from '../types/replate';

interface AuthSharedProps {
  campuses: Campus[];
  onAuthSuccess: (session: AuthSession) => void;
  onNavigate: (path: string) => void;
}

export function LoginPage({
  onAuthSuccess,
  onNavigate,
}: Pick<AuthSharedProps, 'onAuthSuccess' | 'onNavigate'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitLogin = async (loginEmail: string, loginPass: string) => {
    setError('');
    setLoading(true);
    try {
      const session = await replateService.login(loginEmail, loginPass);
      onAuthSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both your email and password.');
      return;
    }
    await submitLogin(email.trim(), password);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-[#E5EBE3] bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-[#1F2937]">Sign in to RePlate Campus</h1>
        <p className="mt-1.5 text-sm text-[#4B5563]">
          Access your student, vendor, or administrator account.
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-[#1F2937]">
              University Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@campus.edu.my"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-[#166534] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="block text-sm font-medium text-[#1F2937]">
                Password
              </label>
              <button
                type="button"
                onClick={() => onNavigate('/forgot-password')}
                className="text-xs font-medium text-[#166534] hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-[#166534] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 border-t border-[#F0F4EE] pt-5">
          <p className="text-xs font-semibold text-gray-500">
            Demo Accounts (Development Preview Only)
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setEmail('student@campus.edu.my');
                setPassword('RePlate2026!');
                submitLogin('student@campus.edu.my', 'RePlate2026!');
              }}
              className="rounded-lg border border-gray-300 bg-[#F8FAF7] px-2.5 py-2 text-xs font-semibold text-[#1F2937] hover:bg-[#EEF3EC]"
            >
              Demo Student
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setEmail('vendor@campus.edu.my');
                setPassword('RePlate2026!');
                submitLogin('vendor@campus.edu.my', 'RePlate2026!');
              }}
              className="rounded-lg border border-gray-300 bg-[#F8FAF7] px-2.5 py-2 text-xs font-semibold text-[#1F2937] hover:bg-[#EEF3EC]"
            >
              Demo Vendor
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setEmail('admin@campus.edu.my');
                setPassword('RePlate2026!');
                submitLogin('admin@campus.edu.my', 'RePlate2026!');
              }}
              className="rounded-lg border border-gray-300 bg-[#F8FAF7] px-2.5 py-2 text-xs font-semibold text-[#1F2937] hover:bg-[#EEF3EC]"
            >
              Demo Admin
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 text-center text-sm text-[#4B5563]">
          <span>
            New student?{' '}
            <button
              type="button"
              onClick={() => onNavigate('/register/student')}
              className="font-semibold text-[#166534] hover:underline"
            >
              Create student account
            </button>
          </span>
          <span>
            Cafeteria operator?{' '}
            <button
              type="button"
              onClick={() => onNavigate('/register/vendor')}
              className="font-semibold text-[#166534] hover:underline"
            >
              Register as vendor
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

export function StudentRegisterPage({ campuses, onAuthSuccess, onNavigate }: AuthSharedProps) {
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const session = await replateService.registerStudent({
        full_name: fullName.trim(),
        student_id: studentId.trim(),
        email: email.trim(),
        phone_number: phone.trim(),
        campus_id: campusId || campuses[0]?.id || '',
        password,
      });
      onAuthSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register student account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="rounded-xl border border-[#E5EBE3] bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-[#1F2937]">Student Registration</h1>
        <p className="mt-1.5 text-sm text-[#4B5563]">
          Sign up with your university details to reserve discounted campus meals.
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="st-name" className="block text-sm font-medium text-[#1F2937]">
                Full Name
              </label>
              <input
                id="st-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="st-id" className="block text-sm font-medium text-[#1F2937]">
                Student ID
              </label>
              <input
                id="st-id"
                type="text"
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. S221045"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="st-email" className="block text-sm font-medium text-[#1F2937]">
                University Email
              </label>
              <input
                id="st-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@student.edu.my"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="st-phone" className="block text-sm font-medium text-[#1F2937]">
                Phone Number
              </label>
              <input
                id="st-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="012-3456789"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="st-campus" className="block text-sm font-medium text-[#1F2937]">
              Campus
            </label>
            <select
              id="st-campus"
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.campus_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="st-pass" className="block text-sm font-medium text-[#1F2937]">
                Password
              </label>
              <input
                id="st-pass"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="st-confirm" className="block text-sm font-medium text-[#1F2937]">
                Confirm Password
              </label>
              <input
                id="st-confirm"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account...' : 'Create Student Account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#4B5563]">
          Already registered?{' '}
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="font-semibold text-[#166534] hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

export function VendorRegisterPage({ campuses, onAuthSuccess, onNavigate }: AuthSharedProps) {
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const session = await replateService.registerVendor({
        business_name: businessName.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        phone_number: phone.trim(),
        location: location.trim(),
        description: description.trim(),
        campus_id: campusId || campuses[0]?.id || '',
        password,
      });
      onAuthSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register vendor account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="rounded-xl border border-[#E5EBE3] bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-[#1F2937]">Vendor Registration</h1>
        <p className="mt-1.5 text-sm text-[#4B5563]">
          Register your campus cafeteria or cafe. New vendor accounts require administrator
          approval before publishing food listings.
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="v-biz" className="block text-sm font-medium text-[#1F2937]">
                Vendor / Business Name
              </label>
              <input
                id="v-biz"
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Kolej 10 Cafe"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="v-owner" className="block text-sm font-medium text-[#1F2937]">
                Owner&apos;s Full Name
              </label>
              <input
                id="v-owner"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="v-email" className="block text-sm font-medium text-[#1F2937]">
                University Email
              </label>
              <input
                id="v-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="v-phone" className="block text-sm font-medium text-[#1F2937]">
                Phone Number
              </label>
              <input
                id="v-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="v-campus" className="block text-sm font-medium text-[#1F2937]">
                Campus
              </label>
              <select
                id="v-campus"
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              >
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.campus_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="v-loc" className="block text-sm font-medium text-[#1F2937]">
                Cafeteria / Cafe Location
              </label>
              <input
                id="v-loc"
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Block C, Ground Floor"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="v-desc" className="block text-sm font-medium text-[#1F2937]">
              Short Description
            </label>
            <textarea
              id="v-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meals served and typical closing window..."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="v-pass" className="block text-sm font-medium text-[#1F2937]">
                Password
              </label>
              <input
                id="v-pass"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="v-confirm" className="block text-sm font-medium text-[#1F2937]">
                Confirm Password
              </label>
              <input
                id="v-confirm"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#166534] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Submitting application...' : 'Submit Vendor Registration'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#4B5563]">
          Already approved?{' '}
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="font-semibold text-[#166534] hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

export function ForgotPasswordPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await replateService.forgotPassword(email.trim());
      setMessage(res.message);
      if (res.previewResetToken) setToken(res.previewResetToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-[#E5EBE3] bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-[#1F2937]">Forgot Password</h1>
        <p className="mt-1.5 text-sm text-[#4B5563]">
          Enter your registered university email to request a password reset.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-lg border border-[#166534]/25 bg-[#F0F5EE] px-3.5 py-2.5 text-sm text-[#1F2937]">
            <p>{message}</p>
            {token && (
              <div className="mt-2">
                <p className="font-mono text-xs break-all text-[#166534]">Token: {token}</p>
                <button
                  type="button"
                  onClick={() => onNavigate(`/reset-password?token=${encodeURIComponent(token)}`)}
                  className="mt-2 rounded bg-[#166534] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Continue to Reset Password
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="fp-email" className="block text-sm font-medium text-[#1F2937]">
              University Email
            </label>
            <input
              id="fp-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-[#166534] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Reset Instructions'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function ResetPasswordPage({
  initialToken,
  onNavigate,
}: {
  initialToken: string;
  onNavigate: (path: string) => void;
}) {
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await replateService.resetPassword(token.trim(), newPassword);
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-[#E5EBE3] bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-[#1F2937]">Reset Password</h1>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-lg border border-[#166534]/25 bg-[#F0F5EE] px-3.5 py-2.5 text-sm text-[#1F2937]">
            <p>{message}</p>
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="mt-2 rounded bg-[#166534] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Go to Login
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="rp-token" className="block text-sm font-medium text-[#1F2937]">
              Reset Token
            </label>
            <input
              id="rp-token"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 font-mono text-xs focus:border-[#166534] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="rp-pass" className="block text-sm font-medium text-[#1F2937]">
              New Password
            </label>
            <input
              id="rp-pass"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-[#166534] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="rp-confirm" className="block text-sm font-medium text-[#1F2937]">
              Confirm New Password
            </label>
            <input
              id="rp-confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-[#166534] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
