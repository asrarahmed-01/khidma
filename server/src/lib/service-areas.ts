/**
 * Cities Khidma currently operates in. Like most on-demand apps, Khidma launches city by
 * city, so a booking is accepted only if the address falls inside one of these circles.
 * The radii are deliberately conservative; for example, the Dammam & Khobar circle stops
 * short of Bahrain across the causeway.
 */
export interface ServiceArea {
  id: string;
  nameEn: string;
  nameAr: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

export const SERVICE_AREAS: ServiceArea[] = [
  { id: "riyadh", nameEn: "Riyadh", nameAr: "الرياض", lat: 24.7136, lng: 46.6753, radiusKm: 45 },
  { id: "jeddah", nameEn: "Jeddah", nameAr: "جدة", lat: 21.5433, lng: 39.1728, radiusKm: 35 },
  { id: "makkah", nameEn: "Makkah", nameAr: "مكة المكرمة", lat: 21.3891, lng: 39.8579, radiusKm: 20 },
  { id: "madinah", nameEn: "Madinah", nameAr: "المدينة المنورة", lat: 24.5247, lng: 39.5692, radiusKm: 20 },
  { id: "dammam-khobar", nameEn: "Dammam & Khobar", nameAr: "الدمام والخبر", lat: 26.35, lng: 50.15, radiusKm: 25 },
];

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres (haversine formula). */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function findServiceArea(lat: number, lng: number): ServiceArea | null {
  return SERVICE_AREAS.find((area) => distanceKm(lat, lng, area.lat, area.lng) <= area.radiusKm) ?? null;
}
