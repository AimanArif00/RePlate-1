import { useCallback, useEffect, useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { ToastContainer, type ToastMessage } from './components/ui/Toast';
import { canAddToCart } from './lib/replateRules';
import { replateService, type MarketplacePayload } from './services/replateService';
import {
  AboutPage,
  BrowseFoodPage,
  FoodDetailPage,
  HowItWorksPage,
  LandingPage,
} from './pages/PublicPages';
import {
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
  StudentRegisterPage,
  VendorRegisterPage,
} from './pages/AuthPages';
import { StudentPages } from './pages/StudentPages';
import { VendorPages } from './pages/VendorPages';
import { AdminPages } from './pages/AdminPages';
import type { AuthSession, CartItem, EnrichedFoodListing, Profile } from './types/replate';

const EMPTY_MARKETPLACE: MarketplacePayload = {
  campuses: [],
  categories: [],
  vendors: [],
  listings: [],
  impact: {
    completedPickupsCount: 0,
    totalMealsRescued: 0,
    estimatedFoodSavedKg: 0,
    estimatedCo2AvoidedKg: 0,
    assumedKgPerMeal: 0.45,
    assumedCo2PerKg: 2.5,
  },
  settings: {
    estimated_kg_per_meal: 0.45,
    estimated_co2_per_kg: 2.5,
    platform_contact_email: 'support@replatecampus.edu.my',
    updated_at: new Date().toISOString(),
  },
};

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [user, setUser] = useState<Profile | null>(null);
  const [marketplace, setMarketplace] = useState<MarketplacePayload>(EMPTY_MARKETPLACE);
  const [loadingMarketplace, setLoadingMarketplace] = useState<boolean>(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-1), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const navigate = useCallback((path: string) => {
    const cleanPath = path.split('?')[0] || '/';
    if (window.location.pathname !== cleanPath) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(cleanPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const refreshMarketplace = useCallback(async () => {
    try {
      const data = await replateService.fetchMarketplace();
      setMarketplace(data);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to load marketplace data.');
    } finally {
      setLoadingMarketplace(false);
    }
  }, [notify]);

  useEffect(() => {
    refreshMarketplace();
  }, [refreshMarketplace]);

  const handleAuthSuccess = (session: AuthSession) => {
    setUser(session.user);
    notify('success', `Signed in as ${session.user.full_name}.`);
    if (session.user.role === 'admin') {
      navigate('/admin');
    } else if (session.user.role === 'vendor') {
      navigate('/vendor');
    } else {
      navigate(cart.length > 0 ? '/student/cart' : '/student');
    }
  };

  const handleLogout = async () => {
    await replateService.logout();
    setUser(null);
    setCart([]);
    notify('success', 'You have signed out.');
    navigate('/');
  };

  const handleAddToCart = (listing: EnrichedFoodListing, quantity = 1) => {
    if (user && user.role !== 'student') {
      notify('error', 'Switch to a student account to reserve meals.');
      return;
    }
    const existingQty = cart.find((c) => c.listingId === listing.id)?.quantity ?? 0;
    const check = canAddToCart(listing, existingQty, quantity);
    if (!check.ok) {
      notify('error', check.reason ?? 'Cannot add item to cart.');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.listingId === listing.id);
      if (existing) {
        return prev.map((c) =>
          c.listingId === listing.id ? { ...c, quantity: c.quantity + quantity } : c,
        );
      }
      return [...prev, { listingId: listing.id, quantity }];
    });
    notify('success', `Added ${quantity} × ${listing.food_name} to your cart.`);
  };

  const handleUpdateCartQty = (listingId: string, qty: number) => {
    const listing = marketplace.listings.find((l) => l.id === listingId);
    if (!listing) return;
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.listingId !== listingId));
      return;
    }
    if (qty > listing.quantity_available) {
      notify('error', `Only ${listing.quantity_available} portion(s) remaining.`);
      return;
    }
    setCart((prev) => prev.map((c) => (c.listingId === listingId ? { ...c, quantity: qty } : c)));
  };

  const handleRemoveCartItem = (listingId: string) => {
    setCart((prev) => prev.filter((c) => c.listingId !== listingId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Role-protected route rendering
  if (currentPath.startsWith('/student')) {
    if (!user) {
      return (
        <div className="flex min-h-screen flex-col bg-[#F8FAF7]">
          <Navbar currentPath={currentPath} user={user} cartCount={cartCount} onNavigate={navigate} />
          <main className="flex-1">
            <LoginPage onAuthSuccess={handleAuthSuccess} onNavigate={navigate} />
          </main>
          <Footer contactEmail={marketplace.settings.platform_contact_email} onNavigate={navigate} />
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
      );
    }
    if (user.role !== 'student') {
      const redirectTarget = user.role === 'admin' ? '/admin' : '/vendor';
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAF7] p-6 text-center">
          <h1 className="text-xl font-bold text-[#1F2937]">Student Access Required</h1>
          <p className="mt-2 text-sm text-gray-600">
            You are currently signed in with a {user.role} account.
          </p>
          <button
            type="button"
            onClick={() => navigate(redirectTarget)}
            className="mt-4 rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white"
          >
            Return to Your Dashboard
          </button>
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
      );
    }

    return (
      <>
        <StudentPages
          currentPath={currentPath}
          user={user}
          marketplace={marketplace}
          cart={cart}
          onNavigate={navigate}
          onLogout={handleLogout}
          onAddToCart={handleAddToCart}
          onUpdateCartQty={handleUpdateCartQty}
          onRemoveCartItem={handleRemoveCartItem}
          onClearCart={handleClearCart}
          onRefreshMarketplace={refreshMarketplace}
          onUserUpdated={setUser}
          notify={notify}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  if (currentPath.startsWith('/vendor')) {
    if (!user) {
      return (
        <div className="flex min-h-screen flex-col bg-[#F8FAF7]">
          <Navbar currentPath={currentPath} user={user} cartCount={cartCount} onNavigate={navigate} />
          <main className="flex-1">
            <LoginPage onAuthSuccess={handleAuthSuccess} onNavigate={navigate} />
          </main>
          <Footer contactEmail={marketplace.settings.platform_contact_email} onNavigate={navigate} />
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
      );
    }
    if (user.role !== 'vendor') {
      const redirectTarget = user.role === 'admin' ? '/admin' : '/student';
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAF7] p-6 text-center">
          <h1 className="text-xl font-bold text-[#1F2937]">Vendor Access Required</h1>
          <p className="mt-2 text-sm text-gray-600">
            Only registered cafeteria vendor accounts can open the Vendor Console.
          </p>
          <button
            type="button"
            onClick={() => navigate(redirectTarget)}
            className="mt-4 rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white"
          >
            Return to Your Dashboard
          </button>
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
      );
    }

    return (
      <>
        <VendorPages
          currentPath={currentPath}
          user={user}
          onNavigate={navigate}
          onLogout={handleLogout}
          onRefreshMarketplace={refreshMarketplace}
          notify={notify}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  if (currentPath.startsWith('/admin')) {
    if (!user) {
      return (
        <div className="flex min-h-screen flex-col bg-[#F8FAF7]">
          <Navbar currentPath={currentPath} user={user} cartCount={cartCount} onNavigate={navigate} />
          <main className="flex-1">
            <LoginPage onAuthSuccess={handleAuthSuccess} onNavigate={navigate} />
          </main>
          <Footer contactEmail={marketplace.settings.platform_contact_email} onNavigate={navigate} />
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
      );
    }
    if (user.role !== 'admin') {
      const redirectTarget = user.role === 'vendor' ? '/vendor' : '/student';
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAF7] p-6 text-center">
          <h1 className="text-xl font-bold text-[#1F2937]">Administrator Access Required</h1>
          <p className="mt-2 text-sm text-gray-600">
            This area is restricted to campus platform administrators.
          </p>
          <button
            type="button"
            onClick={() => navigate(redirectTarget)}
            className="mt-4 rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white"
          >
            Return to Your Dashboard
          </button>
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
      );
    }

    return (
      <>
        <AdminPages
          currentPath={currentPath}
          user={user}
          onNavigate={navigate}
          onLogout={handleLogout}
          onRefreshMarketplace={refreshMarketplace}
          notify={notify}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Public Pages
  const foodMatch = /^\/food\/([^/]+)$/.exec(currentPath);
  const resetParams = new URLSearchParams(window.location.search);
  const resetToken = resetParams.get('token') ?? '';

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAF7]">
      <Navbar currentPath={currentPath} user={user} cartCount={cartCount} onNavigate={navigate} />

      <main className="flex-1">
        {currentPath === '/' && (
          <LandingPage
            marketplace={marketplace}
            loading={loadingMarketplace}
            onNavigate={navigate}
            onAddToCart={handleAddToCart}
          />
        )}
        {currentPath === '/about' && (
          <AboutPage marketplace={marketplace} onNavigate={navigate} />
        )}
        {currentPath === '/how-it-works' && <HowItWorksPage onNavigate={navigate} />}
        {currentPath === '/browse' && (
          <BrowseFoodPage
            marketplace={marketplace}
            loading={loadingMarketplace}
            onNavigate={navigate}
            onAddToCart={handleAddToCart}
          />
        )}
        {foodMatch && (
          <FoodDetailPage
            listingId={foodMatch[1]}
            onNavigate={navigate}
            onAddToCart={handleAddToCart}
          />
        )}
        {currentPath === '/login' && (
          <LoginPage onAuthSuccess={handleAuthSuccess} onNavigate={navigate} />
        )}
        {currentPath === '/register/student' && (
          <StudentRegisterPage
            campuses={marketplace.campuses}
            onAuthSuccess={handleAuthSuccess}
            onNavigate={navigate}
          />
        )}
        {currentPath === '/register/vendor' && (
          <VendorRegisterPage
            campuses={marketplace.campuses}
            onAuthSuccess={handleAuthSuccess}
            onNavigate={navigate}
          />
        )}
        {currentPath === '/forgot-password' && <ForgotPasswordPage onNavigate={navigate} />}
        {currentPath === '/reset-password' && (
          <ResetPasswordPage initialToken={resetToken} onNavigate={navigate} />
        )}
        {currentPath !== '/' &&
          currentPath !== '/about' &&
          currentPath !== '/how-it-works' &&
          currentPath !== '/browse' &&
          !foodMatch &&
          currentPath !== '/login' &&
          currentPath !== '/register/student' &&
          currentPath !== '/register/vendor' &&
          currentPath !== '/forgot-password' &&
          currentPath !== '/reset-password' && (
            <LandingPage
              marketplace={marketplace}
              loading={loadingMarketplace}
              onNavigate={navigate}
              onAddToCart={handleAddToCart}
            />
          )}
      </main>

      <Footer contactEmail={marketplace.settings.platform_contact_email} onNavigate={navigate} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
