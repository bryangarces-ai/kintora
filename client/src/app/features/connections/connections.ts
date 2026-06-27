import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { ApiService } from '../../core/api.service';
import { EntityType, GraphData } from '../../core/models';

// Visual identity per entity type — brightened for a dark/space backdrop so the
// nodes glow. Shared by the legend, filter, and the 3D nodes.
const TYPES: { type: EntityType; label: string; color: string; icon: string }[] = [
  { type: 'person', label: 'People', color: '#818cf8', icon: '👥' },
  { type: 'memory', label: 'Memories', color: '#fbbf24', icon: '📷' },
  { type: 'fact', label: 'Info', color: '#34d399', icon: '⭐' },
  { type: 'event', label: 'Events', color: '#c084fc', icon: '🗓️' },
];

interface GNode {
  id: string;
  type: EntityType;
  entityId: number;
  label: string;
}

@Component({
  selector: 'app-connections',
  template: `
    <!-- Full-bleed: covers the whole content area (right of the sidebar, below
         the fixed top header). -->
    <section class="fixed inset-x-0 bottom-0 top-16 bg-[#01010a] lg:left-64">
      <!-- 3D canvas fills the entire area -->
      <div
        #graph
        class="absolute inset-0"
        [class.hidden]="loading() || empty()"
      ></div>

      <!-- Floating controls over the galaxy. The wrapper ignores pointer events
           so you can drag the graph anywhere; only the buttons capture clicks. -->
      <div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <div class="max-w-[70%] space-y-3">
          <div class="pointer-events-auto inline-block rounded-2xl bg-slate-900/70 px-4 py-3 backdrop-blur">
            <h2 class="text-xl font-bold text-white sm:text-2xl">Connections</h2>
            <p class="text-xs text-slate-300">Drag to orbit · scroll to zoom · click a star to open it</p>
          </div>
          <div class="flex flex-wrap gap-2">
            @for (t of types; track t.type) {
              <button type="button" (click)="toggle(t.type)"
                class="pointer-events-auto flex items-center gap-2 rounded-full border bg-slate-900/70 px-3 py-1.5 text-sm font-medium text-slate-200 backdrop-blur transition"
                [class.opacity-40]="hidden().has(t.type)"
                [style.borderColor]="t.color">
                <span class="inline-block h-3 w-3 rounded-full" [style.backgroundColor]="t.color"></span>
                {{ t.icon }} {{ t.label }}
              </button>
            }
          </div>
        </div>
        <button type="button" (click)="fit()"
          class="pointer-events-auto rounded-full border border-slate-600 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 backdrop-blur hover:bg-slate-800">
          ⤢ Recenter
        </button>
      </div>

      @if (loading()) {
        <div class="absolute inset-0 flex items-center justify-center">
          <p class="text-slate-400">Loading galaxy…</p>
        </div>
      } @else if (empty()) {
        <div class="absolute inset-0 flex items-center justify-center p-6">
          <div class="max-w-md rounded-2xl border border-slate-700 bg-slate-900/80 p-10 text-center">
            <div class="text-4xl">🌌</div>
            <p class="mt-2 text-slate-300">
              Your galaxy is empty. Add people, memories, and info — then tag them
              to each other to light up the stars.
            </p>
          </div>
        </div>
      }
    </section>
  `,
})
export class Connections implements AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);

  private graphRef = viewChild.required<ElementRef<HTMLDivElement>>('graph');

  protected types = TYPES;
  protected loading = signal(true);
  protected empty = signal(false);
  protected hidden = signal<Set<EntityType>>(new Set());

  private graph: any = null;
  private resizeObs: ResizeObserver | null = null;
  private data: GraphData = { nodes: [], edges: [] };

  ngAfterViewInit(): void {
    this.api.getGraph().subscribe({
      next: (data) => {
        this.data = data;
        this.loading.set(false);
        this.empty.set(data.nodes.length === 0);
        if (!this.empty()) queueMicrotask(() => this.render());
      },
      error: () => {
        this.loading.set(false);
        this.empty.set(true);
      },
    });
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    this.graph?._destructor?.();
    this.graph = null;
  }

  private colorOf(type: EntityType): string {
    return TYPES.find((t) => t.type === type)?.color ?? '#94a3b8';
  }

  /** nodes/links for the current filter, in 3d-force-graph's shape. */
  private buildData() {
    const hidden = this.hidden();
    const nodes = this.data.nodes.filter((n) => !hidden.has(n.type));
    const ids = new Set(nodes.map((n) => n.id));
    const links = this.data.edges
      .filter((e) => ids.has(e.from) && ids.has(e.to))
      .map((e) => ({ source: e.from, target: e.to }));
    return { nodes: nodes.map((n) => ({ ...n })), links };
  }

  private render(): void {
    const el = this.graphRef().nativeElement;

    if (!this.graph) {
      this.graph = new ForceGraph3D(el)
        .backgroundColor('#01010a')
        .showNavInfo(false)
        .nodeRelSize(5)
        .nodeColor((n: any) => this.colorOf((n as GNode).type))
        .nodeOpacity(0.95)
        .nodeThreeObjectExtend(true)
        .nodeThreeObject((n: any) => {
          // Floating label above each star. A dark backing plate keeps the text
          // readable despite the scene-wide bloom glow.
          const group = new THREE.Group();
          const sprite = new SpriteText((n as GNode).label);
          sprite.color = '#f1f5f9';
          sprite.textHeight = 4;
          sprite.fontWeight = '600';
          sprite.backgroundColor = 'rgba(2, 6, 23, 0.78)';
          sprite.padding = 2;
          sprite.borderRadius = 3;
          (sprite as any).position.set(0, 7, 0);
          group.add(sprite);
          return group;
        })
        .linkColor(() => 'rgba(148, 163, 184, 0.35)')
        .linkWidth(0.6)
        .linkOpacity(0.5)
        .onNodeHover((n: any) => {
          el.style.cursor = n ? 'pointer' : 'grab';
        })
        .onNodeClick((n: any) => this.navigateToNode(n as GNode))
        .width(el.clientWidth)
        .height(el.clientHeight);

      this.addStarfield();
      this.addGlow(el);

      // Keep width in sync with the layout (sidebar/responsive changes).
      this.resizeObs = new ResizeObserver(() => {
        this.graph?.width(el.clientWidth).height(el.clientHeight);
      });
      this.resizeObs.observe(el);
    }

    this.graph.graphData(this.buildData());
    setTimeout(() => this.graph?.zoomToFit(600, 60), 400);
  }

  /** A field of distant stars so the graph feels like deep space. */
  private addStarfield(): void {
    try {
      const count = 1400;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 4000;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.6,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.7,
      });
      this.graph.scene().add(new THREE.Points(geo, mat));
    } catch {
      /* starfield is decorative — ignore failures */
    }
  }

  /** Optional bloom so nodes glow. Loaded dynamically so a missing addon can't
   *  break the build; the graph works fine without it. */
  private async addGlow(el: HTMLElement): Promise<void> {
    try {
      const { UnrealBloomPass } = await import(
        'three/examples/jsm/postprocessing/UnrealBloomPass.js'
      );
      // strength, radius, threshold — a gentle glow so node spheres shimmer
      // without washing out the labels.
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(el.clientWidth, el.clientHeight),
        0.6,
        0.4,
        0.25
      );
      this.graph.postProcessingComposer().addPass(bloom);
    } catch {
      /* glow is a nice-to-have */
    }
  }

  private navigateToNode(node: GNode): void {
    switch (node.type) {
      case 'person':
        this.router.navigate(['/people', node.entityId]);
        break;
      case 'memory':
        this.router.navigate(['/memories']);
        break;
      case 'fact':
        this.router.navigate(['/facts']);
        break;
      case 'event':
        this.router.navigate(['/timeline']);
        break;
    }
  }

  toggle(type: EntityType): void {
    const next = new Set(this.hidden());
    next.has(type) ? next.delete(type) : next.add(type);
    this.hidden.set(next);
    if (this.graph) this.graph.graphData(this.buildData());
  }

  fit(): void {
    this.graph?.zoomToFit(600, 60);
  }
}
