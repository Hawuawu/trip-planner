import { parse, stringify } from 'yaml';
import type { Alternative, Checkpoint, CheckpointType, Trip } from '../types';

const CHECKPOINT_TYPES: CheckpointType[] = ['flight', 'train', 'metro', 'hotel', 'poi', 'other'];

export interface YamlValidationError {
  path: string;
  message: string;
}

export type ImportableCheckpoint = Omit<Checkpoint, 'id' | 'updatedAt' | 'linkedBookingId'>;
export type ImportableAlternative = Omit<Alternative, 'id'>;

export interface ParsedCheckpointsYaml {
  checkpoints: ImportableCheckpoint[];
  alternatives: ImportableAlternative[];
  errors: YamlValidationError[];
}

export interface ParsedTripYaml extends ParsedCheckpointsYaml {
  name: string;
  dateRange: { start: string; end: string };
}

function safeParseYamlDocument(yamlText: string): {
  doc: Record<string, unknown> | null;
  errors: YamlValidationError[];
} {
  try {
    const doc: unknown = parse(yamlText);
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
      return {
        doc: null,
        errors: [{ path: '(document)', message: 'YAML must be a mapping, not a list or scalar' }],
      };
    }
    return { doc: doc as Record<string, unknown>, errors: [] };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      doc: null,
      errors: [{ path: '(document)', message: `YAML syntax error: ${message}` }],
    };
  }
}

function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
}

function validateCommonFields(
  raw: Record<string, unknown>,
  path: string,
  errors: YamlValidationError[]
): boolean {
  let ok = true;

  if (!CHECKPOINT_TYPES.includes(raw.type as CheckpointType)) {
    errors.push({
      path,
      message: `"type" must be one of ${CHECKPOINT_TYPES.join(', ')} — got ${JSON.stringify(raw.type)}`,
    });
    ok = false;
  }

  if (typeof raw.name !== 'string' || raw.name.trim() === '') {
    errors.push({ path, message: '"name" is required and must be a non-empty string' });
    ok = false;
  }

  if (raw.notes !== undefined && typeof raw.notes !== 'string') {
    errors.push({ path, message: '"notes" must be a string' });
    ok = false;
  }

  if (raw.location !== undefined && raw.location !== null) {
    if (typeof raw.location !== 'object' || Array.isArray(raw.location)) {
      errors.push({ path, message: '"location" must be an object with "lat"/"lng"' });
      ok = false;
    } else {
      const location = raw.location as Record<string, unknown>;
      if (typeof location.lat !== 'number' || location.lat < -90 || location.lat > 90) {
        errors.push({ path, message: '"location.lat" must be a number between -90 and 90' });
        ok = false;
      }
      if (typeof location.lng !== 'number' || location.lng < -180 || location.lng > 180) {
        errors.push({ path, message: '"location.lng" must be a number between -180 and 180' });
        ok = false;
      }
    }
  }

  return ok;
}

function validateCheckpointDates(
  raw: Record<string, unknown>,
  path: string,
  errors: YamlValidationError[]
): boolean {
  let ok = true;

  if (!isValidDateString(raw.startTime)) {
    errors.push({ path, message: '"startTime" is required and must be a valid date' });
    ok = false;
  }

  if (raw.endTime !== undefined) {
    if (!isValidDateString(raw.endTime)) {
      errors.push({ path, message: '"endTime" must be a valid date' });
      ok = false;
    } else if (isValidDateString(raw.startTime) && raw.endTime < (raw.startTime as string)) {
      // ISO 8601 strings sort lexicographically the same as chronologically.
      errors.push({ path, message: '"endTime" must be on or after "startTime"' });
      ok = false;
    }
  }

  return ok;
}

function buildLocation(raw: Record<string, unknown>): Checkpoint['location'] {
  if (raw.location === undefined || raw.location === null) return undefined;
  const location = raw.location as Record<string, unknown>;
  return {
    lat: location.lat as number,
    lng: location.lng as number,
    ...(typeof location.label === 'string' ? { label: location.label } : {}),
  };
}

function buildCheckpoint(raw: Record<string, unknown>): ImportableCheckpoint {
  return {
    type: raw.type as CheckpointType,
    name: (raw.name as string).trim(),
    startTime: raw.startTime as string,
    ...(raw.endTime !== undefined ? { endTime: raw.endTime as string } : {}),
    ...(buildLocation(raw) ? { location: buildLocation(raw) } : {}),
    ...(typeof raw.notes === 'string' ? { notes: raw.notes } : {}),
  };
}

