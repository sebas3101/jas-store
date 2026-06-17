import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store';
import logoUrl from '../assets/logo.jpeg';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const doLogin = async (e: string, p: string) => {
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const ok = await login(e.trim(), p);
    setLoading(false);
    if (ok) navigate('/');
    else setError('Correo o contraseña incorrectos');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-primary-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-2xl mb-4 overflow-hidden">
            <img src={logoUrl} alt="JAS Store" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">JAS Store</h1>
          <p className="text-primary-200 mt-1 text-sm">Sistema de Gestión Comercial</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-5 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Iniciar sesión</h2>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-9"
                  placeholder="usuario@jasstore.co"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-9 pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base mt-2"
            >
              {loading ? 'Ingresando...' : 'Ingresar al sistema'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3 font-medium">
              Cuentas de demostración
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Admin', email: 'admin@jasstore.co',    pwd: 'admin123'    },
                { label: 'Jennifer', email: 'jennifer@jasstore.co', pwd: 'jennifer123' },
                { label: 'Alexis',   email: 'alexis@jasstore.co',   pwd: 'alexis123'   },
                { label: 'Vendedor', email: 'vendedor@jasstore.co', pwd: 'vendedor123' },
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => { setEmail(acc.email); setPassword(acc.pwd); doLogin(acc.email, acc.pwd); }}
                  className="text-xs bg-gray-50 hover:bg-primary-50 hover:text-primary-700 text-gray-500 px-3 py-2 rounded-xl transition-colors font-medium"
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
