import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { MAX_IMPORT_BYTES } from '../config';

/** Saves a text file: browser download on web, share sheet (Files, Drive, email…) on iOS/Android. */
export async function saveTextFile(filename: string, content: string, mimeType: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename, UTI: mimeType === 'text/csv' ? 'public.comma-separated-values-text' : undefined });
}

export type PickedJson = { name: string; size: number; text: string };

/** Lets the admin pick a .json / .geojson file and returns its text. Enforces the 750 KB limit before reading. */
export async function pickJsonFile(): Promise<PickedJson | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: Platform.OS === 'web' ? ['.json', '.geojson', 'application/json', 'application/geo+json'] : ['application/json', 'application/geo+json', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const name = asset.name ?? 'import.json';
  if (!/\.(geo)?json$/i.test(name)) throw new Error('Choose a .json or .geojson file.');
  if (asset.size !== undefined && asset.size >= MAX_IMPORT_BYTES) throw new Error('The file must be smaller than 750 KB.');

  let text: string;
  if (Platform.OS === 'web' && asset.file) text = await asset.file.text();
  else text = await new File(asset.uri).text();

  const size = asset.size ?? new Blob([text]).size;
  if (size >= MAX_IMPORT_BYTES) throw new Error('The file must be smaller than 750 KB.');
  return { name, size, text };
}

/** Accepts a plain array, a GeoJSON FeatureCollection or { features: [...] }. */
export function extractFeatures(text: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { features?: unknown }).features)) {
    return (parsed as { features: unknown[] }).features;
  }
  throw new Error('Expected an array of parcels or a GeoJSON FeatureCollection.');
}
