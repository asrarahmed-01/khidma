// Shapes returned by the Khidma API (server/src). Kept in one place so a server change
// shows up as a type error here instead of a crash at runtime.

export type Role = "CUSTOMER" | "TECHNICIAN" | "ADMIN";
export type Locale = "AR" | "EN";
export type BookingStatus = "PENDING" | "ACCEPTED" | "EN_ROUTE" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TechnicianStep = "EN_ROUTE" | "IN_PROGRESS" | "COMPLETED";
export type PaymentStatus = "INITIATED" | "PAID" | "FAILED" | "REFUNDED";

export interface User {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  locale: Locale;
  createdAt: string;
}

export interface ServiceSummary {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  icon: string;
}

export interface Service extends ServiceSummary {
  descriptionEn: string;
  descriptionAr: string;
  basePriceHalalas: number;
}

export interface TechnicianInfo {
  bio: string | null;
  isApproved: boolean;
  isAvailable: boolean;
  services: Pick<ServiceSummary, "id" | "slug" | "nameEn" | "nameAr">[];
}

export interface MeResponse {
  user: User;
  technician: TechnicianInfo | null;
}

export interface ServiceArea {
  id: string;
  nameEn: string;
  nameAr: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface Contact {
  id: string;
  name: string | null;
  phone: string;
}

export interface Booking {
  id: string;
  status: BookingStatus;
  service: ServiceSummary;
  scheduledAt: string;
  serviceArea: string;
  address: { line: string; lat: number; lng: number };
  notes: string | null;
  priceHalalas: number;
  customer: Contact;
  technician: Contact | null;
  /** Last reported position, only while the technician is on the way. */
  technicianLocation: { lat: number; lng: number; at: string } | null;
  payment: PaymentSummary | null;
  cancelReason: string | null;
  timeline: {
    createdAt: string;
    acceptedAt: string | null;
    enRouteAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
  };
}

export interface PaymentSummary {
  status: PaymentStatus;
  amountHalalas: number;
  /** mada, visa, mastercard, amex, applepay, stcpay */
  method: string | null;
  paidAt: string | null;
  /** The provider's reason for the last declined attempt, e.g. "INSUFFICIENT FUNDS". */
  failureMessage: string | null;
}

export interface Message {
  id: string;
  bookingId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface MessagesPage {
  messages: Message[];
  hasMore: boolean;
}

/** A technician position pushed over Socket.IO. */
export interface LiveLocation {
  bookingId: string;
  lat: number;
  lng: number;
  heading: number | null;
  at: string;
}

/** What a technician sees before accepting: area only, no address or customer details. */
export interface OpenJob {
  id: string;
  service: ServiceSummary;
  scheduledAt: string;
  serviceArea: string;
  approxLocation: { lat: number; lng: number };
  notes: string | null;
  priceHalalas: number;
}

export interface VerifyOtpResponse {
  token: string;
  user: User;
  isNewUser: boolean;
}

export interface CreateBookingInput {
  serviceId: string;
  scheduledAt: string;
  addressLine: string;
  lat: number;
  lng: number;
  notes?: string;
}
