/**
 * Pure validation/normalisation for parcel reference features. No DB access - easy to unit test.
 */

export const PERMITTED_FIELDS = [
  'plot_code',
  'plot_no',
  'lu_desc',
  'extn_sqyrd',
  'area_sqm',
  'rd_width_m',
  'district',
  'mandal',
  'village',
  'rs_no',
  'zoning',
  'latitude',
  'longitude',
] as const;

const STRING_FIELDS = ['plot_no', 'lu_desc', 'district', 'mandal', 'village', 'rs_no', 'zoning'] as const;
const NUMBER_FIELDS = ['extn_sqyrd', 'area_sqm', 'rd_width_m'] as const;

export interface ParcelRow {
  plot_code: string;
  plot_no: string | null;
  lu_desc: string | null;
  extn_sqyrd: number | null;
  area_sqm: number | null;
  rd_width_m: number | null;
  district: string | null;
  mandal: string | null;
  village: string | null;
  rs_no: string | null;
  zoning: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface RowError {
  index: number;
  field: string;
  message: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const toNum = (v: unknown): number | null | typeof NaN => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim()) : NaN;
  return Number.isFinite(n) ? n : NaN;
};

const toStr = (v: unknown, max: number): string | null | undefined => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return undefined; // invalid type
  const s = v.trim();
  return s.length > max ? undefined : s || null;
};

export function validateFeatures(features: Record<string, unknown>[], plotCodeRegex: RegExp) {
  const rows: ParcelRow[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();

  features.forEach((feature, index) => {
    const props = isObj(feature.properties) ? feature.properties : feature;
    const rowErrors: RowError[] = [];
    const err = (field: string, message: string) => rowErrors.push({ index, field, message });

    // plot_code
    const rawCode = typeof props.plot_code === 'string' ? props.plot_code.trim().toUpperCase() : '';
    if (!rawCode) err('plot_code', 'plot_code is required');
    else if (!plotCodeRegex.test(rawCode)) err('plot_code', 'plot_code has an invalid format');
    else if (seen.has(rawCode)) err('plot_code', `duplicate plot_code (also at index ${seen.get(rawCode)})`);
    else seen.set(rawCode, index);

    const row: Partial<ParcelRow> = { plot_code: rawCode };

    for (const f of STRING_FIELDS) {
      const v = toStr(props[f], f === 'lu_desc' ? 200 : 120);
      if (v === undefined) err(f, `${f} must be text (max ${f === 'lu_desc' ? 200 : 120} chars)`);
      else row[f] = v;
    }
    for (const f of NUMBER_FIELDS) {
      const v = toNum(props[f]);
      if (Number.isNaN(v) || (v !== null && v < 0)) err(f, `${f} must be a non-negative number`);
      else row[f] = v;
    }

    // Coordinates: explicit properties win, else GeoJSON Point [lng, lat].
    let lat = toNum(props.latitude);
    let lng = toNum(props.longitude);
    const geom = feature.geometry;
    if (lat === null && lng === null && isObj(geom) && geom.type === 'Point' && Array.isArray(geom.coordinates)) {
      lng = toNum(geom.coordinates[0]);
      lat = toNum(geom.coordinates[1]);
    }
    if (Number.isNaN(lat) || (lat !== null && (lat < -90 || lat > 90))) err('latitude', 'latitude must be between -90 and 90');
    else row.latitude = lat;
    if (Number.isNaN(lng) || (lng !== null && (lng < -180 || lng > 180))) err('longitude', 'longitude must be between -180 and 180');
    else row.longitude = lng;

    const unknown = Object.keys(props).filter((k) => !(PERMITTED_FIELDS as readonly string[]).includes(k));
    // Unknown fields are dropped (not an error) - reported for transparency.
    if (unknown.length > 20) err('*', 'too many unrecognised fields');

    if (rowErrors.length) errors.push(...rowErrors);
    else rows.push(row as ParcelRow);
  });

  return { rows, errors };
}
