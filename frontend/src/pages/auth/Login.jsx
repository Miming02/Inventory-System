import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getErrorMessage } from "../../lib/errors";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Basic validation
    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      setIsLoading(false);
      return;
    }

    try {
      // Real Supabase authentication
      const { error } = await login(formData.email, formData.password);
      
      if (error) {
        setError(getErrorMessage(error));
      } else {
        // On successful login, redirect to dashboard
        navigate("/");
      }
    } catch (e) {
      setError(getErrorMessage(e) || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Decoration (Fluid Accents) */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary-fixed/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] rounded-full bg-secondary-fixed/30 blur-[100px] pointer-events-none"></div>

      {/* Main Content Canvas */}
      <main className="flex-grow flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-md">
          {/* Branding Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-primary to-primary-container text-white mb-6 shadow-xl shadow-primary/10">
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                water_drop
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-on-surface font-headline">The Fluid Curator</h1>
            <p className="text-on-surface-variant text-sm mt-2 font-medium tracking-tight">Intelligence for high-stakes inventory.</p>
          </div>

          {/* Login Card */}
          <div className="bg-surface-container-lowest rounded-[2rem] p-8 md:p-10 shadow-[0_12px_32px_-4px_rgba(23,28,31,0.06)] border border-white/50 backdrop-blur-sm">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-on-surface">Welcome back</h2>
              <p className="text-on-surface-variant text-xs mt-1">Please enter your details to access your workspace.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2">
                <label className="text-[0.75rem] font-semibold text-on-surface-variant px-1 uppercase tracking-wider" htmlFor="email">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-outline">
                    <span className="material-symbols-outlined text-[20px]">mail</span>
                  </div>
                  <input
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3.5 pl-12 pr-4 text-sm text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all duration-300"
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="curator@fluid.com"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-wider" htmlFor="password">
                    Password
                  </label>
                  <Link className="text-[0.75rem] font-semibold text-primary hover:text-primary-container transition-colors" to="/forgot-password">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-outline">
                    <span className="material-symbols-outlined text-[20px]">lock</span>
                  </div>
                  <input
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3.5 pl-12 pr-12 text-sm text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all duration-300"
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-4 flex items-center text-outline hover:text-on-surface transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center space-x-3 px-1">
                <div className="relative flex items-center">
                  <input
                    className="w-5 h-5 rounded-lg border-outline-variant bg-surface-container-highest text-primary focus:ring-primary/20 cursor-pointer transition-all"
                    id="remember"
                    name="remember"
                    type="checkbox"
                    checked={formData.remember}
                    onChange={handleChange}
                  />
                </div>
                <label className="text-sm text-on-surface-variant font-medium cursor-pointer select-none" htmlFor="remember">
                  Remember this device
                </label>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-primary to-primary-container text-white font-bold py-4 rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transform hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Login to Dashboard</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            {/* Signup Footer */}
            <div className="mt-10 text-center">
              <p className="text-sm text-on-surface-variant">
                {"Don't have an account? "}
                <Link className="text-primary font-bold ml-1 hover:underline underline-offset-4 decoration-2 transition-all" to="/request-access">
                  Request Access
                </Link>
              </p>
            </div>
          </div>

          {/* Client Trust / Meta */}
          <div className="mt-12 flex justify-center space-x-8 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span className="text-[0.65rem] font-bold tracking-widest uppercase">Secured by Vault-X</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-sm">cloud_done</span>
              <span className="text-[0.65rem] font-bold tracking-widest uppercase">System Operational</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Component */}
      <footer className="flex flex-col md:flex-row justify-between items-center w-full px-12 py-6 bg-transparent fixed bottom-0 z-20">
        <div className="text-xs font-['Inter'] tracking-wide text-slate-400 dark:text-slate-500 mb-4 md:mb-0">
          © 2024 The Fluid Curator. All rights reserved.
        </div>
        <div className="flex space-x-6">
          <Link className="text-xs font-['Inter'] tracking-wide text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-opacity opacity-80 hover:opacity-100" to="/privacy">
            Privacy Policy
          </Link>
          <Link className="text-xs font-['Inter'] tracking-wide text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-opacity opacity-80 hover:opacity-100" to="/terms">
            Terms of Service
          </Link>
          <Link className="text-xs font-['Inter'] tracking-wide text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-opacity opacity-80 hover:opacity-100" to="/status">
            System Status
          </Link>
        </div>
      </footer>
    </div>
  );
}
