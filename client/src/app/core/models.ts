// Data shapes returned by the Memory Vault API. Columns mirror server/src/schema.sql.

export interface Person {
  id: number;
  name: string;
  relationship: string | null;
  birthday: string | null;
  photo_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Present only on GET /api/people/:id
  memories?: Memory[];
}

export interface MemoryMedia {
  id: number;
  memory_id: number;
  file_path: string;
  media_type: 'image' | 'audio' | null;
}

export interface Memory {
  id: number;
  title: string;
  memory_date: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  // Hydrated on list/detail responses
  media?: MemoryMedia[];
  people?: Person[];
}

export type FactCategory = 'medical' | 'contact' | 'preference' | 'other';

export interface Fact {
  id: number;
  category: FactCategory | string | null;
  label: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface TimelineEvent {
  id: number;
  event_date: string;
  title: string;
  description: string | null;
  photo_path: string | null;
  created_at: string;
}

export type SearchResultType = 'person' | 'memory' | 'fact' | 'event';

export interface SearchResult {
  id: number;
  title: string;
  subtitle: string | null;
  type: SearchResultType;
}

// ---- Connections graph ----------------------------------------------
// EntityType matches the 'type' tokens the backend uses for nodes and links.
export type EntityType = 'person' | 'memory' | 'fact' | 'event';

export interface GraphNode {
  id: string; // namespaced, e.g. "person-1"
  type: EntityType;
  entityId: number;
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// A link as returned by GET /api/links?type=&id= — the "other" end relative to
// the queried entity, with its label resolved for display.
export interface Link {
  id: number;
  other_type: EntityType;
  other_id: number;
  other_label: string | null;
}

export interface CreateLinkPayload {
  source_type: EntityType;
  source_id: number;
  target_type: EntityType;
  target_id: number;
}

// ---- Obsidian export -------------------------------------------------
export interface ObsidianStatus {
  exists: boolean;
  path: string;
  lastExport: string | null;
}

export interface ObsidianExportResult {
  ok: true;
  path: string;
  counts: { people: number; memories: number; facts: number; events: number };
}

// ---- Backup / restore ------------------------------------------------
export interface RestoreResult {
  ok: true;
  // Filename of the automatic safety snapshot taken before the restore.
  safetyBackup: string;
}
