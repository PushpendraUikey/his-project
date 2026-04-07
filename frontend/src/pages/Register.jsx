// Legacy file — user registration is now handled by the Admin module.
// This file is kept for backward compatibility but not used.
import { Navigate } from 'react-router-dom';
export default function Register() {
  return <Navigate to="/login" replace />;
}
