import { ReactNode, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/lib/permissions';
import {
  Shield, LayoutDashboard, Users, Swords, Award, BarChart3,
  Settings, LogOut, Menu, X, Crown, ChevronRight, ShieldAlert, Calculator,
} from 'lucide-react';

interface NavLink {
  to: string;
  label: string;
  icon: typeof Shield;
  permission?: string;
  show: boolean;
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const perms = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <>{children}</>;

  const onDivisionsTab = location.pathname.startsWith('/divisions');

  const navLinks: NavLink[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { to: '/profile', label: 'My Profile', icon: Shield, show: true },
    { to: '/members', label: 'Member Profiles', icon: Users, show: true },
    { to: '/divisions', label: 'Divisions', icon: Swords, show: true },
    { to: '/promotions', label: 'Promotions', icon: ChevronRight, permission: 'can_promote', show: onDivisionsTab && perms.can_promote },
    { to: '/division-ranks', label: 'Division Ranks', icon: Settings, permission: 'can_create_ranks', show: onDivisionsTab && perms.can_create_ranks },
    { to: '/damage-calculator', label: 'Damage Calculator', icon: Calculator, show: true },
    { to: '/points', label: 'Military Points', icon: Award, permission: 'can_award_points', show: perms.can_award_points },
    { to: '/hr-panel', label: 'HR Panel', icon: BarChart3, permission: 'can_view_hr_panel', show: perms.can_view_hr_panel },
    { to: '/admin', label: 'Admin Panel', icon: ShieldAlert, permission: 'is_owner', show: perms.is_owner },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const canAccessMajority = user.group_rank >= 2;

  return (
    <div className="min-h-screen flex bg-stone-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-stone-950 border-r border-stone-800 z-40 transition-transform duration-300 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-stone-800 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <div className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center ring-2 ring-amber-600/40 overflow-hidden flex-shrink-0">
              <img src="/favicon-192.png" alt="" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-amber-400 leading-tight font-display">Earth Kingdom</h2>
              <p className="text-[10px] text-stone-500 uppercase tracking-wider">Military Command</p>
            </div>
          </Link>
          <button className="md:hidden text-stone-400" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navLinks
            .filter((l) => l.show)
            .map((link) => (
              <NavItem key={link.to} {...link} onClick={() => setSidebarOpen(false)} />
            ))}
        </nav>

        {/* User info at bottom */}
        <div className="px-3 py-4 border-t border-stone-800">
          <div className="flex items-center gap-3 px-2 mb-3">
            {user.roblox_avatar_url ? (
              <img
                src={user.roblox_avatar_url}
                alt={user.roblox_display_name || undefined}
                className="w-10 h-10 rounded-full border border-stone-600"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center">
                <Users className="w-5 h-5 text-stone-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-stone-200 truncate">{user.roblox_display_name || user.roblox_username}</p>
              <p className="text-xs text-amber-500 truncate">{user.group_rank_name}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="ek-btn ek-btn-ghost w-full text-sm flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-stone-900/95 backdrop-blur-sm border-b border-stone-800 px-4 py-3 flex items-center justify-between">
          <button className="md:hidden text-stone-400" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>

          <div className="hidden md:block">
            <Link to="/divisions" className="text-xs text-stone-500 hover:text-amber-400 transition-colors">
              TSB Earth Group
            </Link>
          </div>

          {/* User profile summary */}
          <div className="flex items-center gap-3 ml-auto">
            {canAccessMajority ? (
              <span className="hidden sm:inline-flex ek-badge bg-green-900/50 text-green-400 border border-green-700/50">
                Private+ Access
              </span>
            ) : (
              <span className="hidden sm:inline-flex ek-badge bg-stone-700/50 text-stone-400 border border-stone-600/50">
                Limited Access
              </span>
            )}
            {user.is_owner && (
              <span className="ek-badge bg-amber-900/50 text-amber-400 border border-amber-700/50 flex items-center gap-1">
                <Crown className="w-3 h-3" /> Owner
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {!canAccessMajority && (
            <div className="bg-amber-900/20 border-b border-amber-800/30 px-4 py-2 text-center">
              <p className="text-sm text-amber-400">
                You need to be Private+ in the Roblox group to access most features.
              </p>
            </div>
          )}
          <div className="p-4 md:p-6 max-w-7xl mx-auto w-full animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}

function NavItem({
  to, label, icon: Icon, onClick,
}: NavLink & { onClick: () => void }) {
  const navigate = useNavigate();
  const location = useLocation().pathname;

  const isActive = location === to || (to !== '/dashboard' && location.startsWith(to));

  return (
    <button
      onClick={() => {
        navigate(to);
        onClick();
      }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-green-800/30 text-green-400 border-l-2 border-green-500'
          : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </button>
  );
}
