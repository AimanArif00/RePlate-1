import { useEffect, useState, type FormEvent } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  FolderTree,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Store,
  Trash2,
  Users,
  Utensils,
} from 'lucide-react';
import { RoleShell, type RoleNavItem } from '../components/layout/RoleShell';
import { OrderStatusBadge } from '../components/orders/OrderStatusBadge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDateTime, formatRM, getListingStatusLabel } from '../lib/replateRules';
import { replateService } from '../services/replateService';
import type {
  AccountStatus,
  ApprovalStatus,
  EnrichedFoodListing,
  EnrichedOrder,
  FoodCategory,
  ImpactSummary,
  Profile,
  SystemSettings,
  Vendor,
} from '../types/replate';

interface AdminPagesProps {
  currentPath: string;
  user: Profile;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onRefreshMarketplace: () => Promise<void>;
  notify: (type: 'success' | 'error', message: string) => void;
}

type AdminVendorRow = Vendor & {
  owner_name: string;
  owner_email: string;
  owner_status: AccountStatus;
};

export function AdminPages({
  currentPath,
  user,
  onNavigate,
  onLogout,
  onRefreshMarketplace,
  notify,
}: AdminPagesProps) {
  const [students, setStudents] = useState<Profile[]>([]);
  const [vendors, setVendors] = useState<AdminVendorRow[]>([]);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [listings, setListings] = useState<EnrichedFoodListing[]>([]);
  const [orders, setOrders] = useState<EnrichedOrder[]>([]);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalVendors: 0,
    pendingVendorApprovals: 0,
    totalListings: 0,
    activeListings: 0,
    totalOrders: 0,
    completedPickups: 0,
    totalMealsRescued: 0,
    estimatedFoodSavedKg: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const [kgPerMeal, setKgPerMeal] = useState('0.45');
  const [co2PerKg, setCo2PerKg] = useState('2.50');
  const [contactEmail, setContactEmail] = useState('support@replatecampus.edu.my');
  const [savingSettings, setSavingSettings] = useState(false);

  const [removeListingTarget, setRemoveListingTarget] = useState<EnrichedFoodListing | null>(null);
  const [removingListing, setRemovingListing] = useState(false);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const data = await replateService.fetchAdminDashboard();
      setStudents(data.students);
      setVendors(data.vendors);
      setCategories(data.categories);
      setListings(data.listings);
      setOrders(data.orders);
      setImpact(data.impact);
      setSettings(data.settings);
      setStats(data.stats);
      setKgPerMeal(String(data.settings.estimated_kg_per_meal));
      setCo2PerKg(String(data.settings.estimated_co2_per_kg));
      setContactEmail(data.settings.platform_contact_email);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to load admin dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const navItems: RoleNavItem[] = [
    { label: 'Admin Overview', path: '/admin', icon: <LayoutDashboard className="h-4 w-4" /> },
    {
      label: 'Vendor Approvals',
      path: '/admin/approvals',
      icon: <ShieldCheck className="h-4 w-4" />,
      badge: stats.pendingVendorApprovals,
    },
    { label: 'Students', path: '/admin/students', icon: <Users className="h-4 w-4" /> },
    { label: 'Vendors', path: '/admin/vendors', icon: <Store className="h-4 w-4" /> },
    { label: 'Food Listings', path: '/admin/listings', icon: <Utensils className="h-4 w-4" /> },
    { label: 'Categories', path: '/admin/categories', icon: <FolderTree className="h-4 w-4" /> },
    { label: 'Orders', path: '/admin/orders', icon: <ClipboardList className="h-4 w-4" /> },
    { label: 'Reports', path: '/admin/reports', icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Settings', path: '/admin/settings', icon: <Settings className="h-4 w-4" /> },
  ];

  const handleVendorApproval = async (vendorId: string, approval_status: ApprovalStatus) => {
    try {
      await replateService.setVendorApproval(vendorId, approval_status);
      await Promise.all([loadAdminData(), onRefreshMarketplace()]);
      notify('success', `Vendor marked as ${approval_status}.`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to update vendor approval.');
    }
  };

  const handleUserStatusToggle = async (targetUser: Profile) => {
    const nextStatus: AccountStatus =
      targetUser.account_status === 'suspended' ? 'active' : 'suspended';
    try {
      await replateService.setUserAccountStatus(targetUser.id, nextStatus);
      await loadAdminData();
      notify('success', `Account set to ${nextStatus}.`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to update user status.');
    }
  };

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      await replateService.createCategory(newCategoryName.trim(), newCategoryDesc.trim());
      setNewCategoryName('');
      setNewCategoryDesc('');
      await Promise.all([loadAdminData(), onRefreshMarketplace()]);
      notify('success', 'Food category created.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to create category.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleToggleCategory = async (cat: FoodCategory) => {
    try {
      await replateService.updateCategory(cat.id, { is_active: !cat.is_active });
      await Promise.all([loadAdminData(), onRefreshMarketplace()]);
      notify('success', `Category "${cat.category_name}" updated.`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to update category.');
    }
  };

  const handleConfirmRemoveListing = async () => {
    if (!removeListingTarget) return;
    setRemovingListing(true);
    try {
      await replateService.removeAdminListing(removeListingTarget.id);
      setRemoveListingTarget(null);
      await Promise.all([loadAdminData(), onRefreshMarketplace()]);
      notify('success', 'Listing removed from platform.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to remove listing.');
    } finally {
      setRemovingListing(false);
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await replateService.updateSystemSettings({
        estimated_kg_per_meal: Number(kgPerMeal),
        estimated_co2_per_kg: Number(co2PerKg),
        platform_contact_email: contactEmail.trim(),
      });
      await Promise.all([loadAdminData(), onRefreshMarketplace()]);
      notify('success', 'System impact settings updated.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDownloadCsvReport = () => {
    const headers = ['Order Number', 'Student', 'Vendor', 'Total RM', 'Status', 'Created At'];
    const rows = orders.map((o) => [
      o.order_number,
      `"${o.student_name.replace(/"/g, '""')}"`,
      `"${o.vendor_name.replace(/"/g, '""')}"`,
      o.total_amount.toFixed(2),
      o.order_status,
      o.created_at,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replate-campus-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingVendors = vendors.filter((v) => v.approval_status === 'pending');

  return (
    <RoleShell
      roleLabel="Administrator Console"
      breadcrumb="Admin / Platform Governance"
      user={user}
      currentPath={currentPath}
      navItems={navItems}
      onNavigate={onNavigate}
      onLogout={onLogout}
    >
      {/* 1. ADMIN DASHBOARD */}
      {currentPath === '/admin' && (
        <div className="space-y-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold text-[#1F2937]">Platform Administration</h1>
              <p className="mt-1 text-sm text-[#4B5563]">
                Live oversight across registered students, campus vendors, listings, and rescued
                meals.
              </p>
            </div>
            {stats.pendingVendorApprovals > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('/admin/approvals')}
                className="rounded-lg bg-[#FACC15] px-4 py-2 text-sm font-bold text-[#1F2937] hover:bg-[#eab308] whitespace-nowrap self-start"
              >
                Review {stats.pendingVendorApprovals} Pending Vendor
                {stats.pendingVendorApprovals > 1 ? 's' : ''}
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs text-gray-500">Registered Students</p>
              <p className="mt-1 text-2xl font-bold text-[#1F2937] tabular-nums">
                {stats.totalStudents}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs text-gray-500">Campus Vendors</p>
              <p className="mt-1 text-2xl font-bold text-[#1F2937] tabular-nums">
                {stats.totalVendors}{' '}
                <span className="text-xs font-medium text-amber-700">
                  ({stats.pendingVendorApprovals} pending)
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs text-gray-500">Meals Rescued (Completed)</p>
              <p className="mt-1 text-2xl font-bold text-[#166534] tabular-nums">
                {stats.totalMealsRescued}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs text-gray-500">Est. Waste Reduction</p>
              <p className="mt-1 text-2xl font-bold text-[#166534] tabular-nums">
                {stats.estimatedFoodSavedKg.toFixed(2)} kg
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-6 lg:col-span-7">
              <h2 className="text-base font-bold text-[#1F2937]">Recent Campus Orders</h2>
              {loading ? (
                <div className="mt-4 h-40 animate-pulse rounded bg-[#F8FAF7]" />
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#E5EBE3] text-gray-500">
                      <tr>
                        <th className="py-2 pr-3">Order #</th>
                        <th className="py-2 pr-3">Student</th>
                        <th className="py-2 pr-3">Vendor</th>
                        <th className="py-2 pr-3 text-right">Amount</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F4EE]">
                      {orders.slice(0, 6).map((o) => (
                        <tr key={o.id}>
                          <td className="py-2.5 pr-3 font-mono font-semibold whitespace-nowrap">{o.order_number}</td>
                          <td className="py-2.5 pr-3">{o.student_name}</td>
                          <td className="py-2.5 pr-3">{o.vendor_name}</td>
                          <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                            {formatRM(o.total_amount)}
                          </td>
                          <td className="py-2.5">
                            <OrderStatusBadge status={o.order_status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#E5EBE3] bg-white p-6 lg:col-span-5">
              <h2 className="text-base font-bold text-[#1F2937]">Listings by Category</h2>
              <div className="mt-4 space-y-3">
                {categories.map((cat) => {
                  const count = listings.filter((l) => l.category_id === cat.id).length;
                  const pct = listings.length > 0 ? Math.round((count / listings.length) * 100) : 0;
                  return (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium text-gray-700 tabular-nums">
                        <span>{cat.category_name}</span>
                        <span>{count}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#EEF3EC]">
                        <div
                          className="h-full rounded-full bg-[#166534]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. VENDOR APPROVALS */}
      {currentPath === '/admin/approvals' && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-[#1F2937]">Vendor Registration Approvals</h1>
          {pendingVendors.length === 0 ? (
            <EmptyState
              title="No pending vendor approvals"
              description="All cafeteria registration applications have been reviewed."
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
          ) : (
            <div className="space-y-4">
              {pendingVendors.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-[#E5EBE3] bg-white p-5 sm:flex-row sm:items-center"
                >
                  <div>
                    <h2 className="text-base font-bold text-[#1F2937]">{v.business_name}</h2>
                    <p className="mt-0.5 text-sm text-gray-600">
                      Owner: {v.owner_name} ({v.owner_email}) · {v.contact_phone}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Location: {v.location}</p>
                    {v.description && (
                      <p className="mt-2 text-sm text-[#4B5563]">{v.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleVendorApproval(v.id, 'approved')}
                      className="rounded-lg bg-[#166534] px-4 py-2 text-xs font-semibold text-white hover:bg-[#14532D]"
                    >
                      Approve Vendor
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVendorApproval(v.id, 'rejected')}
                      className="rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. STUDENT MANAGEMENT */}
      {currentPath === '/admin/students' && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-[#1F2937]">Student Management</h1>
          <div className="overflow-x-auto rounded-xl border border-[#E5EBE3] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5EBE3] bg-[#F8FAF7] text-xs font-semibold text-gray-600">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Student ID</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4EE]">
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-[#1F2937]">{s.full_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.student_id || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{s.email}</td>
                    <td className="px-4 py-3 text-gray-600">{s.phone_number}</td>
                    <td className="px-4 py-3 capitalize font-medium text-xs">
                      {s.account_status}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleUserStatusToggle(s)}
                        className={`rounded px-3 py-1 text-xs font-semibold ${
                          s.account_status === 'suspended'
                            ? 'bg-[#166534] text-white'
                            : 'border border-red-300 text-red-700 hover:bg-red-50'
                        }`}
                      >
                        {s.account_status === 'suspended' ? 'Activate' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. VENDOR MANAGEMENT */}
      {currentPath === '/admin/vendors' && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-[#1F2937]">Vendor Management</h1>
          <div className="overflow-x-auto rounded-xl border border-[#E5EBE3] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5EBE3] bg-[#F8FAF7] text-xs font-semibold text-gray-600">
                <tr>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4EE]">
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3 font-semibold text-[#1F2937]">{v.business_name}</td>
                    <td className="px-4 py-3">
                      <p>{v.owner_name}</p>
                      <p className="text-xs text-gray-500">{v.owner_email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{v.location}</td>
                    <td className="px-4 py-3 capitalize text-xs font-semibold">
                      {v.approval_status}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        {v.approval_status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleVendorApproval(v.id, 'approved')}
                            className="rounded bg-[#166534] px-2.5 py-1 text-xs font-semibold text-white"
                          >
                            Approve
                          </button>
                        )}
                        {v.approval_status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleVendorApproval(v.id, 'rejected')}
                            className="rounded border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700"
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. ALL FOOD LISTINGS */}
      {currentPath === '/admin/listings' && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-[#1F2937]">All Food Listings</h1>
          <div className="overflow-x-auto rounded-xl border border-[#E5EBE3] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5EBE3] bg-[#F8FAF7] text-xs font-semibold text-gray-600">
                <tr>
                  <th className="px-4 py-3">Food</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3 text-right">Discounted</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4EE]">
                {listings.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-medium text-[#1F2937]">{l.food_name}</td>
                    <td className="px-4 py-3 text-gray-600">{l.vendor_name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#166534] tabular-nums">
                      {formatRM(l.discounted_price)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.quantity_available}</td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {getListingStatusLabel(l.effective_status)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        aria-label={`Remove ${l.food_name}`}
                        onClick={() => setRemoveListingTarget(l)}
                        className="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. CATEGORY MANAGEMENT */}
      {currentPath === '/admin/categories' && (
        <div className="space-y-6 max-w-3xl">
          <h1 className="text-2xl font-bold text-[#1F2937]">Food Category Management</h1>

          <form
            onSubmit={handleAddCategory}
            className="grid gap-3 rounded-xl border border-[#E5EBE3] bg-white p-5 sm:grid-cols-12"
          >
            <input
              type="text"
              required
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-4"
            />
            <input
              type="text"
              value={newCategoryDesc}
              onChange={(e) => setNewCategoryDesc(e.target.value)}
              placeholder="Short description"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-5"
            />
            <button
              type="submit"
              disabled={savingCategory}
              className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] sm:col-span-3"
            >
              {savingCategory ? 'Adding...' : 'Add Category'}
            </button>
          </form>

          <div className="overflow-x-auto rounded-xl border border-[#E5EBE3] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5EBE3] bg-[#F8FAF7] text-xs font-semibold text-gray-600">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4EE]">
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-semibold text-[#1F2937]">{c.category_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.description}</td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {c.is_active ? 'Active' : 'Inactive'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(c)}
                        className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        {c.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. ORDER MANAGEMENT */}
      {currentPath === '/admin/orders' && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-[#1F2937]">Platform Order Monitor</h1>
          <div className="overflow-x-auto rounded-xl border border-[#E5EBE3] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5EBE3] bg-[#F8FAF7] text-xs font-semibold text-gray-600">
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Placed</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4EE]">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">{o.order_number}</td>
                    <td className="px-4 py-3">{o.student_name}</td>
                    <td className="px-4 py-3">{o.vendor_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(o.created_at)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatRM(o.total_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={o.order_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. REPORTS & ANALYTICS */}
      {currentPath === '/admin/reports' && (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <h1 className="text-2xl font-bold text-[#1F2937]">Reports & Environmental Analytics</h1>
            <button
              type="button"
              onClick={handleDownloadCsvReport}
              className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] self-start"
            >
              <Download className="h-4 w-4" />
              Export Orders CSV
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs text-gray-500">Completed Pickups</p>
              <p className="mt-1 text-2xl font-bold text-[#1F2937] tabular-nums">
                {stats.completedPickups}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs text-gray-500">Total Meals Rescued</p>
              <p className="mt-1 text-2xl font-bold text-[#166534] tabular-nums">
                {stats.totalMealsRescued}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs text-gray-500">Est. Food Saved</p>
              <p className="mt-1 text-2xl font-bold text-[#1F2937] tabular-nums">
                {(impact?.estimatedFoodSavedKg ?? 0).toFixed(2)} kg
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs text-gray-500">Est. CO₂e Avoided</p>
              <p className="mt-1 text-2xl font-bold text-[#1F2937] tabular-nums">
                {(impact?.estimatedCo2AvoidedKg ?? 0).toFixed(2)} kg
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Estimates use configurable assumptions ({settings?.estimated_kg_per_meal ?? 0.45} kg/meal
            and {settings?.estimated_co2_per_kg ?? 2.5} kg CO₂e/kg) and count only completed
            pickups. Total collected sales across campus: {formatRM(stats.totalRevenue)}.
          </p>
        </div>
      )}

      {/* 9. SYSTEM SETTINGS */}
      {currentPath === '/admin/settings' && (
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-bold text-[#1F2937]">System Settings</h1>
          <form
            onSubmit={handleSaveSettings}
            className="space-y-4 rounded-xl border border-[#E5EBE3] bg-white p-6"
          >
            <h2 className="text-base font-bold text-[#1F2937]">
              Environmental Estimate Assumptions
            </h2>
            <p className="text-xs text-gray-500">
              Configure the assumed average meal weight and CO₂ conversion factor used for campus
              sustainability estimates.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="set-kg" className="block text-sm font-medium text-[#1F2937]">
                  Assumed Weight per Meal (kg)
                </label>
                <input
                  id="set-kg"
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="5"
                  required
                  value={kgPerMeal}
                  onChange={(e) => setKgPerMeal(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="set-co2" className="block text-sm font-medium text-[#1F2937]">
                  CO₂e Factor (kg CO₂e / kg food)
                </label>
                <input
                  id="set-co2"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="20"
                  required
                  value={co2PerKg}
                  onChange={(e) => setCo2PerKg(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums"
                />
              </div>
            </div>

            <div>
              <label htmlFor="set-email" className="block text-sm font-medium text-[#1F2937]">
                Platform Support Email
              </label>
              <input
                id="set-email"
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(removeListingTarget)}
        title="Remove listing from platform?"
        description={
          removeListingTarget
            ? `Remove "${removeListingTarget.food_name}" by ${removeListingTarget.vendor_name}?`
            : ''
        }
        confirmLabel="Remove Listing"
        confirmTone="danger"
        loading={removingListing}
        onConfirm={handleConfirmRemoveListing}
        onCancel={() => setRemoveListingTarget(null)}
      />
    </RoleShell>
  );
}