function buildAlternative(raw: Record<string, unknown>): ImportableAlternative {
  return {
    type: raw.type as CheckpointType,
    name: (raw.name as string).trim(),
    ...(buildLocation(raw) ? { location: buildLocation(raw) } : {}),
    ...(typeof raw.notes === 'string' ? { notes: raw.notes } : {}),
  };
}

function parseItemsList<T>(
  rawList: unknown,
  listName: 'checkpoints' | 'alternatives',
  requireDates: boolean,
  errors: YamlValidationError[]
): T[] {
  if (rawList === undefined || rawList === null) return [];
  if (!Array.isArray(rawList)) {
    errors.push({ path: listName, message: `"${listName}" must be a list` });
    return [];
  }

  const items: T[] = [];
  rawList.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      errors.push({ path: `${listName}[${index}]`, message: 'must be an object' });
      return;
    }
    const raw = entry as Record<string, unknown>;
    const label =
      typeof raw.name === 'string' && raw.name.trim() !== ''
        ? `${listName}[${index}] ("${raw.name}")`
        : `${listName}[${index}]`;

    const itemErrors: YamlValidationError[] = [];
    const commonOk = validateCommonFields(raw, label, itemErrors);
    const datesOk = requireDates ? validateCheckpointDates(raw, label, itemErrors) : true;

    if (commonOk && datesOk) {
      items.push((requireDates ? buildCheckpoint(raw) : buildAlternative(raw)) as T);
    } else {
      errors.push(...itemErrors);
    }
  });

  return items;
}

export function parseCheckpointsYaml(yamlText: string): ParsedCheckpointsYaml {
  const { doc, errors } = safeParseYamlDocument(yamlText);
  if (!doc) return { checkpoints: [], alternatives: [], errors };

  const checkpoints = parseItemsList<ImportableCheckpoint>(
    doc.checkpoints,
    'checkpoints',
    true,
    errors
  );
  const alternatives = parseItemsList<ImportableAlternative>(
    doc.alternatives,
    'alternatives',
    false,
    errors
  );

  return { checkpoints, alternatives, errors };
}

export function parseTripYaml(yamlText: string): ParsedTripYaml {
  const { doc, errors } = safeParseYamlDocument(yamlText);
  if (!doc) {
    return {
      name: '',
      dateRange: { start: '', end: '' },
      checkpoints: [],
      alternatives: [],
      errors,
    };
  }

  let name = '';
  if (typeof doc.name !== 'string' || doc.name.trim() === '') {
    errors.push({ path: 'name', message: '"name" is required and must be a non-empty string' });
  } else {
    name = doc.name.trim();
  }

  let dateRange = { start: '', end: '' };
  if (typeof doc.dateRange !== 'object' || doc.dateRange === null || Array.isArray(doc.dateRange)) {
    errors.push({
      path: 'dateRange',
      message: '"dateRange" is required and must be an object with "start"/"end"',
    });
  } else {
    const raw = doc.dateRange as Record<string, unknown>;
    if (typeof raw.start !== 'string' || raw.start.trim() === '') {
      errors.push({
        path: 'dateRange.start',
        message: '"dateRange.start" is required and must be a string',
      });
    }
    if (typeof raw.end !== 'string' || raw.end.trim() === '') {
      errors.push({
        path: 'dateRange.end',
        message: '"dateRange.end" is required and must be a string',
      });
    }
    dateRange = {
      start: typeof raw.start === 'string' ? raw.start : '',
      end: typeof raw.end === 'string' ? raw.end : '',
    };
  }

  const checkpoints = parseItemsList<ImportableCheckpoint>(
    doc.checkpoints,
    'checkpoints',
    true,
    errors
  );
  const alternatives = parseItemsList<ImportableAlternative>(
    doc.alternatives,
    'alternatives',
    false,
    errors
  );

  return { name, dateRange, checkpoints, alternatives, errors };
}

function toExportCheckpoint(cp: Checkpoint): ImportableCheckpoint {
  const { id: _id, updatedAt: _updatedAt, linkedBookingId: _linkedBookingId, ...rest } = cp;
  return rest;
}

function toExportAlternative(alt: Alternative): ImportableAlternative {
  const { id: _id, ...rest } = alt;
  return rest;
}

export function serializeTrip(
  trip: Trip,
  checkpoints: Checkpoint[],
  alternatives: Alternative[]
): string {
  return stringify({
    name: trip.name,
    dateRange: trip.dateRange,
    checkpoints: checkpoints.map(toExportCheckpoint),
    alternatives: alternatives.map(toExportAlternative),
  });
}
