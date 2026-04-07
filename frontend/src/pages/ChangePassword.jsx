import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, Eye, EyeOff, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, ErrorBanner } from '../components/ui';

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Password strength calculation
  const calculateStrength = (password) => {
    if (!password) return 0;
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;

    return Math.ceil((strength / 6) * 4);
  };

  const strength = calculateStrength(newPassword);

  const getStrengthLabel = () => {
    if (strength === 0) return 'No password';
    if (strength === 1) return 'Weak';
    if (strength === 2) return 'Fair';
    if (strength === 3) return 'Strong';
    return 'Very Strong';
  };

  const getStrengthColor = () => {
    if (strength === 0) return 'bg-slate-600';
    if (strength === 1) return 'bg-red-500';
    if (strength === 2) return 'bg-yellow-500';
    if (strength === 3) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStrengthTextColor = () => {
    if (strength === 0) return 'text-slate-400';
    if (strength === 1) return 'text-red-400';
    if (strength === 2) return 'text-yellow-400';
    if (strength === 3) return 'text-blue-400';
    return 'text-green-400';
  };

  // Validation
  const isCurrentPasswordValid = currentPassword.trim().length > 0;
  const isNewPasswordValid =
    newPassword.length >= 8 &&
    /[a-z]/.test(newPassword) &&
    /[A-Z]/.test(newPassword) &&
    /\d/.test(newPassword);
  const isConfirmPasswordValid = newPassword === confirmPassword && newPassword.length > 0;
  const isFormValid = isCurrentPasswordValid && isNewPasswordValid && isConfirmPasswordValid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isFormValid) {
      setError('Please fix validation errors');
      return;
    }

    setLoading(true);

    try {
      await api.changePassword({
        currentPassword,
        newPassword,
      });

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to change password. Please check your current password and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <PageHeader title="Account Security" />

      <div className="flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          {/* Success Message */}
          {success && (
            <div className="mb-6 rounded-lg bg-green-900/30 border border-green-700 p-4 flex items-start gap-3">
              <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-green-100 font-medium">Password Changed Successfully</p>
                <p className="text-green-200 text-sm mt-1">Redirecting to home...</p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && <ErrorBanner message={error} className="mb-6" />}

          {/* Card */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 shadow-xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <Shield className="text-blue-400" size={28} />
              <h1 className="text-2xl font-bold text-slate-100">Change Password</h1>
            </div>

            <p className="text-slate-400 text-sm mb-6">
              Keep your account secure by regularly updating your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Current Password Field */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-10 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition"
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {!isCurrentPasswordValid && currentPassword.length > 0 && (
                  <p className="text-red-400 text-xs mt-1.5">Current password is required</p>
                )}
              </div>

              {/* New Password Field */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-10 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Strength Indicator */}
                {newPassword && (
                  <div className="mt-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 h-2 bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getStrengthColor()} transition-all duration-300`}
                          style={{ width: `${(strength / 4) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${getStrengthTextColor()}`}>
                        {getStrengthLabel()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 space-y-0.5">
                      <div className={`flex items-center gap-1.5 ${newPassword.length >= 8 ? 'text-green-400' : ''}`}>
                        <Key size={12} className={newPassword.length >= 8 ? 'text-green-400' : 'text-slate-500'} />
                        <span>At least 8 characters</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? 'text-green-400' : ''}`}>
                        <Key size={12} className={/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? 'text-green-400' : 'text-slate-500'} />
                        <span>Uppercase and lowercase letters</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${/\d/.test(newPassword) ? 'text-green-400' : ''}`}>
                        <Key size={12} className={/\d/.test(newPassword) ? 'text-green-400' : 'text-slate-500'} />
                        <span>At least one number</span>
                      </div>
                    </div>
                  </div>
                )}

                {newPassword && !isNewPasswordValid && (
                  <p className="text-red-400 text-xs mt-2">Password does not meet requirements</p>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-10 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-red-400 text-xs mt-1.5">Passwords do not match</p>
                )}
                {confirmPassword && newPassword === confirmPassword && newPassword.length > 0 && (
                  <p className="text-green-400 text-xs mt-1.5 flex items-center gap-1">
                    <CheckCircle size={14} />
                    Passwords match
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!isFormValid || loading || success}
                className="w-full mt-6 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition duration-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-400 rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Key size={18} />
                    Change Password
                  </>
                )}
              </button>

              {/* Info Section */}
              <div className="mt-6 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                <p className="text-xs text-slate-400">
                  Your password must be at least 8 characters long and contain uppercase letters, lowercase letters, and numbers.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
