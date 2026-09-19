// src/lib/types.ts
import { ObjectId } from 'mongodb';

export interface Tenant {
  _id?: ObjectId;
  slug: string;
  name: string;
  branding: {
    logoUrl?: string;
    primaryColor: string;
    secondaryColor?: string;
    font?: 'display' | 'classic' | 'modern';
  };
  contactEmail: string;
  status: 'active' | 'suspended';
  createdAt: Date;
}

export interface User {
  _id?: ObjectId;
  tenantId?: ObjectId; // absent for super_admin — every other role requires it
  username: string;
  email: string;
  passwordHash: string;
  role: 'super_admin' | 'admin' | 'receptionist' | 'barber';
  barberId?: ObjectId;
  createdAt: Date;
}

export interface Barber {
  _id?: ObjectId;
  tenantId: ObjectId;
  name: string;
  slug: string;
  imageUrl?: string;
  bio?: string;
  portfolio?: string[]; // gallery image URLs
  tags?: string[]; // specialties, e.g. "Fades", "Beard sculpting"
  dailyAvailability: DailyAvailability[];
}

export interface DailyAvailability {
  dayOfWeek: number; // 0-6, Sunday-Saturday
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export interface Service {
  _id?: ObjectId;
  tenantId: ObjectId;
  categoryId?: ObjectId;
  name: string;
  duration: number; // minutes
  price: number;
  description?: string;
  imageUrl?: string;
}

export interface Category {
  _id?: ObjectId;
  tenantId: ObjectId;
  name: string;
  imageUrl?: string;
}

export interface Customer {
  _id?: ObjectId;
  name: string;
  email: string;
  phone: string;
  passwordHash?: string;
  loyaltyPoints: {
    [tenantId: string]: number;
  };
  createdAt: Date;
}

export interface Appointment {
  _id?: ObjectId;
  tenantId: ObjectId;
  customerId: ObjectId;
  barberId: ObjectId;
  serviceId: ObjectId;
  dateTime: Date;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'waitlist';
  source?: 'online' | 'walk-in'; // walk-in: staff-added, usually paired with status 'waitlist'
  notes?: string;
  log: AppointmentLog[];
}

export interface AppointmentLog {
  timestamp: Date;
  action: string;
  changedBy: string;
}

export interface SiteSettings {
  _id?: ObjectId;
  tenantId: ObjectId;
  title: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  phone?: string;
  email?: string;
  location?: TenantLocation;
  socialLinks?: SocialLink[];
}

// Schema change (Part 2, Phase B — flagged per your instructions): location
// was a free-text string; the map feature needs coordinates. `address` is
// kept as the human-readable label; `lat`/`lng` come from either the admin
// dragging the map pin or the Nominatim geocode-search fallback.
export interface TenantLocation {
  address: string;
  lat: number;
  lng: number;
}

export interface SocialLink {
  platform: string;
  url: string;
}

// New in Part 2 — a review left against a specific completed appointment,
// so it can't be forged for a visit that never happened. `customerEmail` is
// kept alongside `customerId` because customers aren't fully authenticated
// (see the customer-claim-token notes in PROGRESS2.md) — the appointment
// link is the real authenticity check.
export interface Review {
  _id?: ObjectId;
  tenantId: ObjectId;
  barberId?: ObjectId;
  customerId: ObjectId;
  appointmentId: ObjectId;
  rating: number; // 1-5
  text?: string;
  status: 'visible' | 'flagged';
  createdAt: Date;
}

// New in Part 2 — a customer favoriting a salon on the discovery surface.
export interface Favorite {
  _id?: ObjectId;
  customerId: ObjectId;
  tenantId: ObjectId;
  createdAt: Date;
}

// New in Part 2 — a short-lived, narrowly-scoped claim used so a customer
// can leave a review / manage a favorite / see their loyalty points without
// a full account system. NOT a session: `verifySessionToken` never reads
// this collection, and a claim token carries no role and unlocks nothing
// under requireRole. It only proves "this browser can read this email's
// inbox" via the emailed one-time code, scoped to one customerId.
export interface CustomerClaim {
  _id?: ObjectId;
  codeHash: string;
  customerId: ObjectId;
  email: string;
  expiresAt: Date;
}

// The long-lived cookie-backed token issued once a CustomerClaim's one-time
// code has been verified — separate collection from CustomerClaim itself
// (which is single-use and expires in minutes) and separate from staff
// `sessions` (which carry a role and are read by requireRole). This token
// only ever resolves to a customerId.
export interface CustomerClaimSession {
  _id?: ObjectId;
  tokenHash: string;
  customerId: ObjectId;
  expiresAt: Date;
}

export interface Session {
  _id?: ObjectId;
  tokenHash: string;
  subjectId: ObjectId;
  subjectType: 'user' | 'customer';
  tenantId?: ObjectId;
  role: string;
  expiresAt: Date;
}

export interface LoginAttempt {
  _id?: ObjectId;
  email: string;
  createdAt: Date;
}
