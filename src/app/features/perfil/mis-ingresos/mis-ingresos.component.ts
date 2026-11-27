import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { SesionService } from '../../../core/services/sesion.service';
import { planVigente } from '../../../core/utils/planes';
import { UI, mensajeAmigable } from '../../../core/utils/helpers';
import { IconComponent } from '../../../shared/components/icon.component';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';

export type EstadoTrabajo = 'en_proceso' | 'acabado';
export type EstadoPago = 'en_espera_de_pago' | 'parcial' | 'pagado';
export type FiltroEstado = 'todos' | EstadoTrabajo | EstadoPago;

export interface RamaOperacion {
  id: string;
  corte_id: string;
  usuario_id: string;
  maquina: string;
  operacion: string;
  cantidad_piezas: number;
  piezas_defecto: number;
  pago_por_pieza: number;
  completada: boolean;
  completada_en: string | null;
  notas?: string | null;
}

export interface CorteManual {
  id: string;
  usuario_id: string;
  descripcion: string;
  taller_nombre: string | null;
  cantidad_piezas: number;
  monto_total: number;
  fecha: string;
  fecha_ingreso: string;
  estado_trabajo: EstadoTrabajo;
  estado_pago: EstadoPago;
  pagado_en: string | null;
  operaciones: RamaOperacion[];
}

interface PresetOperacion {
  etiqueta: string;
  maquina: string;
  operacion: string;
}

