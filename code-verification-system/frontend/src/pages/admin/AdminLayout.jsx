import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo.jsx';
import { useAuth } from '../../components/AuthContext.jsx';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/codes', label: 'Codes' },
  { to: '/admin/generate', label: 'Generate' },
  { to: '/admin/batches', label: 'Batches' },
  { to: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout() {
  const { admin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />
        <nav aria-label="Admin">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {n.label}
            </NavLink>
          ))}
          <button className="nav-link nav-button" onClick={async () => { await signOut(); navigate('/admin/login'); }}>
            Logout
          </button>
        </nav>
        <div className="sidebar-foot" title={admin?.email}>{admin?.email}</div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}
