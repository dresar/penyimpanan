
# CloudOrchestrator - Full Build Plan

## Overview
A personal multi-provider storage manager with the "Aurora Glass" design theme, featuring glassmorphism UI, multi-account ImageKit integration, and comprehensive file management across 10 pages.

---

## Phase 1: Foundation & Design System

### Aurora Glass Theme Setup
- Configure Tailwind with custom color palette (deep blues, purples, teals for aurora gradients)
- Create glassmorphism utility classes (backdrop-blur, semi-transparent backgrounds)
- Implement dark/light mode toggle with full theme support
- Build reusable gradient background components for the aurora effect

### Core Layout Components
- **Responsive Sidebar**: Collapsible navigation with hamburger drawer on mobile, smooth animations
- **Main Layout Shell**: Glass-effect content areas with proper spacing
- **Mobile-first Grid System**: Responsive container components

---

## Phase 2: Authentication & User Management

### Login/Signup Pages
- Centered glass card design on aurora gradient background
- Email/password authentication via Supabase Auth
- "Login as Demo User" button for instant pre-seeded account access
- Password reset flow

### Demo Account System
- Pre-seeded Supabase user with sample data
- Demo storage accounts, sample files, and activity history
- One-click access for showcasing the platform

---

## Phase 3: Database Architecture (Supabase)

### Tables & Schema
1. **profiles** - user_id, full_name, avatar_url, created_at
2. **storage_credentials** - id, user_id, name, public_key, private_key_encrypted, url_endpoint, is_active, created_at
3. **files** - id, user_id, name, url, file_type, size, storage_account_id (FK), tags, created_at
4. **categories** - id, user_id, name, color, icon
5. **file_categories** - file_id, category_id (junction table)
6. **activity_logs** - id, user_id, action_type, details, created_at
7. **user_roles** - id, user_id, role (for future admin features)

### Security
- Row Level Security (RLS) on all tables
- Encrypted private key storage pattern
- Edge function for secure key decryption

---

## Phase 4: All 10 Application Pages

### 1. Dashboard
- Stats cards: Total Storage Used, Total Files, Active Accounts
- Recent uploads widget
- Storage usage chart per account
- Quick action buttons

### 2. File Manager
- Gallery/Grid view with thumbnails
- Table view option (transforms to cards on mobile)
- Search, filter by type/account/category
- Bulk selection and actions
- File preview modal

### 3. Upload Center
- Account selection dropdown
- Drag-and-drop upload zone with glass styling
- Upload progress indicators
- Batch upload support
- Auto-categorization options

### 4. Storage Accounts
- CRUD interface for ImageKit accounts
- Account status indicators (active/inactive)
- Test connection button
- Usage statistics per account

### 5. Categories/Tags
- Create, edit, delete categories
- Color and icon picker
- Drag-to-reorder functionality
- File count per category

### 6. API Configuration
- Global app settings
- Default upload preferences
- Webhook configuration (future)
- Rate limiting settings

### 7. Profile
- User avatar upload
- Display name editing
- Email display
- Account creation date

### 8. Security
- Change password form
- 2FA toggle (UI ready, can implement later)
- Active sessions display
- Security recommendations

### 9. Activity Logs
- Chronological list of all actions
- Filter by action type (upload, delete, account changes)
- Date range picker
- Export functionality

### 10. Help & Docs
- Getting started guide
- FAQ accordion
- API documentation links
- Contact/support section

---

## Phase 5: ImageKit Integration Architecture

### Secure Key Management
- Private keys encrypted before database storage
- Supabase Edge Function for decryption and signature generation
- Keys never exposed to frontend

### Dynamic Upload Flow
1. User selects storage account from dropdown
2. Frontend requests auth token from Edge Function with account ID
3. Edge Function decrypts private key, generates ImageKit signature
4. IKContext configured dynamically with selected account credentials
5. Upload proceeds with proper authentication
6. Success callback saves file metadata to Supabase

### Edge Function: `/api/auth/imagekit`
- Accepts accountId parameter
- Fetches and decrypts credentials from storage_credentials table
- Returns signature, token, and expire timestamp

---

## Phase 6: Mobile Responsiveness

### Breakpoint Strategy
- **Mobile (< 768px)**: Sidebar becomes drawer, cards stack vertically
- **Tablet (768px - 1024px)**: Sidebar collapsible, 2-column grids
- **Desktop (> 1024px)**: Full sidebar, multi-column layouts

### Table-to-Card Transformation
- Data tables automatically switch to card layout on mobile
- Touch-friendly action buttons
- Swipe gestures for common actions

---

## Key Design Elements

### Glassmorphism Components
- Semi-transparent backgrounds (bg-white/10 dark:bg-black/20)
- Backdrop blur (backdrop-blur-xl)
- Subtle borders (border-white/20)
- Soft shadows with color tinting

### Aurora Background
- Animated gradient orbs
- Subtle movement on dark mode
- Performance-optimized with CSS animations

### Animations (Framer Motion patterns via Tailwind)
- Staggered list animations
- Smooth page transitions
- Micro-interactions on buttons and cards

---

## Technical Notes

- **Stack Adaptation**: Using React + Vite + React Router (Lovable's stack) instead of Next.js
- **Backend Logic**: Supabase Edge Functions replace Next.js API routes
- **ImageKit SDK**: Will be integrated once you're ready with real credentials
- **Initial Build**: Complete UI/UX with mock/demo data architecture, ready for real ImageKit integration when needed

