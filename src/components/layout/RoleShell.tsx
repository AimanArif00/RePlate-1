import { useState, type ReactNode } from 'react';
import { LogOut, Menu, ShoppingBag, X } from 'lucide-react';
import type { Profile } from '../../types/replate';

export interface RoleNavItem {
  label: string;
  path: string;
  icon: ReactNode;
  badge?: number;
}

interface RoleShellProps {
  roleLabel: string;
  breadcrumb: string;
  user: Profile;
  currentPath: string;
  navItems: RoleNavItem[];
  cartCount?: number;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function RoleShell({
  roleLabel,
  breadcrumb,
  user,
  currentPath,
  navItems,
  cartCount,
  onNavigate,
  onLogout,
  children,
}: RoleShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNav = (path: string) => {
    setSidebarOpen(false);
    onNavigate(path);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white">
      <div>
        <div className="border-b border-[#E5EBE3] px-5 py-4">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleNav('/');
            }}
            className="font-[var(--font-display)] text-lg font-bold text-[#166534] whitespace-nowrap"
          >
            RePlate Campus
          </a>
          <p className="mt-0.5 text-xs font-medium text-gray-500">{roleLabel}</p>
        </div>

        <nav aria-label={`${roleLabel} navigation`} className="space-y-1 p-3">
          {navItems.map((item) => {
            const active =
              currentPath === item.path ||
              (item.path !== '/student' &&
                item.path !== '/vendor' &&
                item.path !== '/admin' &&
                currentPath.startsWith(item.path));
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#166534] text-white'
                    : 'text-[#4B5563] hover:bg-[#F2F6F0] hover:text-[#1F2937]'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-[#FACC15]/40 text-[#1F2937]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-[#E5EBE3] p-4">
        <div className="mb-3">
          <p className="truncate text-sm font-semibold text-[#1F2937]">{user.full_name}</p>
          <p className="truncate text-xs text-gray-500">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAF7]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[#E5EBE3] bg-white lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 border-r border-[#E5EBE3] bg-white shadow-xl">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sidebar"
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </div>
          <button
            type="button"
            aria-label="Close sidebar overlay"
            onClick={() => setSidebarOpen(false)}
            className="flex-1 bg-black/40"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#E5EBE3] bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation sidebar"
              className="rounded-lg border border-[#E5EBE3] p-2 text-gray-700 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="truncate text-sm font-semibold text-[#1F2937]">{breadcrumb}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {user.role === 'student' && typeof cartCount === 'number' && (
              <button
                type="button"
                onClick={() => handleNav('/student/cart')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#14532D] transition-colors whitespace-nowrap shrink-0 tabular-nums"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                Cart ({cartCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => handleNav('/browse')}
              className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap shrink-0"
            >
              Marketplace
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
