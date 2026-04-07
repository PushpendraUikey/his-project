import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck,
  Users,
  Network,
  ClipboardList,
  Plus,
  Power,
  PowerOff,
  Key,
  RefreshCw,
  Search,
  Filter,
  Eye,
  AlertCircle,
  CheckCircle,
  Trash2,
} from 'lucide-react'
import { api, formatDateTime, ROLE_LABELS, ROLE_COLORS } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import {
  PageHeader,
  Spinner,
  ErrorBanner,
  Modal,
  EmptyState,
  StatCard,
} from '../components/ui'

// Tab component
function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="border-b border-slate-700 mb-6">
      <div className="flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              {tab.icon}
              <span>{tab.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Password strength indicator
function PasswordStrengthIndicator({ password }) {
  let strength = 0
  let label = 'Weak'
  let color = 'bg-red-500'

  if (password.length >= 8) strength++
  if (/[A-Z]/.test(password)) strength++
  if (/[a-z]/.test(password)) strength++
  if (/[0-9]/.test(password)) strength++
  if (/[^A-Za-z0-9]/.test(password)) strength++

  if (strength <= 2) {
    label = 'Weak'
    color = 'bg-red-500'
  } else if (strength === 3) {
    label = 'Fair'
    color = 'bg-yellow-500'
  } else if (strength === 4) {
    label = 'Good'
    color = 'bg-blue-500'
  } else {
    label = 'Strong'
    color = 'bg-green-500'
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all`}
            style={{ width: `${(strength / 5) * 100}%` }}
          />
        </div>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="text-xs text-slate-500">
        {password.length < 8 && '• Minimum 8 characters required'}
        {!/[A-Z]/.test(password) && ' • Add uppercase letter'}
        {!/[a-z]/.test(password) && ' • Add lowercase letter'}
        {!/[0-9]/.test(password) && ' • Add number'}
      </div>
    </div>
  )
}

// CREATE USER MODAL
function CreateUserModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    providerCode: '',
    fullName: '',
    role: '',
    specialty: '',
    licenseNumber: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const isPasswordValid =
    formData.password.length >= 8 &&
    /[A-Z]/.test(formData.password) &&
    /[a-z]/.test(formData.password) &&
    /[0-9]/.test(formData.password)

  const isFormValid =
    formData.providerCode &&
    formData.fullName &&
    formData.role &&
    formData.specialty &&
    formData.licenseNumber &&
    isPasswordValid

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid) return

    setLoading(true)
    setError('')
    try {
      await api.register({
        providerCode: formData.providerCode,
        fullName: formData.fullName,
        role: formData.role,
        specialty: formData.specialty,
        license_number: formData.licenseNumber,
        password: formData.password,
      })
      setFormData({
        providerCode: '',
        fullName: '',
        role: '',
        specialty: '',
        licenseNumber: '',
        password: '',
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Create New User"
      width="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} />}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Provider Code *
            </label>
            <input
              type="text"
              value={formData.providerCode}
              onChange={(e) =>
                setFormData({ ...formData, providerCode: e.target.value.toUpperCase() })
              }
              placeholder="e.g., DOC001"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="John Doe"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Role *
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
              required
            >
              <option value="">Select role</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="lab_technician">Lab Technician</option>
              <option value="admin">Admin</option>
              <option value="registration_desk">Registration Desk</option>
              <option value="admission_desk">Admission Desk</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Specialty *
            </label>
            <input
              type="text"
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
              placeholder="e.g., Cardiology"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              License Number *
            </label>
            <input
              type="text"
              value={formData.licenseNumber}
              onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
              placeholder="License #"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Initial Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Min 8 chars, 1 uppercase, 1 lowercase, 1 digit"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-300"
              >
                <Eye size={18} />
              </button>
            </div>
          </div>
        </div>

        {formData.password && <PasswordStrengthIndicator password={formData.password} />}

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-300 bg-slate-700 rounded hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isFormValid || loading}
            className="px-4 py-2 bg-cyan-500 text-slate-900 rounded font-medium hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <Spinner size={16} />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Plus size={18} />
                <span>Create User</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// RESET PASSWORD MODAL
function ResetPasswordModal({ isOpen, onClose, provider, onSuccess }) {
  const [tempPassword] = useState(
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 4).toUpperCase()
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleReset = async () => {
    setLoading(true)
    setError('')
    try {
      await api.resetPassword(provider.provider_id, { password: tempPassword })
      onSuccess()
      setTimeout(() => onClose(), 2000)
    } catch (err) {
      setError(err.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Reset Password"
      width="max-w-md"
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}

        <div className="bg-slate-700/50 border border-slate-600 rounded p-4 space-y-3">
          <p className="text-sm text-slate-300">
            Temporary password for <strong>{provider.full_name}</strong>:
          </p>
          <div className="flex items-center space-x-2">
            <code className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded font-mono text-cyan-400 text-sm">
              {tempPassword}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded transition-colors text-slate-300"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          The user must change this password on first login. Store it securely.
        </p>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-300 bg-slate-700 rounded hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="px-4 py-2 bg-cyan-500 text-slate-900 rounded font-medium hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <Spinner size={16} />
                <span>Resetting...</span>
              </>
            ) : (
              <>
                <Key size={18} />
                <span>Confirm Reset</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// DEACTIVATE CONFIRMATION MODAL
function DeactivateConfirmModal({ isOpen, onClose, provider, onConfirm, loading }) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Deactivate User"
      width="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex items-start space-x-3 bg-yellow-500/10 border border-yellow-500/30 rounded p-4">
          <AlertCircle className="text-yellow-500 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm text-slate-200">
              Are you sure you want to deactivate <strong>{provider.full_name}</strong>?
            </p>
            <p className="text-xs text-slate-400 mt-1">
              This user will not be able to log in until reactivated.
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-300 bg-slate-700 rounded hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Deactivating...' : 'Deactivate'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// USER MANAGEMENT TAB
function UserManagementTab() {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchProviders = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getProviders({
        role: roleFilter || undefined,
        is_active: statusFilter ? statusFilter === 'active' : undefined,
        q: debouncedSearch || undefined,
      })
      setProviders(data.providers || [])
    } catch (err) {
      setError(err.message || 'Failed to load providers')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, roleFilter, statusFilter])

  // Debounce search input (400ms) to avoid API call on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  const handleActivate = async (provider) => {
    setActionLoading(true)
    try {
      await api.activateProvider(provider.provider_id)
      fetchProviders()
    } catch (err) {
      setError(err.message || 'Failed to activate provider')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeactivateClick = (provider) => {
    setSelectedProvider(provider)
    setDeactivateModalOpen(true)
  }

  const handleDeactivateConfirm = async () => {
    if (!selectedProvider) return
    setActionLoading(true)
    try {
      await api.deactivateProvider(selectedProvider.id)
      fetchProviders()
      setDeactivateModalOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to deactivate provider')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResetPasswordClick = (provider) => {
    setSelectedProvider(provider)
    setResetModalOpen(true)
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-100">User Management</h2>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-cyan-500 text-slate-900 rounded font-medium hover:bg-cyan-400 transition-colors"
        >
          <Plus size={18} />
          <span>Create User</span>
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search by name, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
        >
          <option value="">All Roles</option>
          <option value="doctor">Doctor</option>
          <option value="nurse">Nurse</option>
          <option value="lab_technician">Lab Technician</option>
          <option value="admin">Admin</option>
          <option value="registration_desk">Registration Desk</option>
          <option value="admission_desk">Admission Desk</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {providers.length === 0 ? (
        <EmptyState message="No users found" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Provider Code
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Specialty
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.provider_id} className="border-b border-slate-700 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-slate-400">
                    {provider.provider_code}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-100">{provider.full_name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        ROLE_COLORS[provider.role] || 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {ROLE_LABELS[provider.role] || provider.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">{provider.specialty}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          provider.is_active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {provider.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2 flex">
                    {provider.is_active ? (
                      <button
                        onClick={() => handleDeactivateClick(provider)}
                        disabled={actionLoading}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                        title="Deactivate"
                      >
                        <PowerOff size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(provider)}
                        disabled={actionLoading}
                        className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors disabled:opacity-50"
                        title="Activate"
                      >
                        <Power size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => handleResetPasswordClick(provider)}
                      disabled={actionLoading}
                      className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors disabled:opacity-50"
                      title="Reset Password"
                    >
                      <Key size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={fetchProviders}
      />

      {selectedProvider && (
        <ResetPasswordModal
          isOpen={resetModalOpen}
          onClose={() => setResetModalOpen(false)}
          provider={selectedProvider}
          onSuccess={fetchProviders}
        />
      )}

      {selectedProvider && (
        <DeactivateConfirmModal
          isOpen={deactivateModalOpen}
          onClose={() => setDeactivateModalOpen(false)}
          provider={selectedProvider}
          onConfirm={handleDeactivateConfirm}
          loading={actionLoading}
        />
      )}
    </div>
  )
}

// HIE LOGS TAB
function HIELogsTab() {
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [directionFilter, setDirectionFilter] = useState('')

  const messageTypes = ['ADT_A01', 'ADT_A02', 'ADT_A03', 'ORU_R01', 'LIS_RESULT']

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [logsData, statsData] = await Promise.all([
        api.getAdminHIELogs({
          type: typeFilter || undefined,
          direction: directionFilter || undefined,
          limit: 100,
        }),
        api.getAdminHIEStats(),
      ])
      setLogs(logsData.logs || [])
      setStats(statsData || {})
    } catch (err) {
      setError(err.message || 'Failed to load HIE logs')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, directionFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">HIE Message Logs</h2>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {messageTypes.map((type) => (
          <StatCard
            key={type}
            label={type}
            value={stats[type] || 0}
            icon={<Network size={20} />}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
        >
          <option value="">All Message Types</option>
          {messageTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-cyan-400"
        >
          <option value="">All Directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
      </div>

      {logs.length === 0 ? (
        <EmptyState message="No HIE logs found" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Message ID
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Event
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Patient Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  MRN
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Direction
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Sent At
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.log_id} className="border-b border-slate-700 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-slate-400">
                    {log.message_id ? log.message_id.substring(0, 12) + '...' : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-blue-500/20 text-blue-400">
                      {log.message_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">{log.event_type || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-100">
                    {log.patient_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-400">
                    {log.mrn || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        log.direction === 'inbound'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}
                    >
                      {log.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        log.status === 'sent' || log.status === 'received'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {formatDateTime(log.sent_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// AUDIT TRAIL TAB
function AuditTrailTab() {
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const actionTypes = [
    'CREATE',
    'ACTIVATE',
    'DEACTIVATE',
    'RESET_PASSWORD',
    'CHANGE_PASSWORD',
    'UPDATE_ROLE',
  ]

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getProviderAuditLog({
        action: actionFilter || undefined,
        limit: 100,
      })
      setAuditLogs(data.auditLog || [])
    } catch (err) {
      setError(err.message || 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [actionFilter])

  useEffect(() => {
    fetchAuditLogs()
  }, [fetchAuditLogs])

  const getActionColor = (action) => {
    if (action === 'CREATE' || action === 'ACTIVATE') {
      return 'bg-green-500/20 text-green-400'
    }
    if (action === 'DEACTIVATE') {
      return 'bg-red-500/20 text-red-400'
    }
    if (action === 'PASSWORD_CHANGED' || action === 'CHANGE_PASSWORD' || action === 'RESET_PASSWORD') {
      return 'bg-blue-500/20 text-blue-400'
    }
    if (action === 'UPDATE_ROLE') {
      return 'bg-amber-500/20 text-amber-400'
    }
    return 'bg-slate-600/20 text-slate-300'
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Audit Trail</h2>

      {error && <ErrorBanner message={error} />}

      <select
        value={actionFilter}
        onChange={(e) => setActionFilter(e.target.value)}
        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-cyan-400 w-full md:w-64"
      >
        <option value="">All Actions</option>
        {actionTypes.map((action) => (
          <option key={action} value={action}>
            {action}
          </option>
        ))}
      </select>

      {auditLogs.length === 0 ? (
        <EmptyState message="No audit logs found" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Provider
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Performed By
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.audit_id} className="border-b border-slate-700 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-100">
                    {log.provider_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {log.performed_by_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400 truncate">
                    {log.details || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// MAIN ADMIN COMPONENT
export default function Admin() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('users')

  // Check admin permission
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState message="You do not have permission to access this page" />
      </div>
    )
  }

  const tabs = [
    {
      id: 'users',
      label: 'User Management',
      icon: <Users size={20} />,
    },
    {
      id: 'hie',
      label: 'HIE Logs',
      icon: <Network size={20} />,
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: <ClipboardList size={20} />,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Panel"
        subtitle="Manage users, HIE logs, and audit trails"
        icon={<ShieldCheck size={32} className="text-cyan-400" />}
      />

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="mt-6">
          {activeTab === 'users' && <UserManagementTab />}
          {activeTab === 'hie' && <HIELogsTab />}
          {activeTab === 'audit' && <AuditTrailTab />}
        </div>
      </div>
    </div>
  )
}
