import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CATEGORIAS, Gamificacion, calcularGamificacion } from '../../../core/utils/gamificacion';
import { IconComponent } from '../icon.component';


/**
 * Misma pieza en los tres perfiles:
 *   <app-gamificacion [perfil]="perfil()" modo="resumen" [editable]="true" />   nivel + próximas metas
 *   <app-gamificacion [perfil]="perfil()" modo="insignias" />                   todas las insignias con progreso
 *   <app-gamificacion [perfil]="perfil()" modo="chip" />                        etiqueta de nivel para tarjetas
 * `editable` = es mi perfil: muestra el acceso a completar datos.
 */
@Component({
  selector: 'app-gamificacion',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  template: `
    <ng-container *ngIf="g() as x">

      <!-- ============================================================ CHIP -->
      <span *ngIf="modo === 'chip'" class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold" [ngClass]="x.claseNivel">
        <app-icon nombre="flag" clase="w-3 h-3" /> Nivel {{ x.nivel }} · {{ x.nombre }}
      </span>

      <!-- ========================================================= RESUMEN -->
      <section *ngIf="modo === 'resumen'" class="rounded-xl border border-stone-200 bg-white p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold" [ngClass]="x.claseNivel">
              <app-icon nombre="flag" clase="w-3 h-3" /> Nivel {{ x.nivel }}
            </span>
            <p class="mt-1.5 text-base font-bold leading-tight">{{ x.nombre }}</p>
          </div>
          <p class="text-right"><span class="text-lg font-bold">{{ x.xp | number }}</span><span class="block text-[11px] text-slate-500">puntos</span></p>
        </div>

        <div class="mt-3 h-2 overflow-hidden rounded-full bg-stone-200" role="progressbar"
             [attr.aria-valuenow]="x.pct" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="'Progreso al siguiente nivel'">
          <div class="h-full rounded-full bg-teal-600 transition-[width] duration-700" [style.width.%]="x.pct"></div>
        </div>
        <p class="mt-1.5 text-xs text-slate-500">
          <ng-container *ngIf="!x.nivelMax">Te faltan {{ x.faltan | number }} puntos para <strong class="text-slate-700">{{ x.siguiente }}</strong>.</ng-container>
          <ng-container *ngIf="x.nivelMax">Llegaste al nivel máximo.</ng-container>
        </p>

        <!-- Próximas metas -->
        <div *ngIf="x.proximos.length" class="mt-4 border-t border-stone-100 pt-3">
          <h3 class="mb-2 text-xs font-semibold text-slate-500">Próximas metas</h3>
          <ul class="space-y-3">
            <li *ngFor="let l of x.proximos">
              <div class="flex items-center gap-2">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-slate-500"><app-icon [nombre]="l.icono" clase="w-4 h-4" /></span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">{{ l.nombre }}</p>
                  <p class="truncate text-[11px] text-slate-500">{{ l.descripcion }}</p>
                </div>
                <span class="shrink-0 text-[11px] font-bold text-teal-700">+{{ l.xp }}</span>
              </div>
              <div class="mt-1.5 flex items-center gap-2">
                <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200"><div class="h-full rounded-full bg-teal-500" [style.width.%]="l.progreso * 100"></div></div>
                <span class="w-16 text-right text-[11px] tabular-nums text-slate-500">{{ l.texto }}</span>
              </div>
            </li>
          </ul>
        </div>

        <!-- Completar perfil (sólo en el propio) -->
        <a *ngIf="editable && x.completitud.pct < 100" routerLink="/editar-perfil"
           class="mt-4 flex items-center justify-between gap-3 rounded-lg bg-teal-50 px-3 py-2.5 text-xs text-teal-900 transition hover:bg-teal-100">
          <span><strong>Perfil al {{ x.completitud.pct }}%.</strong> {{ x.completitud.faltan[0]?.etq }}.</span>
          <app-icon nombre="pencil" clase="w-3.5 h-3.5 shrink-0" />
        </a>
      </section>

      <!-- ======================================================== INSIGNIAS -->
      <section *ngIf="modo === 'insignias'" class="space-y-6">
        <p class="text-sm text-slate-600"><strong>{{ x.desbloqueados }}</strong> de {{ x.logros.length }} insignias desbloqueadas.</p>
        <div *ngFor="let c of grupos()">
          <h3 class="mb-2 flex items-center gap-2 text-sm font-bold"><app-icon [nombre]="c.icono" clase="w-4 h-4 text-slate-500" /> {{ c.txt }}</h3>
          <div class="grid gap-2 sm:grid-cols-2">
            <article *ngFor="let l of c.items" class="flex items-start gap-3 rounded-xl border p-3"
                     [ngClass]="l.desbloqueada ? 'border-teal-200 bg-white' : 'border-stone-200 bg-stone-100/60'">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    [ngClass]="l.desbloqueada ? 'bg-teal-700 text-white' : 'bg-stone-200 text-stone-400'">
                <app-icon [nombre]="l.desbloqueada ? l.icono : 'lock'" clase="w-5 h-5" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <h4 class="truncate text-sm font-bold">{{ l.nombre }}</h4>
                  <span class="shrink-0 text-[11px] font-bold" [ngClass]="l.desbloqueada ? 'text-teal-700' : 'text-slate-400'">+{{ l.xp }}</span>
                </div>
                <p class="mt-0.5 text-xs leading-snug text-slate-500">{{ l.descripcion }}</p>
                <div *ngIf="!l.desbloqueada" class="mt-2 flex items-center gap-2">
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200"><div class="h-full rounded-full bg-teal-500" [style.width.%]="l.progreso * 100"></div></div>
                  <span class="text-[11px] tabular-nums text-slate-500">{{ l.texto }}</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </ng-container>
  `,
})
export class GamificacionComponent {
  @Input() modo: 'resumen' | 'insignias' | 'chip' = 'resumen';
  @Input() editable = false;

  private perfilSig = signal<any>(null);
  @Input() set perfil(v: any) { this.perfilSig.set(v); }

  g = computed<Gamificacion | null>(() => (this.perfilSig() ? calcularGamificacion(this.perfilSig()) : null));

  grupos = computed(() => {
    const x = this.g();
    if (!x) return [];
    return CATEGORIAS
      .map(c => ({ ...c, items: x.logros.filter(l => l.categoria === c.id) }))
      .filter(c => c.items.length > 0);
  });
}
