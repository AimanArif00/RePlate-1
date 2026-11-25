import { useState } from 'react';
import { Menu, ShoppingBag, X } from 'lucide-react';
import type { Profile } from '../../types/replate';

interface NavbarProps {
  currentPath: string;
  user: Profile | null;
  cartCount: number;
  onNavigate: (path: string) => void;
}

export function Navbar({ currentPath, user, cartCount, onNavigate }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardPath =
    user?.role === 'admin'
      ? '/admin'
      : user?.role === 'vendor'
        ? '/vendor'
        : '/student';

  const navLinkClass = (path: string) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
      currentPath === path
        ? 'border-[#166534] text-[#166534]'
        : 'border-transparent text-[#4B5563] hover:text-[#1F2937] hover:border-gray-300'
    }`;

  const handleNav = (path: string) => {
    setMobileOpen(false);
    onNavigate(path);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#E5EBE3] bg-[#F8FAF7]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleNav('/');
          }}
          className="font-[var(--font-display)] text-lg font-bold tracking-tight text-[#166534] whitespace-nowrap shrink-0"
        >
          RePlate Campus
        </a>

        {/* Zone 2: 4 Concise Single-Line Navigation Links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
          <a
            href="/browse"
            onClick={(e) => {
              e.preventDefault();
              handleNav('/browse');
            }}
            className={navLinkClass('/browse')}
          >
            Browse Food
          </a>
          <a
            href="/how-it-works"
            onClick={(e) => {
              e.preventDefault();
              handleNav('/how-it-works');
            }}
            className={navLinkClass('/how-it-works')}
          >
            How It Works
          </a>
          <a
            href="/about"
            onClick={(e) => {
              e.preventDefault();
              handleNav('/about');
            }}
            className={navLinkClass('/about')}
          >
            About
          </a>
          {user ? (
            <a
              href={dashboardPath}
              onClick={(e) => {
                e.preventDefault();
                handleNav(dashboardPath);
              }}
              className={navLinkClass(dashboardPath)}
            >
              Dashboard
            </a>
          ) : (
            <a
              href="/register/vendor"
              onClick={(e) => {
                e.preventDefault();
                handleNav('/register/vendor');
              }}
              className={navLinkClass('/register/vendor')}
            >
              For Vendors
            </a>
          )}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="hidden md:flex items-center shrink-0">
          {user?.role === 'student' || cartCount > 0 ? (
            <button
              type="button"
              onClick={() => handleNav('/student/cart')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              <ShoppingBag className="h-4 w-4" />
              Cart ({cartCount})
            </button>
          ) : user ? (
            <button
              type="button"
              onClick={() => handleNav(dashboardPath)}
              className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] transition-colors whitespace-nowrap shrink-0"
            >
              Open Console
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleNav('/login')}
              className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Mobile Menu Trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          className="inline-flex md:hidden items-center justify-center rounded-lg border border-[#E5EBE3] bg-white p-2 text-[#1F2937]"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#E5EBE3] bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <a
              href="/browse"
              onClick={(e) => {
                e.preventDefault();
                handleNav('/browse');
              }}
              className="py-1.5 text-sm font-medium text-[#1F2937]"
            >
              Browse Food
            </a>
            <a
              href="/how-it-works"
              onClick={(e) => {
                e.preventDefault();
                handleNav('/how-it-works');
              }}
              className="py-1.5 text-sm font-medium text-[#1F2937]"
            >
              How It Works
            </a>
            <a
              href="/about"
              onClick={(e) => {
                e.preventDefault();
                handleNav('/about');
              }}
              className="py-1.5 text-sm font-medium text-[#1F2937]"
            >
              About
            </a>
            {user ? (
              <a
                href={dashboardPath}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(dashboardPath);
                }}
                className="py-1.5 text-sm font-semibold text-[#166534]"
              >
                Dashboard
              </a>
            ) : (
              <>
                <a
                  href="/register/student"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNav('/register/student');
                  }}
                  className="py-1.5 text-sm font-medium text-[#1F2937]"
                >
                  Student Registration
                </a>
                <a
                  href="/register/vendor"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNav('/register/vendor');
                  }}
                  className="py-1.5 text-sm font-medium text-[#1F2937]"
                >
                  Vendor Registration
                </a>
              </>
            )}
            <button
              type="button"
              onClick={() =>
                handleNav(user?.role === 'student' || cartCount > 0 ? '/student/cart' : user ? dashboardPath : '/login')
              }
              className="mt-1 rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white"
            >
              {user?.role === 'student' || cartCount > 0
                ? `View Cart (${cartCount})`
                : user
                  ? 'Open Dashboard'
                  : 'Sign In'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
