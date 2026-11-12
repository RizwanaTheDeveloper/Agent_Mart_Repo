import { validateFeatures } from './parcel-validator';

const RX = /^[A-Z0-9]{2,10}(-[A-Z0-9]{1,12}){1,4}$/;

describe('validateFeatures', () => {
  it('accepts GeoJSON features and reads Point coordinates', () => {
    const { rows, errors } = validateFeatures(
      [{ type: 'Feature', properties: { plot_code: 'hyd-skp-001', area_sqm: '250' }, geometry: { type: 'Point', coordinates: [78.4, 17.4] } }],
      RX,
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ plot_code: 'HYD-SKP-001', area_sqm: 250, latitude: 17.4, longitude: 78.4 });
  });

  it('rejects bad plot codes, duplicates and out-of-range coordinates', () => {
    const { rows, errors } = validateFeatures(
      [
        { plot_code: 'bad code!' },
        { plot_code: 'AB-1', latitude: 120 },
        { plot_code: 'AB-2' },
        { plot_code: 'AB-2' },
      ],
      RX,
    );
    expect(rows.map((r) => r.plot_code)).toEqual(['AB-2']);
    expect(errors.map((e) => [e.index, e.field])).toEqual([
      [0, 'plot_code'],
      [1, 'latitude'],
      [3, 'plot_code'],
    ]);
  });
});
