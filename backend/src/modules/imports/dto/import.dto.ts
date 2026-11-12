import { ArrayMaxSize, ArrayMinSize, IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * POST /api/platform/imports/preview
 * The client parses the uploaded JSON file (< 750 KB) and sends either the array itself
 * or `object.features` as `features`. Each item may be a GeoJSON Feature
 * ({ properties, geometry: Point }) or a flat object of reference fields.
 */
export class ImportPreviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsObject({ each: true })
  features: Record<string, unknown>[];
}
