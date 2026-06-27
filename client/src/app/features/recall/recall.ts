import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { SpeechService } from '../../core/speech.service';
import { Fact, Memory, Person, TimelineEvent } from '../../core/models';

// A memory shown in "On this day", annotated with how long ago it was.
interface OnThisDay {
  memory: Memory;
  yearsAgo: number | null;
}

// A person with an upcoming/today birthday.
interface UpcomingBirthday {
  person: Person;
  inDays: number; // 0 = today
  turning: number | null;
}

@Component({
  selector: 'app-recall',
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-4xl space-y-10 pb-16 text-slate-800">
      <!-- Greeting + date -->
      <header class="pt-2 text-center">
        <p class="text-2xl font-medium text-slate-500 sm:text-3xl">{{ greeting() }}</p>
        <h1 class="mt-2 text-4xl font-bold leading-tight sm:text-6xl">{{ todayLong() }}</h1>
        @if (speech.supported && !loading()) {
          <button type="button" (click)="readBriefing()"
            class="mt-5 rounded-full bg-indigo-600 px-6 py-3 text-xl font-medium text-white hover:bg-indigo-700">
            {{ speech.speaking() ? '⏹ Stop' : '🔊 Read this to me' }}
          </button>
        }
      </header>

      @if (loading()) {
        <p class="text-center text-2xl text-slate-400">Loading…</p>
      } @else {
        <!-- Today's highlights -->
        @if (birthdaysToday().length || eventsToday().length || onThisDay().length) {
          <div class="rounded-3xl border-2 border-amber-200 bg-amber-50 p-6 sm:p-8">
            <h2 class="mb-4 text-2xl font-bold text-amber-900 sm:text-3xl">✨ Today</h2>
            <ul class="space-y-4 text-xl sm:text-2xl">
              @for (b of birthdaysToday(); track b.person.id) {
                <li>
                  🎂 <strong>{{ b.person.name }}</strong>'s birthday is today.
                  @if (b.turning !== null) { <span>They turn {{ b.turning }}.</span> }
                </li>
              }
              @for (e of eventsToday(); track e.id) {
                <li>🗓️ <strong>{{ e.title }}</strong> — on this day{{ yearSuffix(e.event_date) }}.</li>
              }
              @for (o of onThisDay(); track o.memory.id) {
                <li>
                  📷 <strong>{{ o.memory.title }}</strong>
                  @if (o.yearsAgo) { <span>— {{ o.yearsAgo }} year{{ o.yearsAgo === 1 ? '' : 's' }} ago today.</span> }
                </li>
              }
            </ul>
          </div>
        }

        <!-- The people in your life -->
        @if (people().length) {
          <div>
            <h2 class="mb-5 text-3xl font-bold sm:text-4xl">The people in your life</h2>
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
              @for (p of people(); track p.id) {
                <a
                  [routerLink]="['/people', p.id]"
                  class="flex flex-col items-center rounded-3xl border-2 border-slate-200 bg-white p-5 text-center transition hover:border-indigo-300 hover:shadow-md"
                >
                  @if (photo(p); as src) {
                    <img [src]="src" [alt]="p.name" class="h-28 w-28 rounded-full object-cover sm:h-32 sm:w-32" />
                  } @else {
                    <div class="flex h-28 w-28 items-center justify-center rounded-full bg-indigo-100 text-5xl sm:h-32 sm:w-32">
                      🧑
                    </div>
                  }
                  <span class="mt-3 text-2xl font-semibold leading-tight">{{ p.name }}</span>
                  @if (p.relationship) {
                    <span class="mt-1 text-xl text-slate-500">{{ p.relationship }}</span>
                  }
                </a>
              }
            </div>
          </div>
        }

        <!-- Upcoming birthdays -->
        @if (upcoming().length) {
          <div>
            <h2 class="mb-5 text-3xl font-bold sm:text-4xl">🎉 Coming up</h2>
            <ul class="space-y-3 text-xl sm:text-2xl">
              @for (u of upcoming(); track u.person.id) {
                <li class="rounded-2xl border-2 border-slate-200 bg-white px-5 py-4">
                  <strong>{{ u.person.name }}</strong>'s birthday
                  {{ u.inDays === 0 ? 'is today' : (u.inDays === 1 ? 'is tomorrow' : 'in ' + u.inDays + ' days') }}.
                </li>
              }
            </ul>
          </div>
        }

        <!-- Important info -->
        @if (facts().length) {
          <div>
            <h2 class="mb-5 text-3xl font-bold sm:text-4xl">⭐ Important to remember</h2>
            <ul class="space-y-3 text-xl sm:text-2xl">
              @for (f of facts(); track f.id) {
                <li class="rounded-2xl border-2 border-slate-200 bg-white px-5 py-4">
                  <span class="text-slate-500">{{ f.label }}:</span>
                  <strong class="ml-1">{{ f.value }}</strong>
                </li>
              }
            </ul>
          </div>
        }

        <!-- Recent memories -->
        @if (recent().length) {
          <div>
            <h2 class="mb-5 text-3xl font-bold sm:text-4xl">Recent memories</h2>
            <div class="grid gap-5 sm:grid-cols-2">
              @for (m of recent(); track m.id) {
                <a
                  routerLink="/memories"
                  class="overflow-hidden rounded-3xl border-2 border-slate-200 bg-white transition hover:shadow-md"
                >
                  @if (cover(m); as src) {
                    <img [src]="src" [alt]="m.title" class="h-48 w-full object-cover" />
                  } @else {
                    <div class="flex h-48 w-full items-center justify-center bg-slate-100 text-6xl">📷</div>
                  }
                  <div class="p-5">
                    <h3 class="text-2xl font-semibold leading-tight">{{ m.title }}</h3>
                    @if (m.memory_date) {
                      <p class="mt-1 text-xl text-slate-500">{{ prettyDate(m.memory_date) }}</p>
                    }
                  </div>
                </a>
              }
            </div>
          </div>
        }

        @if (isEmpty()) {
          <div class="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
            <p class="text-2xl text-slate-500">
              Your vault is empty for now. Add people and memories, and they'll
              appear here each day.
            </p>
          </div>
        }
      }
    </section>
  `,
})
export class Recall {
  private api = inject(ApiService);
  protected speech = inject(SpeechService);

  protected loading = signal(true);
  protected people = signal<Person[]>([]);
  protected facts = signal<Fact[]>([]);
  protected recent = signal<Memory[]>([]);
  protected birthdaysToday = signal<UpcomingBirthday[]>([]);
  protected upcoming = signal<UpcomingBirthday[]>([]);
  protected eventsToday = signal<TimelineEvent[]>([]);
  protected onThisDay = signal<OnThisDay[]>([]);

  private now = new Date();

  protected greeting = (): string => {
    const h = this.now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  protected todayLong = (): string =>
    this.now.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  protected isEmpty = (): boolean =>
    !this.people().length &&
    !this.facts().length &&
    !this.recent().length &&
    !this.birthdaysToday().length &&
    !this.eventsToday().length &&
    !this.onThisDay().length &&
    !this.upcoming().length;

  constructor() {
    forkJoin({
      people: this.api.getPeople(),
      memories: this.api.getMemories(),
      facts: this.api.getFacts(),
      timeline: this.api.getTimeline(),
    }).subscribe({
      next: ({ people, memories, facts, timeline }) => {
        this.people.set(people);
        this.facts.set(facts);
        this.recent.set(memories.slice(0, 4));

        const tM = this.now.getMonth();
        const tD = this.now.getDate();

        // Birthdays today + upcoming (within 45 days).
        const today: UpcomingBirthday[] = [];
        const soon: UpcomingBirthday[] = [];
        for (const p of people) {
          const md = this.monthDay(p.birthday);
          if (!md) continue;
          const inDays = this.daysUntil(md.month, md.day);
          const turning = this.turningAge(p.birthday);
          if (inDays === 0) today.push({ person: p, inDays, turning });
          else if (inDays <= 45) soon.push({ person: p, inDays, turning });
        }
        soon.sort((a, b) => a.inDays - b.inDays);
        this.birthdaysToday.set(today);
        this.upcoming.set(soon.slice(0, 5));

        // Timeline events that fall on today's month/day.
        this.eventsToday.set(
          timeline.filter((e) => {
            const md = this.monthDay(e.event_date);
            return md && md.month === tM && md.day === tD;
          })
        );

        // Memories on this day in past years.
        this.onThisDay.set(
          memories
            .filter((m) => {
              const md = this.monthDay(m.memory_date);
              return md && md.month === tM && md.day === tD;
            })
            .map((m) => ({ memory: m, yearsAgo: this.yearsAgo(m.memory_date) }))
        );

        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // ---- read aloud ------------------------------------------------------
  readBriefing(): void {
    const lines: string[] = [`${this.greeting()}. Today is ${this.todayLong()}.`];

    for (const b of this.birthdaysToday()) {
      lines.push(
        `Today is ${b.person.name}'s birthday.` +
          (b.turning !== null ? ` They turn ${b.turning}.` : '')
      );
    }
    for (const e of this.eventsToday()) lines.push(`On this day: ${e.title}.`);
    for (const o of this.onThisDay()) {
      lines.push(
        `${o.memory.title}` + (o.yearsAgo ? `, ${o.yearsAgo} years ago today.` : '.')
      );
    }

    if (this.people().length) {
      lines.push('The people in your life: ' + this.people().map((p) => p.name).join(', ') + '.');
    }
    for (const u of this.upcoming()) {
      lines.push(
        `${u.person.name}'s birthday is ` +
          (u.inDays === 0 ? 'today.' : u.inDays === 1 ? 'tomorrow.' : `in ${u.inDays} days.`)
      );
    }
    for (const f of this.facts()) lines.push(`${f.label}: ${f.value}.`);

    this.speech.toggle(lines.join(' '));
  }

  // ---- date helpers ----------------------------------------------------
  // Accepts 'YYYY-MM-DD' or 'MM-DD'; returns 0-based month + day, or null.
  private monthDay(s: string | null | undefined): { month: number; day: number } | null {
    if (!s) return null;
    const parts = s.split('-').map((x) => parseInt(x, 10));
    if (parts.some((n) => Number.isNaN(n))) return null;
    if (parts.length === 3) return { month: parts[1] - 1, day: parts[2] };
    if (parts.length === 2) return { month: parts[0] - 1, day: parts[1] };
    return null;
  }

  private daysUntil(month: number, day: number): number {
    const y = this.now.getFullYear();
    const todayMid = new Date(y, this.now.getMonth(), this.now.getDate());
    let next = new Date(y, month, day);
    if (next < todayMid) next = new Date(y + 1, month, day);
    return Math.round((next.getTime() - todayMid.getTime()) / 86400000);
  }

  private turningAge(birthday: string | null | undefined): number | null {
    if (!birthday) return null;
    const parts = birthday.split('-').map((x) => parseInt(x, 10));
    if (parts.length !== 3 || Number.isNaN(parts[0])) return null;
    return this.now.getFullYear() - parts[0];
  }

  private yearsAgo(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    const parts = dateStr.split('-').map((x) => parseInt(x, 10));
    if (parts.length < 1 || Number.isNaN(parts[0])) return null;
    const diff = this.now.getFullYear() - parts[0];
    return diff > 0 ? diff : null;
  }

  protected yearSuffix(dateStr: string | null | undefined): string {
    const y = this.yearsAgo(dateStr);
    return y ? ` ${y} year${y === 1 ? '' : 's'} ago` : '';
  }

  protected prettyDate(s: string): string {
    const d = new Date(s);
    return Number.isNaN(d.getTime())
      ? s
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  photo(p: Person): string | null {
    return this.api.mediaUrl(p.photo_path);
  }
  cover(m: Memory): string | null {
    const img = m.media?.find((x) => x.media_type === 'image');
    return img ? this.api.mediaUrl(img.file_path) : null;
  }
}
