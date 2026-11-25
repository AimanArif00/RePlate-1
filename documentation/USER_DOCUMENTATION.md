# RePlate Campus — User Documentation

This guide explains how Students, Vendors, and Administrators use **RePlate Campus**.

---

## 1. Student Guide

### Registration & Login
1. Click **Sign In** in the top navigation bar, then choose **Create student account** (or navigate to `/register/student`).
2. Enter your Full Name, Student ID, University Email, Phone Number, Campus, and Password (8+ characters).
3. After signing in, you are redirected to the **Student Dashboard** (`/student`).

### Browsing & Filtering Surplus Food
1. Open **Browse Food** (`/browse`) to view active discounted meals.
2. Search by food name or vendor, filter by category, vendor, or maximum RM price, sort by lowest price or highest discount, and toggle **Show only available food**.
3. Click **View Details** on any meal card to view full descriptions, pickup windows, remaining stock, and student reviews.

### Ordering & Checkout (Pay at Pickup)
1. Click **Add to Cart** on available items (quantity cannot exceed remaining vendor stock).
2. Open **Cart** (`/student/cart`), adjust quantities if needed, and click **Proceed to Checkout**.
3. Review your order summary and click **Confirm Pay-at-Pickup Order**.
4. Your stock is reserved atomically and you receive a unique Order Number, 6-character **Pickup Code**, and **QR Code**.

### Tracking, Collecting & Reviewing Orders
1. Visit **My Orders** (`/student/orders`) to track order progress (`Pending` -> `Confirmed` -> `Ready for Pickup` -> `Picked Up`).
2. You may cancel an order while it is `Pending` or `Confirmed`; cancelled quantities return to marketplace stock.
3. Visit the cafeteria counter during the pickup window, pay at the counter, and present your pickup code or QR pass.
4. Once marked `Picked Up`, you can leave a 1–5 star review on the order details page.

---

## 2. Vendor Guide

### Vendor Registration & Approval
1. Navigate to **For Vendors** (`/register/vendor`) and submit your business name, owner name, university email, phone, campus, and cafeteria location.
2. New vendor accounts start with `pending` approval status. An Administrator must approve your registration before you can publish food listings.

### Publishing & Managing Food Listings
1. From the **Vendor Dashboard** (`/vendor`), open **Food Listings** (`/vendor/listings`) and click **Add Food Listing**.
2. Enter the food name, category, description (optionally click **Suggest details with Gemini** when `GEMINI_API_KEY` is configured), original RM price, discounted RM price, quantity, pickup start/end times, and upload a JPEG/PNG/WebP photo.
3. Discount percentages are calculated automatically. Listings automatically become `Sold Out` at 0 stock or `Expired` after the pickup deadline.

### Order Fulfillment & Pickup Verification
1. Open **Incoming Orders** (`/vendor/orders`) to review student reservations.
2. Click **Accept** (`Confirmed`), then **Ready** (`Ready for Pickup`) once packed.
3. At counter handoff, open **Pickup Verify** (`/vendor/verify`), enter the student's 6-character code or scan/paste the QR payload, verify the displayed student & item details, and click **Confirm Food Collection**.
4. Verified orders become `Picked Up` and cannot be collected a second time.

---

## 3. Administrator Guide

1. Sign in with an administrator account to access `/admin` (admin accounts cannot be created via public registration).
2. **Vendor Approvals (`/admin/approvals`):** Approve or reject pending cafeteria vendor applications.
3. **Students & Vendors (`/admin/students`, `/admin/vendors`):** View registered accounts and suspend or activate accounts when needed.
4. **Categories & Listings (`/admin/categories`, `/admin/listings`):** Create or toggle food categories and remove inappropriate or expired listings.
5. **Orders & Reports (`/admin/orders`, `/admin/reports`):** Monitor platform-wide order statuses, view completed pickup metrics, and export CSV reports.
6. **System Settings (`/admin/settings`):** Configure the assumed meal weight (kg/meal) and CO₂e conversion factor used to compute environmental estimates.
