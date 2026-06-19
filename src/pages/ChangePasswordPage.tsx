import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, KeyRound, AlertCircle, CheckCircle } from 'lucide-react';
import { useAppStore } from '../store';
import logoUrl from '../assets/logo.jpeg';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { currentUser, updateUser, logout } = useAppStore();
  const [newPwd,     setNewPwd]    = useState('');
  const [confirmPwd, setConfirmPwd]= useState('');
  const [showNew,    setShowNew]   = useState(false);
  const [showConf,   setShowConf]  = useState(false);
  const [error,      setError]     = useState('');
  const [loading,    setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPwd.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (!currentUser) return;
    setLoading(true);
    await updateUser(currentUser.id, { password: newPwd, requirePasswordChange: false });
    // Actualizar sesión en localStorage
    const stored = JSON.parse(localStorage.getItem('jas_user') ?? '{}');
    localStorage.setItem('jas_user', JSON.stringify({ ...stored, requirePasswordChange: false }));
    setLoading(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-primary-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-2xl mb-4 overflow-hidden">
            <img src={logoUrl} alt="JAS Store" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white">JAS Store</h1>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <KeyRound size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Cambiar contraseña</h2>
              <p className="text-xs text-gray-400">El administrador ha solicitado un cambio de contraseña</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nueva contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  className="input-field pl-9 pr-10"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirmar contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type={showConf ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  className="input-field pl-9 pr-10"
                  placeholder="Repite la contraseña"
                  required
                />
                <button type="button" onClick={() => setShowConf(!showConf)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                  {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPwd && newPwd && confirmPwd === newPwd && (
                <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                  <CheckCircle size={12} /> Las contraseñas coinciden
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base mt-2"
            >
              {loading ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>

          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
