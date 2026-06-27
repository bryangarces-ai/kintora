import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import {
  CreateLinkPayload,
  EntityType,
  Fact,
  GraphData,
  Link,
  Memory,
  ObsidianExportResult,
  ObsidianStatus,
  Person,
  RestoreResult,
  SearchResult,
  SecurityStatus,
  TimelineEvent,
} from './models';

// All requests go through the dev-server proxy (proxy.conf.json), which forwards
// /api and /uploads to the Express backend on :3000.
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = '/api';

  /** Build a browser-usable URL for an uploaded file (photo/audio). */
  mediaUrl(filePath: string | null | undefined): string | null {
    return filePath ? `/uploads/${filePath}` : null;
  }

  // ---- People ----------------------------------------------------------
  getPeople(): Observable<Person[]> {
    return this.http.get<Person[]>(`${this.base}/people`);
  }
  getPerson(id: number): Observable<Person> {
    return this.http.get<Person>(`${this.base}/people/${id}`);
  }
  createPerson(data: FormData): Observable<Person> {
    return this.http.post<Person>(`${this.base}/people`, data);
  }
  updatePerson(id: number, data: FormData): Observable<Person> {
    return this.http.put<Person>(`${this.base}/people/${id}`, data);
  }
  deletePerson(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.base}/people/${id}`);
  }

  // ---- Memories --------------------------------------------------------
  getMemories(): Observable<Memory[]> {
    return this.http.get<Memory[]>(`${this.base}/memories`);
  }
  getMemory(id: number): Observable<Memory> {
    return this.http.get<Memory>(`${this.base}/memories/${id}`);
  }
  createMemory(data: FormData): Observable<Memory> {
    return this.http.post<Memory>(`${this.base}/memories`, data);
  }
  updateMemory(id: number, data: FormData): Observable<Memory> {
    return this.http.put<Memory>(`${this.base}/memories/${id}`, data);
  }
  deleteMemory(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.base}/memories/${id}`);
  }
  deleteMemoryMedia(memoryId: number, mediaId: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(
      `${this.base}/memories/${memoryId}/media/${mediaId}`
    );
  }

  // ---- Facts -----------------------------------------------------------
  getFacts(): Observable<Fact[]> {
    return this.http.get<Fact[]>(`${this.base}/facts`);
  }
  createFact(data: Partial<Fact>): Observable<Fact> {
    return this.http.post<Fact>(`${this.base}/facts`, data);
  }
  updateFact(id: number, data: Partial<Fact>): Observable<Fact> {
    return this.http.put<Fact>(`${this.base}/facts/${id}`, data);
  }
  deleteFact(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.base}/facts/${id}`);
  }

  // ---- Timeline --------------------------------------------------------
  getTimeline(): Observable<TimelineEvent[]> {
    return this.http.get<TimelineEvent[]>(`${this.base}/timeline`);
  }
  createEvent(data: FormData): Observable<TimelineEvent> {
    return this.http.post<TimelineEvent>(`${this.base}/timeline`, data);
  }
  updateEvent(id: number, data: FormData): Observable<TimelineEvent> {
    return this.http.put<TimelineEvent>(`${this.base}/timeline/${id}`, data);
  }
  deleteEvent(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.base}/timeline/${id}`);
  }

  // ---- Search ----------------------------------------------------------
  search(q: string): Observable<SearchResult[]> {
    return this.http.get<SearchResult[]>(`${this.base}/search`, {
      params: { q },
    });
  }

  // ---- Connections (links + graph) -------------------------------------
  getGraph(): Observable<GraphData> {
    return this.http.get<GraphData>(`${this.base}/graph`);
  }
  getLinks(type: EntityType, id: number): Observable<Link[]> {
    return this.http.get<Link[]>(`${this.base}/links`, {
      params: { type, id },
    });
  }
  createLink(payload: CreateLinkPayload): Observable<unknown> {
    return this.http.post(`${this.base}/links`, payload);
  }
  deleteLink(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.base}/links/${id}`);
  }

  // ---- Obsidian export -------------------------------------------------
  getObsidianStatus(): Observable<ObsidianStatus> {
    return this.http.get<ObsidianStatus>(`${this.base}/obsidian/status`);
  }
  exportObsidian(): Observable<ObsidianExportResult> {
    return this.http.post<ObsidianExportResult>(`${this.base}/obsidian/export`, {});
  }

  // ---- Backup / restore ------------------------------------------------
  /** Download the whole vault as a passphrase-encrypted .kvault blob. */
  downloadBackup(passphrase: string): Observable<Blob> {
    return this.http.post(`${this.base}/backup/download`, { passphrase }, { responseType: 'blob' });
  }
  restoreBackup(file: File, passphrase: string): Observable<RestoreResult> {
    const form = new FormData();
    form.append('backup', file);
    form.append('passphrase', passphrase);
    return this.http.post<RestoreResult>(`${this.base}/backup/restore`, form);
  }

  // ---- Vault security (passphrase) -------------------------------------
  getSecurityStatus(): Observable<SecurityStatus> {
    return this.http.get<SecurityStatus>(`${this.base}/security/status`);
  }
  setPassphrase(passphrase: string, current?: string): Observable<SecurityStatus> {
    return this.http.post<SecurityStatus>(`${this.base}/security/passphrase`, {
      passphrase,
      current,
    });
  }
  removePassphrase(current: string): Observable<SecurityStatus> {
    return this.http.delete<SecurityStatus>(`${this.base}/security/passphrase`, {
      body: { current },
    });
  }

  /**
   * Reconcile an entity's links to a desired set: creates the ones that are new
   * and deletes the ones that were removed. `existing` is the result of a prior
   * getLinks() call (so we know each removed link's id). Emits once when done.
   */
  syncLinks(
    type: EntityType,
    id: number,
    desired: { type: EntityType; id: number }[],
    existing: Link[]
  ): Observable<unknown> {
    const key = (t: EntityType, i: number) => `${t}-${i}`;
    const desiredKeys = new Set(desired.map((d) => key(d.type, d.id)));
    const existingKeys = new Set(existing.map((e) => key(e.other_type, e.other_id)));

    const ops: Observable<unknown>[] = [
      ...desired
        .filter((d) => !existingKeys.has(key(d.type, d.id)))
        .map((d) =>
          this.createLink({
            source_type: type,
            source_id: id,
            target_type: d.type,
            target_id: d.id,
          })
        ),
      ...existing
        .filter((e) => !desiredKeys.has(key(e.other_type, e.other_id)))
        .map((e) => this.deleteLink(e.id)),
    ];

    return ops.length ? forkJoin(ops) : of(null);
  }
}