@Component({
  selector: 'app-cortes-manuales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, ToastComponent],
  template: `
    <div class="min-h-[calc(100dvh-var(--header-h,4rem))] bg-stone-50 px-4 pb-10 pt-6 text-slate-900">
      <app-toast [aviso]="aviso()" />

      <div class="mx-auto max-w-4xl space-y-5">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-bold">Cortes manuales y control de cobros</h1>
            <p class="text-sm text-slate-500">
              Divide cada corte por máquina y etapa, marca lo acabado y controla tus pagos sin errores.
            </p>
          </div>

          <button
            type="button"
            [disabled]="bloqueadoPorPlan()"
            (click)="abrirNuevoCorte()"
            [ngClass]="ui.btnPrimario"
            class="!px-3.5 !py-2 !text-xs"
          >
            <app-icon nombre="plus" clase="w-4 h-4" /> Nuevo corte
          </button>
        </header>

        <!-- Aviso de bloqueo para plan básico -->
        <div
          *ngIf="bloqueadoPorPlan()"
          class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
        >
          <div class="space-y-1">
            <p class="flex items-center gap-1.5 text-sm font-bold">
              <app-icon nombre="lock" clase="w-4 h-4 text-amber-700" />
              Sección bloqueada en plan básico
            </p>
            <p class="text-xs text-amber-900/85">
              El registro por ramas de máquina, barra de avance y control de cobros requiere un plan de pago activo.
            </p>
          </div>
          <a routerLink="/planes" [ngClass]="ui.btnPrimario" class="!px-4 !py-2 !text-xs shrink-0">
            Ver planes
          </a>
        </div>

        <!-- Contenedor principal opacado si está en plan básico -->
        <div
          [attr.aria-disabled]="bloqueadoPorPlan()"
          [ngClass]="bloqueadoPorPlan() ? 'pointer-events-none select-none opacity-45 grayscale-[30%]' : ''"
          class="space-y-5 transition-opacity"
        >
          <!-- Filtro por mes y estado -->
          <section [ngClass]="ui.card" class="space-y-3 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex flex-wrap items-center gap-2">
                <label class="text-xs font-semibold text-slate-600" for="filtroMes">Mes de ingreso:</label>
                <select
                  id="filtroMes"
                  [disabled]="bloqueadoPorPlan()"
                  [ngModel]="mesSeleccionado()"
                  (ngModelChange)="mesSeleccionado.set($event)"
                  [ngClass]="ui.inputGrande"
                  class="!w-auto !py-1.5 !text-xs font-semibold"
                >
                  <option value="todos">Todos los meses</option>
                  <option *ngFor="let m of mesesDisponibles()" [value]="m.clave">
                    {{ m.etiqueta }} ({{ m.cantidad }})
                  </option>
                </select>
              </div>

              <div class="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  *ngFor="let f of filtrosEstado"
                  [disabled]="bloqueadoPorPlan()"
                  (click)="filtroEstado.set(f.id)"
                  class="rounded-lg px-2.5 py-1 text-xs font-semibold transition"
                  [ngClass]="filtroEstado() === f.id
                    ? 'bg-teal-700 text-white'
                    : 'bg-stone-100 text-slate-600 hover:bg-stone-200'"
                >
                  {{ f.etiqueta }}
                </button>
              </div>
            </div>

            <!-- Resumen financiero del período filtrado -->
            <div class="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-4">
              <div class="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p class="text-[11px] font-medium text-slate-500">Acabado (listo para cobrar)</p>
                <p class="mt-0.5 text-base font-extrabold text-teal-800">
                  R$ {{ resumenPeriodo().montoAcabado | number:'1.2-2' }}
                </p>
              </div>

              <div class="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p class="text-[11px] font-medium text-slate-500">En proceso (pendiente)</p>
                <p class="mt-0.5 text-base font-extrabold text-amber-800">
                  R$ {{ resumenPeriodo().montoEnProceso | number:'1.2-2' }}
                </p>
              </div>

              <div class="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p class="text-[11px] font-medium text-slate-500">En espera de pago</p>
                <p class="mt-0.5 text-base font-extrabold text-rose-800">
                  R$ {{ resumenPeriodo().porCobrar | number:'1.2-2' }}
                </p>
              </div>

              <div class="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p class="text-[11px] font-medium text-slate-500">Pagado</p>
                <p class="mt-0.5 text-base font-extrabold text-slate-800">
                  R$ {{ resumenPeriodo().pagado | number:'1.2-2' }}
                </p>
              </div>
            </div>
          </section>

          <!-- Carrusel superior de cortes -->
          <section [ngClass]="ui.card" class="space-y-3 p-4">
            <div class="flex items-center justify-between gap-2">
              <div>
                <h2 class="text-sm font-bold">Tus cortes ({{ cortesFiltrados().length }})</h2>
                <p class="text-xs text-slate-500">Desplázate entre cortes o selecciona uno para administrar sus etapas.</p>
              </div>

              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  [disabled]="bloqueadoPorPlan() || cortesFiltrados().length === 0"
                  (click)="desplazarCarrusel(-1)"
                  aria-label="Corte anterior"
                  [ngClass]="ui.btnSecundario"
                  class="!px-2.5 !py-1.5 !text-xs"
                >
                  <app-icon nombre="chevron-left" clase="w-4 h-4" />
                </button>
                <button
                  type="button"
                  [disabled]="bloqueadoPorPlan() || cortesFiltrados().length === 0"
                  (click)="desplazarCarrusel(1)"
                  aria-label="Corte siguiente"
                  [ngClass]="ui.btnSecundario"
                  class="!px-2.5 !py-1.5 !text-xs"
                >
                  <app-icon nombre="chevron-right" clase="w-4 h-4" />
                </button>
              </div>
            </div>

            <div *ngIf="cargando()" class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div class="h-28 animate-pulse rounded-xl bg-stone-200/70"></div>
              <div class="h-28 animate-pulse rounded-xl bg-stone-200/70"></div>
              <div class="h-28 animate-pulse rounded-xl bg-stone-200/70"></div>
            </div>

            <div
              *ngIf="!cargando() && cortesFiltrados().length === 0"
              class="rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs text-slate-500"
            >
              No hay cortes registrados para este filtro. Crea uno nuevo para empezar.
            </div>

            <div
              #carruselCortes
              *ngIf="!cargando() && cortesFiltrados().length > 0"
              class="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
            >
              <button
                type="button"
                *ngFor="let c of cortesFiltrados()"
                [disabled]="bloqueadoPorPlan()"
                (click)="seleccionarCorte(c.id)"
                class="w-64 shrink-0 snap-start rounded-xl border p-3.5 text-left transition"
                [ngClass]="c.id === corteSeleccionado()?.id
                  ? 'border-teal-700 bg-teal-50/60 ring-2 ring-teal-600'
                  : 'border-stone-200 bg-white hover:border-stone-300'"
              >
                <div class="flex items-start justify-between gap-2">
                  <p class="truncate text-sm font-bold text-slate-900">{{ c.descripcion }}</p>
                  <span class="shrink-0 text-[11px] font-medium text-slate-400">{{ c.fecha_ingreso }}</span>
                </div>

                <p class="mt-0.5 truncate text-xs text-slate-500">
                  {{ c.taller_nombre || 'Sin taller especificado' }} · {{ c.cantidad_piezas }} pzs
                </p>

                <!-- Mini barra de progreso en tarjeta -->
                <div class="mt-2.5">
                  <div class="flex items-center justify-between text-[11px] font-semibold">
                    <span class="text-teal-800">{{ progresoCorte(c).pct }}% acabado</span>
                    <span class="text-slate-700">R$ {{ totalCorte(c) | number:'1.2-2' }}</span>
                  </div>
                  <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200">
                    <div
                      class="h-full rounded-full bg-teal-600 transition-all"
                      [style.width.%]="progresoCorte(c).pct"
                    ></div>
                  </div>
                </div>

                <!-- Etiquetas de trabajo y cobro -->
                <div class="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                  <span
                    class="rounded-md px-2 py-0.5"
                    [ngClass]="c.estado_trabajo === 'acabado'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'"
                  >
                    {{ c.estado_trabajo === 'acabado' ? 'Acabado' : 'En proceso' }}
                  </span>

                  <span
                    class="rounded-md px-2 py-0.5"
                    [ngClass]="c.estado_pago === 'pagado'
                      ? 'bg-teal-100 text-teal-800'
                      : (c.estado_pago === 'parcial' ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800')"
                  >
                    {{ etiquetaPago(c.estado_pago) }}
                  </span>
                </div>
              </button>
            </div>
          </section>

          <!-- Formulario para crear nuevo corte -->
          <section *ngIf="mostrarFormNuevoCorte()" [ngClass]="ui.card" class="space-y-4 border-teal-200 p-4">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-bold">Registrar nuevo corte</h2>
              <button
                type="button"
                [disabled]="bloqueadoPorPlan()"
                (click)="mostrarFormNuevoCorte.set(false)"
                class="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cerrar
              </button>
            </div>

            <div class="grid gap-3 sm:grid-cols-4">
              <label [ngClass]="ui.etiqueta" class="sm:col-span-2">
                Prenda / Corte
                <input
                  type="text"
                  [disabled]="bloqueadoPorPlan()"
                  [(ngModel)]="nuevoCorte.descripcion"
                  placeholder="Ej: Blusa Ribana manga corta"
                  [ngClass]="ui.inputGrande"
                />
              </label>

              <label [ngClass]="ui.etiqueta">
                Taller / Cliente
                <input
                  type="text"
                  [disabled]="bloqueadoPorPlan()"
                  [(ngModel)]="nuevoCorte.taller_nombre"
                  placeholder="Ej: Taller Brás"
                  [ngClass]="ui.inputGrande"
                />
              </label>

              <label [ngClass]="ui.etiqueta">
                Fecha ingreso
                <input
                  type="date"
                  [disabled]="bloqueadoPorPlan()"
                  [(ngModel)]="nuevoCorte.fecha_ingreso"
                  [ngClass]="ui.inputGrande"
                />
              </label>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <label [ngClass]="ui.etiqueta">
                Piezas totales del corte
                <input
                  type="number"
                  min="1"
                  [disabled]="bloqueadoPorPlan()"
                  [(ngModel)]="nuevoCorte.cantidad_piezas"
                  [ngClass]="ui.inputGrande"
                />
              </label>
            </div>

            <div class="flex justify-end gap-2">
              <button
                type="button"
                [disabled]="bloqueadoPorPlan()"
                (click)="mostrarFormNuevoCorte.set(false)"
                [ngClass]="ui.btnSecundario"
              >
                Cancelar
              </button>
              <button
                type="button"
                [disabled]="bloqueadoPorPlan() || guardando()"
                (click)="crearCorte()"
                [ngClass]="ui.btnPrimario"
              >
                {{ guardando() ? 'Guardando...' : 'Crear corte' }}
              </button>
            </div>
          </section>

          <!-- Detalle del corte seleccionado + Barra de progreso + Ramas -->
          <section *ngIf="corteSeleccionado() as corte" [ngClass]="ui.card" class="space-y-5 p-5">
            <div class="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-4">
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-lg font-bold">{{ corte.descripcion }}</h2>
                  <span class="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    Ingreso: {{ corte.fecha_ingreso }}
                  </span>
                </div>
                <p class="text-xs text-slate-500">
                  {{ corte.taller_nombre || 'Sin taller' }} · Lote de {{ corte.cantidad_piezas }} piezas
                </p>
              </div>

              <!-- Control de estado de cobro -->
              <div class="flex flex-wrap items-center gap-2">
                <label class="text-xs font-semibold text-slate-600" for="estadoPagoSelect">Cobro:</label>
                <select
                  id="estadoPagoSelect"
                  [disabled]="bloqueadoPorPlan()"
                  [ngModel]="corte.estado_pago"
                  (ngModelChange)="cambiarEstadoPago(corte, $event)"
                  [ngClass]="ui.inputGrande"
                  class="!w-auto !py-1.5 !text-xs font-bold"
                >
                  <option value="en_espera_de_pago">En espera de pago</option>
                  <option value="parcial">Pagado parcial</option>
                  <option value="pagado">Pagado</option>
                </select>
              </div>
            </div>

            <!-- BARRA DE PROGRESO DETALLADA -->
            <div class="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-600">
                    Progreso del corte
                  </p>
                  <p class="text-sm font-extrabold text-slate-900">
                    {{ progresoCorte(corte).pct }}% completado
                    <span class="ml-1 text-xs font-medium text-slate-500">
                      ({{ progresoCorte(corte).ramasHechas }}/{{ progresoCorte(corte).ramasTotal }} ramas listas ·
                      {{ progresoCorte(corte).piezasHechas }} piezas terminadas)
                    </span>
                  </p>
                </div>

                <div class="text-right text-xs">
                  <p class="font-bold text-teal-800">
                    Ganado en ramas listas: R$ {{ progresoCorte(corte).montoHecho | number:'1.2-2' }}
                  </p>
                  <p class="text-slate-500">
                    Por terminar: R$ {{ progresoCorte(corte).montoPendiente | number:'1.2-2' }} ·
                    Total corte: R$ {{ totalCorte(corte) | number:'1.2-2' }}
                  </p>
                </div>
              </div>

              <div
                class="h-3 overflow-hidden rounded-full bg-stone-200"
                role="progressbar"
                [attr.aria-valuenow]="progresoCorte(corte).pct"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="h-full rounded-full transition-[width] duration-300"
                  [ngClass]="progresoCorte(corte).pct === 100 ? 'bg-emerald-600' : 'bg-teal-600'"
                  [style.width.%]="progresoCorte(corte).pct"
                ></div>
              </div>

              <p class="text-[11px] text-slate-500">
                {{
                  progresoCorte(corte).pct === 100
                    ? 'Todas las ramas están marcadas como acabadas. Revisa el estado de cobro cuando recibas el pago.'
                    : 'Marca cada etapa como acabada conforme vayas terminando (por ejemplo, unir cuello en galonera).'
                }}
              </p>
            </div>

            <!-- Presets rápidos para agregar rama -->
            <div class="space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-sm font-bold">Ramas por máquina y operación</h3>
                <button
                  type="button"
                  [disabled]="bloqueadoPorPlan() || guardando()"
                  (click)="agregarRama(corte)"
                  [ngClass]="ui.btnPrimario"
                  class="!px-3 !py-1.5 !text-xs"
                >
                  <app-icon nombre="plus" clase="w-3.5 h-3.5" /> Agregar rama
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-[11px] font-medium text-slate-500">Atajos rápidos:</span>
                <button
                  type="button"
                  *ngFor="let p of presetsOperacion"
                  [disabled]="bloqueadoPorPlan() || guardando()"
                  (click)="agregarRama(corte, p)"
                  class="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-teal-600 hover:text-teal-800"
                >
                  + {{ p.etiqueta }}
                </button>
              </div>
            </div>

            <!-- Lista de ramas del corte -->
            <div
              *ngIf="corte.operaciones.length === 0"
              class="rounded-xl border border-dashed border-stone-300 p-5 text-center text-xs text-slate-500"
            >
              Este corte aún no tiene ramas. Usa "Agregar rama" o un atajo rápido para dividir tu trabajo.
            </div>

            <div class="space-y-3">
              <div
                *ngFor="let op of corte.operaciones"
                class="rounded-xl border p-4 transition"
                [ngClass]="op.completada
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : 'border-stone-200 bg-white'"
              >
                <div class="flex flex-wrap items-center justify-between gap-2 pb-3">
                  <button
                    type="button"
                    [disabled]="bloqueadoPorPlan() || guardando()"
                    (click)="alternarCompletada(corte, op)"
                    class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition"
                    [ngClass]="op.completada
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'border border-stone-300 bg-stone-100 text-slate-800 hover:bg-stone-200'"
                  >
                    <app-icon [nombre]="op.completada ? 'check' : 'circle'" clase="w-4 h-4" />
                    {{ op.completada ? 'Acabado (clic para desmarcar)' : 'Marcar como acabado' }}
                  </button>

                  <div class="flex items-center gap-3">
                    <span class="text-sm font-extrabold text-slate-900">
                      R$ {{ subtotalRama(op) | number:'1.2-2' }}
                    </span>
                    <button
                      type="button"
                      [disabled]="bloqueadoPorPlan() || guardando()"
                      (click)="eliminarRama(corte, op)"
                      aria-label="Eliminar rama"
                      class="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                </div>

                <div class="grid gap-3 sm:grid-cols-5">
                  <label [ngClass]="ui.etiqueta">
                    Máquina
                    <select
                      [disabled]="bloqueadoPorPlan()"
                      [(ngModel)]="op.maquina"
                      [name]="'maq_' + op.id"
                      [ngClass]="ui.inputGrande"
                      class="!py-1.5 !text-xs"
                    >
                      <option value="Overlock">Overlock</option>
                      <option value="Galonera">Galonera</option>
                      <option value="Recta">Recta</option>
                      <option value="Botonera">Botonera</option>
                      <option value="Manual / Acabado">Manual / Acabado</option>
                    </select>
                  </label>

                  <label [ngClass]="ui.etiqueta" class="sm:col-span-2">
                    Parte / Operación
                    <input
                      type="text"
                      [disabled]="bloqueadoPorPlan()"
                      [(ngModel)]="op.operacion"
                      [name]="'op_' + op.id"
                      placeholder="Ej: Unir cuello o mangas y cuerpo"
                      [ngClass]="ui.inputGrande"
                      class="!py-1.5 !text-xs"
                    />
                  </label>

                  <label [ngClass]="ui.etiqueta">
                    Piezas hechas
                    <input
                      type="number"
                      min="0"
                      [disabled]="bloqueadoPorPlan()"
                      [(ngModel)]="op.cantidad_piezas"
                      [name]="'pzs_' + op.id"
                      [ngClass]="ui.inputGrande"
                      class="!py-1.5 !text-xs"
                    />
                  </label>

                  <label [ngClass]="ui.etiqueta">
                    Valor / pieza (R$)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      [disabled]="bloqueadoPorPlan()"
                      [(ngModel)]="op.pago_por_pieza"
                      [name]="'val_' + op.id"
                      [ngClass]="ui.inputGrande"
                      class="!py-1.5 !text-xs"
                    />
                  </label>
                </div>

                <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <label class="inline-flex items-center gap-1.5">
                    <span>Defectos:</span>
                    <input
                      type="number"
                      min="0"
                      [disabled]="bloqueadoPorPlan()"
                      [(ngModel)]="op.piezas_defecto"
                      [name]="'def_' + op.id"
                      class="w-16 rounded border border-stone-300 bg-white px-2 py-0.5 text-xs text-slate-800"
                    />
                  </label>

                  <button
                    type="button"
                    [disabled]="bloqueadoPorPlan() || guardando()"
                    (click)="guardarRama(corte, op)"
                    class="text-xs font-semibold text-teal-700 hover:underline"
                  >
                    Guardar cambios de rama
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class CortesManualesComponent implements OnInit {
  readonly ui = UI;

  @Input() oficinaId: string | null = null;
  @Output() totalCambio = new EventEmitter<number>();

  @ViewChild('carruselCortes') carruselRef?: ElementRef<HTMLDivElement>;

  private supabaseService = inject(SupabaseService);
  private sesion = inject(SesionService);

  private get db() {
    return this.supabaseService.supabase;
  }

  private uidCargado = '';

  cargando = signal(true);
  guardando = signal(false);
  aviso = signal<Aviso | null>(null);

  cortes = signal<CorteManual[]>([]);
  corteSeleccionadoId = signal<string | null>(null);
  mesSeleccionado = signal<string>('todos');
  filtroEstado = signal<FiltroEstado>('todos');
  mostrarFormNuevoCorte = signal(false);

  nuevoCorte = {
    descripcion: '',
    taller_nombre: '',
    fecha_ingreso: new Date().toISOString().slice(0, 10),
    cantidad_piezas: 50,
  };

  readonly filtrosEstado: { id: FiltroEstado; etiqueta: string }[] = [
    { id: 'todos', etiqueta: 'Todos' },
    { id: 'en_proceso', etiqueta: 'En proceso' },
    { id: 'acabado', etiqueta: 'Acabados' },
    { id: 'en_espera_de_pago', etiqueta: 'En espera de pago' },
    { id: 'pagado', etiqueta: 'Pagados' },
  ];

  readonly presetsOperacion: PresetOperacion[] = [
    { etiqueta: 'Overlock · Mangas y cuerpo', maquina: 'Overlock', operacion: 'Mangas y cuerpo' },
    { etiqueta: 'Galonera · Unir cuello', maquina: 'Galonera', operacion: 'Unir cuello' },
    { etiqueta: 'Galonera · Ruedo / bainha', maquina: 'Galonera', operacion: 'Ruedo / bainha' },
    { etiqueta: 'Recta · Pespunte', maquina: 'Recta', operacion: 'Pespunte / acabado' },
  ];

  bloqueadoPorPlan = computed(() => {
    const perfil = this.sesion.usuario();
    if (!perfil) return true;
    const vigente = planVigente(perfil.plan, perfil.plan_vigente_hasta);
    return !vigente || vigente === 'basico';
  });

  mesesDisponibles = computed(() => {
    const mapa = new Map<string, { clave: string; etiqueta: string; cantidad: number }>();
    for (const c of this.cortes()) {
      const clave = (c.fecha_ingreso || c.fecha || '').slice(0, 7);
      if (!clave) continue;
      const actual = mapa.get(clave);
      if (actual) {
        actual.cantidad += 1;
      } else {
        const [anio, mes] = clave.split('-');
        const fechaObj = new Date(Number(anio), Number(mes) - 1, 1);
        const etiqueta = fechaObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        mapa.set(clave, { clave, etiqueta, cantidad: 1 });
      }
    }
    return Array.from(mapa.values()).sort((a, b) => b.clave.localeCompare(a.clave));
  });

  cortesFiltrados = computed(() => {
    const mes = this.mesSeleccionado();
    const estado = this.filtroEstado();

    return this.cortes().filter(c => {
      const claveMes = (c.fecha_ingreso || c.fecha || '').slice(0, 7);
      if (mes !== 'todos' && claveMes !== mes) return false;

      if (estado === 'en_proceso' || estado === 'acabado') {
        return c.estado_trabajo === estado;
      }
      if (estado === 'en_espera_de_pago' || estado === 'parcial' || estado === 'pagado') {
        return c.estado_pago === estado;
      }
      return true;
    });
  });

  corteSeleccionado = computed(() => {
    const lista = this.cortesFiltrados();
    if (!lista.length) return null;
    const id = this.corteSeleccionadoId();
    return lista.find(c => c.id === id) ?? lista[0];
  });

  resumenPeriodo = computed(() => {
    let montoAcabado = 0;
    let montoEnProceso = 0;
    let porCobrar = 0;
    let pagado = 0;

    for (const c of this.cortesFiltrados()) {
      const prog = this.progresoCorte(c);
      const total = this.totalCorte(c);
      montoAcabado += prog.montoHecho;
      montoEnProceso += prog.montoPendiente;

      if (c.estado_pago === 'pagado') {
        pagado += total;
      } else {
        porCobrar += total;
      }
    }

    return { montoAcabado, montoEnProceso, porCobrar, pagado };
  });

  constructor() {
    effect(() => {
      const uid = this.oficinaId || this.sesion.usuario()?.id || '';
      if (uid && uid !== this.uidCargado) {
        this.uidCargado = uid;
        void this.cargarDatos(uid);
      }
    });
  }

  async ngOnInit() {
    if (!this.uidCargado) {
      await this.cargarDatos();
    }
  }

  private async resolverUsuarioId(forzado?: string): Promise<string | null> {
    if (forzado) return forzado;
    if (this.oficinaId) return this.oficinaId;
    const desdeSesion = this.sesion.usuario()?.id;
    if (desdeSesion) return desdeSesion;
    const { data: { user } } = await this.db.auth.getUser();
    return user?.id ?? null;
  }

  private emitirTotalGlobal(lista: CorteManual[] = this.cortes()) {
    const suma = lista.reduce((acc, c) => acc + this.totalCorte(c), 0);
    this.totalCambio.emit(Number(suma.toFixed(2)));
  }

  async cargarDatos(uidForzado?: string) {
    this.cargando.set(true);
    try {
      const uid = await this.resolverUsuarioId(uidForzado);
      if (!uid) {
        this.cargando.set(false);
        return;
      }
      this.uidCargado = uid;

      const { data: cortesData, error: errCortes } = await this.db
        .from('cortes_manuales')
        .select('*')
        .eq('usuario_id', uid)
        .order('fecha_ingreso', { ascending: false });

      if (errCortes) throw errCortes;

      const { data: opsData, error: errOps } = await this.db
        .from('cortes_manuales_operaciones')
        .select('*')
        .eq('usuario_id', uid)
        .order('created_at', { ascending: true });

      if (errOps) throw errOps;

      const porCorte = new Map<string, RamaOperacion[]>();
      for (const op of (opsData ?? []) as RamaOperacion[]) {
        const arr = porCorte.get(op.corte_id) ?? [];
        arr.push(op);
        porCorte.set(op.corte_id, arr);
      }

      const combinados: CorteManual[] = ((cortesData ?? []) as any[]).map(row => ({
        id: row.id,
        usuario_id: row.usuario_id,
        descripcion: row.descripcion,
        taller_nombre: row.taller_nombre ?? null,
        cantidad_piezas: Number(row.cantidad_piezas ?? 0),
        monto_total: Number(row.monto_total ?? 0),
        fecha: row.fecha ?? (row.fecha_ingreso || new Date().toISOString().slice(0, 10)),
        fecha_ingreso: row.fecha_ingreso ?? row.fecha ?? new Date().toISOString().slice(0, 10),
        estado_trabajo: (row.estado_trabajo as EstadoTrabajo) || 'en_proceso',
        estado_pago: (row.estado_pago as EstadoPago) || 'en_espera_de_pago',
        pagado_en: row.pagado_en ?? null,
        operaciones: porCorte.get(row.id) ?? [],
      }));

      this.cortes.set(combinados);
      this.emitirTotalGlobal(combinados);

      if (combinados.length && !this.corteSeleccionadoId()) {
        this.corteSeleccionadoId.set(combinados[0].id);
      }
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No se pudieron cargar los cortes manuales.'), 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  seleccionarCorte(id: string) {
    this.corteSeleccionadoId.set(id);
  }

  desplazarCarrusel(direccion: -1 | 1) {
    const el = this.carruselRef?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direccion * 280, behavior: 'smooth' });
  }

  abrirNuevoCorte() {
    if (this.bloqueadoPorPlan()) return;
    this.mostrarFormNuevoCorte.set(true);
  }

  subtotalRama(op: RamaOperacion): number {
    const piezasValidas = Math.max(0, Number(op.cantidad_piezas || 0) - Number(op.piezas_defecto || 0));
    return Number((piezasValidas * Number(op.pago_por_pieza || 0)).toFixed(2));
  }

  totalCorte(corte: CorteManual): number {
    if (!corte.operaciones.length) return Number(corte.monto_total || 0);
    return corte.operaciones.reduce((acc, op) => acc + this.subtotalRama(op), 0);
  }

  progresoCorte(corte: CorteManual) {
    const ops = corte.operaciones;
    if (!ops.length) {
      const pct = corte.estado_trabajo === 'acabado' ? 100 : 0;
      const total = Number(corte.monto_total || 0);
      return {
        pct,
        ramasHechas: 0,
        ramasTotal: 0,
        piezasHechas: corte.estado_trabajo === 'acabado' ? corte.cantidad_piezas : 0,
        montoHecho: corte.estado_trabajo === 'acabado' ? total : 0,
        montoPendiente: corte.estado_trabajo === 'acabado' ? 0 : total,
      };
    }

    const hechas = ops.filter(o => o.completada);
    const piezasHechas = hechas.reduce(
      (acc, o) => acc + Math.max(0, Number(o.cantidad_piezas || 0) - Number(o.piezas_defecto || 0)),
      0
    );
    const montoHecho = hechas.reduce((acc, o) => acc + this.subtotalRama(o), 0);
    const montoTotal = ops.reduce((acc, o) => acc + this.subtotalRama(o), 0);
    const montoPendiente = Math.max(0, Number((montoTotal - montoHecho).toFixed(2)));
    const pct = Math.round((hechas.length / ops.length) * 100);

    return {
      pct,
      ramasHechas: hechas.length,
      ramasTotal: ops.length,
      piezasHechas,
      montoHecho,
      montoPendiente,
    };
  }

  etiquetaPago(estado: EstadoPago): string {
    switch (estado) {
      case 'pagado':
        return 'Pagado';
      case 'parcial':
        return 'Pagado parcial';
      default:
        return 'En espera de pago';
    }
  }

  async crearCorte() {
    if (this.bloqueadoPorPlan()) return;
    const desc = this.nuevoCorte.descripcion.trim();
    if (!desc) {
      this.notificar('Escribe el nombre o descripción del corte.', 'error');
      return;
    }

    this.guardando.set(true);
    try {
      const uid = await this.resolverUsuarioId();
      if (!uid) return;

      const payload = {
        usuario_id: uid,
        descripcion: desc,
        taller_nombre: this.nuevoCorte.taller_nombre.trim() || null,
        cantidad_piezas: Math.max(1, Number(this.nuevoCorte.cantidad_piezas || 1)),
        monto_total: 0,
        fecha: this.nuevoCorte.fecha_ingreso,
        fecha_ingreso: this.nuevoCorte.fecha_ingreso,
        estado_trabajo: 'en_proceso' as EstadoTrabajo,
        estado_pago: 'en_espera_de_pago' as EstadoPago,
      };

      const { data, error } = await this.db
        .from('cortes_manuales')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;

      const nuevo: CorteManual = {
        ...data,
        operaciones: [],
      };

      this.cortes.update(prev => {
        const actualizada = [nuevo, ...prev];
        this.emitirTotalGlobal(actualizada);
        return actualizada;
      });
      this.corteSeleccionadoId.set(nuevo.id);
      this.mostrarFormNuevoCorte.set(false);
      this.nuevoCorte.descripcion = '';
      this.nuevoCorte.taller_nombre = '';
      this.notificar(`Corte "${nuevo.descripcion}" creado.`);
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No se pudo crear el corte.'), 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  async agregarRama(corte: CorteManual, preset?: PresetOperacion) {
    if (this.bloqueadoPorPlan()) return;
    this.guardando.set(true);
    try {
      const payload = {
        corte_id: corte.id,
        usuario_id: corte.usuario_id,
        maquina: preset?.maquina ?? 'Overlock',
        operacion: preset?.operacion ?? '',
        cantidad_piezas: corte.cantidad_piezas || 0,
        piezas_defecto: 0,
        pago_por_pieza: 0,
        completada: false,
        completada_en: null,
      };

      const { data, error } = await this.db
        .from('cortes_manuales_operaciones')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;

      this.cortes.update(lista =>
        lista.map(c =>
          c.id === corte.id
            ? { ...c, estado_trabajo: 'en_proceso', operaciones: [...c.operaciones, data as RamaOperacion] }
            : c
        )
      );
      await this.sincronizarTotalesCorte(corte.id);
      this.notificar('Nueva rama agregada al corte.');
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No se pudo agregar la rama.'), 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  async guardarRama(corte: CorteManual, op: RamaOperacion) {
    if (this.bloqueadoPorPlan()) return;
    this.guardando.set(true);
    try {
      const { error } = await this.db
        .from('cortes_manuales_operaciones')
        .update({
          maquina: op.maquina,
          operacion: op.operacion.trim(),
          cantidad_piezas: Math.max(0, Number(op.cantidad_piezas || 0)),
          piezas_defecto: Math.max(0, Number(op.piezas_defecto || 0)),
          pago_por_pieza: Math.max(0, Number(op.pago_por_pieza || 0)),
        })
        .eq('id', op.id);

      if (error) throw error;
      await this.sincronizarTotalesCorte(corte.id);
      this.notificar('Rama actualizada.');
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No se pudo guardar la rama.'), 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  async alternarCompletada(corte: CorteManual, op: RamaOperacion) {
    if (this.bloqueadoPorPlan()) return;
    const ibaACompletar = !op.completada;
    const nuevoEstado: EstadoTrabajo =
      ibaACompletar && corte.operaciones.every(r => (r.id === op.id ? true : r.completada))
        ? 'acabado'
        : 'en_proceso';

    this.guardando.set(true);
    try {
      const completadaEn = ibaACompletar ? new Date().toISOString() : null;
      const { error } = await this.db
        .from('cortes_manuales_operaciones')
        .update({ completada: ibaACompletar, completada_en: completadaEn })
        .eq('id', op.id);

      if (error) throw error;

      let totalCalculado = 0;
      this.cortes.update(lista => {
        const actualizada = lista.map(c => {
          if (c.id !== corte.id) return c;
          const operaciones = c.operaciones.map(r =>
            r.id === op.id ? { ...r, completada: ibaACompletar, completada_en: completadaEn } : r
          );
          totalCalculado = operaciones.reduce((acc, r) => acc + this.subtotalRama(r), 0);
          return { ...c, operaciones, estado_trabajo: nuevoEstado, monto_total: totalCalculado };
        });
        this.emitirTotalGlobal(actualizada);
        return actualizada;
      });

      await this.db
        .from('cortes_manuales')
        .update({
          estado_trabajo: nuevoEstado,
          monto_total: totalCalculado,
        })
        .eq('id', corte.id);

      if (ibaACompletar) {
        const nombreEtapa = op.operacion.trim() || op.maquina;
        this.notificar(
          `Etapa "${nombreEtapa}" marcada como acabada (+R$ ${this.subtotalRama(op).toFixed(2)}).`,
          'ok'
        );
      } else {
        const extraPago = corte.estado_pago === 'pagado' ? ' (¡Ojo: este corte figuraba como Pagado!)' : '';
        this.notificar(
          `Atención: desmarcaste "${op.operacion.trim() || op.maquina}" como acabada; se quitó del avance${extraPago}.`,
          'error'
        );
      }
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No se pudo cambiar el estado de la rama.'), 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminarRama(corte: CorteManual, op: RamaOperacion) {
    if (this.bloqueadoPorPlan()) return;
    this.guardando.set(true);
    try {
      const { error } = await this.db
        .from('cortes_manuales_operaciones')
        .delete()
        .eq('id', op.id);

      if (error) throw error;

      this.cortes.update(lista =>
        lista.map(c =>
          c.id === corte.id
            ? { ...c, operaciones: c.operaciones.filter(r => r.id !== op.id) }
            : c
        )
      );
      await this.sincronizarTotalesCorte(corte.id);
      this.notificar('Rama eliminada del corte.', 'error');
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No se pudo eliminar la rama.'), 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  async cambiarEstadoPago(corte: CorteManual, nuevoPago: EstadoPago) {
    if (this.bloqueadoPorPlan()) return;
    const anterior = corte.estado_pago;
    if (anterior === nuevoPago) return;

    this.guardando.set(true);
    try {
      const pagadoEn = nuevoPago === 'pagado' ? new Date().toISOString() : null;
      const { error } = await this.db
        .from('cortes_manuales')
        .update({ estado_pago: nuevoPago, pagado_en: pagadoEn })
        .eq('id', corte.id);

      if (error) throw error;

      this.cortes.update(lista => {
        const actualizada = lista.map(c =>
          c.id === corte.id ? { ...c, estado_pago: nuevoPago, pagado_en: pagadoEn } : c
        );
        this.emitirTotalGlobal(actualizada);
        return actualizada;
      });

      if (anterior === 'pagado' && nuevoPago !== 'pagado') {
        this.notificar(
          `Aviso: quitaste el estado "Pagado" de "${corte.descripcion}" y volvió a "${this.etiquetaPago(nuevoPago)}".`,
          'error'
        );
      } else {
        this.notificar(`Estado de cobro actualizado a "${this.etiquetaPago(nuevoPago)}".`, 'ok');
      }
    } catch (e: any) {
      this.notificar(mensajeAmigable(e, 'No se pudo actualizar el estado de cobro.'), 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  private async sincronizarTotalesCorte(corteId: string) {
    const actual = this.cortes().find(c => c.id === corteId);
    if (!actual) return;

    const total = this.totalCorte(actual);
    const todasHechas =
      actual.operaciones.length > 0 && actual.operaciones.every(r => r.completada);
    const estadoTrabajo: EstadoTrabajo = todasHechas ? 'acabado' : 'en_proceso';

    this.cortes.update(lista => {
      const actualizada = lista.map(c =>
        c.id === corteId ? { ...c, monto_total: total, estado_trabajo: estadoTrabajo } : c
      );
      this.emitirTotalGlobal(actualizada);
      return actualizada;
    });

    await this.db
      .from('cortes_manuales')
      .update({ monto_total: total, estado_trabajo: estadoTrabajo })
      .eq('id', corteId);
  }

  private notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 4000);
  }
}