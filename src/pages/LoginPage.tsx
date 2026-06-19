import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store';
import logoUrl from '../assets/logo.jpeg';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const inactivityLogout = sessionStorage.getItem('jas_logout_reason') === 'inactividad';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    // Login acepta email completo o la parte antes del @ (usuario corto)
    const emailToTry = username.includes('@') ? username : `${username}@jasstore.co`;
    const ok = await login(emailToTry, password);
    setLoading(false);
    if (ok) {
      sessionStorage.removeItem('jas_logout_reason');
      const { currentUser } = useAppStore.getState();
      if (currentUser?.requirePasswordChange) {
        navigate('/cambiar-contrasena');
      } else {
        navigate('/');
      }
    } else {
      setError('Usuario o contraseña incorrectos');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #2e1065 0%, #4c1d95 40%, #6d28d9 100%)' }}>
      {/* Radial accents */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl mb-4 overflow-hidden"
            style={{ boxShadow: '0 0 0 4px rgb(167 139 250 / 0.3), 0 20px 40px rgb(0 0 0 / 0.3)' }}>
            <img src={logoUrl} alt="JAS Store" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">JAS Store</h1>
          <p className="text-purple-300 mt-1 text-sm">Sistema de Gestión Comercial</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-8"
          style={{ boxShadow: '0 8px 40px rgb(0 0 0 / 0.25), 0 0 0 1px rgb(255 255 255 / 0.1)' }}>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Iniciar sesión</h2>

          {inactivityLogout && !error && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-xl mb-4">
              <AlertCircle size={16} />
              Tu sesión se cerró por inactividad. Ingresa nuevamente.
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Usuario</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field pl-9"
                  placeholder="admin"
                  autoCapitalize="none"
                  autoCorrect="off"
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
        </div>
      </div>
    </div>
  );
}
