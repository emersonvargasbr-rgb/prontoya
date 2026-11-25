import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { PlanService } from '../../../core/services/plan.service';
import { UI, mensajeAmigable, moneda, uno } from '../../../core/utils/helpers';
import { esPlanPagoId } from '../../../core/utils/planes';
import { IconComponent } from '../../../shared/components/icon.component';
import { CortesManualesComponent } from '../../../shared/components/cortes-manuales.component';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';

@Component({
  selector: 'app-mis-ingresos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, CortesManualesComponent, ToastComponent],
  template: `
    <div class="min-h-screen bg-stone-50 px-4 py-6 text-slate-900 pb-16">
      <app-toast [aviso]="aviso()" />

      <div class="mx-auto max-w-4xl space-y-5">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-bold">Mis ingresos y cortes particulares</h1>
            <p class="text-sm text-slate-500">Resumen mensual de tus liquidaciones en talleres y trabajos propios.</p>
          </div>
          <a routerLink="/panel-funcionario" [ngClass]="ui.btnSecundario" class="!px-3 !py-1.5 !text-xs">
            <app-icon nombre="arrow-left" clase="w-3.5 h-3.5" /> Volver a mi panel
          </a>
        </header>

        <div *ngIf="cargando()" class="grid gap-3 sm:grid-cols-3" aria-busy="true">
          <div *ngFor="let n of [1,2,3]" class="h-24 animate-pulse rounded-2xl bg-stone-200/70"></div>
        </div>

        <ng-container *ngIf="!cargando()">
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
            <label class="text-xs font-semibold text-slate-600 flex items-center gap-2">
              Mes de consulta:
              <input type="month" [ngModel]="mesFiltro()" (ngModelChange)="mesFiltro.set($event)"
                     class="rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-teal-600">
            </label>
            <button *ngIf="mesFiltro()" type="button" (click)="mesFiltro.set('')" class="text-xs font-semibold text-teal-700 hover:underline">
              Ver todo el historial
            </button>
          </div>

          <!-- Resumen financiero -->
          <dl class="grid gap-3 sm:grid-cols-3">
            <div [ngClass]="ui.card" class="p-4">
              <dt class="text-xs text-slate-500">Liquidado en plataforma</dt>
              <dd class="mt-1 text-xl font-bold text-teal-800">{{ moneda(totalPlataforma()) }}</dd>
              <p class="mt-0.5 text-[11px] text-slate-400">{{ cortesFiltrados().length }} corte(s) cerrado(s)</p>
            </div>
            <div [ngClass]="ui.card" class="p-4">
              <dt class="text-xs text-slate-500">Trabajos particulares</dt>
              <dd class="mt-1 text-xl font-bold text-amber-700">{{ moneda(totalManuales()) }}</dd>
              <p class="mt-0.5 text-[11px] text-slate-400">Cortes manuales registrados</p>
            </div>
            <div class="rounded-xl bg-slate-900 p-4 text-white">
              <dt class="text-xs text-slate-300">Total combinado</dt>
              <dd class="mt-1 text-xl font-bold text-teal-400">{{ moneda(totalPlataforma() + totalManuales()) }}</dd>
              <p class="mt-0.5 text-[11px] text-slate-400">Vales pendientes: -{{ moneda(totalValesPendientes()) }}</p>
            </div>
          </dl>

          <!-- Cortes liquidados en plataforma -->
          <section [ngClass]="ui.card" class="p-5 space-y-3">
            <h2 class="text-sm font-bold text-slate-900">Cortes liquidados en talleres</h2>
            <p *ngIf="cortesFiltrados().length === 0" class="text-xs text-slate-500">
              No hay cortes liquidados en el período seleccionado.
            </p>
            <ul *ngIf="cortesFiltrados().length > 0" class="divide-y divide-stone-100">
              <li *ngFor="let a of cortesFiltrados()" class="flex items-center justify-between gap-3 py-3 text-sm">
                <div class="min-w-0">
                  <p class="truncate font-semibold">{{ a.descripcion_corte }}</p>
                  <p class="text-xs text-slate-500">
                    {{ a.empleador?.nombre_completo || 'Taller' }} · {{ a.cantidad_piezas | number }} pzas · {{ a.fecha_cierre | date:'dd/MM/yyyy' }}
                  </p>
                </div>
                <span class="shrink-0 font-bold text-teal-800">{{ moneda(a.monto_neto ?? a.monto_total) }}</span>
              </li>
            </ul>
          </section>

          <!-- Registro manual (Operario Pro) -->
          <section *ngIf="esPro(); else bloqueado">
            <app-cortes-manuales [oficinaId]="usuarioId" (totalCambio)="totalManuales.set($event)" />
          </section>

          <ng-template #bloqueado>
            <div [ngClass]="ui.card" class="p-6 text-center space-y-3">
              <span class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <app-icon nombre="lock" clase="w-5 h-5" />
              </span>
              <h3 class="text-base font-bold">Desbloquea el registro de trabajos particulares</h3>
              <p class="mx-auto max-w-md text-xs text-slate-500">
                Con Operario Pro puedes anotar tus cortes particulares por fuera de la app y calcular tus ingresos mensuales completos.
              </p>
              <a routerLink="/planes" [ngClass]="ui.btnPrimario" class="!text-xs">Ver plan Operario Pro</a>
            </div>
          </ng-template>
        </ng-container>
      </div>
    </div>
  `,
})
export class MisIngresosComponent implements OnInit {
  readonly ui = UI;
  readonly moneda = moneda;

  usuarioId = '';
  cargando = signal(true);
  aviso = signal<Aviso | null>(null);
  mesFiltro = signal(new Date().toISOString().slice(0, 7));
  cortes = signal<any[]>([]);
  vales = signal<any[]>([]);
  totalManuales = signal(0);
  esPro = signal(false);

  cortesFiltrados = computed(() => {
    const mes = this.mesFiltro();
    return this.cortes().filter(c => !mes || String(c.fecha_cierre || '').startsWith(mes));
  });

  totalPlataforma = computed(() =>
    this.cortesFiltrados().reduce((t, c) => t + Number(c.monto_neto ?? c.monto_total ?? 0), 0)
  );

  totalValesPendientes = computed(() =>
    this.vales().filter(v => v.estado === 'Pendiente').reduce((t, v) => t + Number(v.monto || 0), 0)
  );

  constructor(
    private supabaseService: SupabaseService,
    private planService: PlanService,
    private router: Router,
  ) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.usuarioId = user.id;

    try {
      const [perf, sub, asig, vales, limites] = await Promise.all([
        this.db.from('perfiles').select('plan, plan_vigente_hasta').eq('id', user.id).maybeSingle(),
        this.db.from('suscripciones').select('plan_id, estado, expira_el').eq('perfil_id', user.id).eq('estado', 'Activa').limit(1).maybeSingle(),
        this.db.from('asignaciones_funcionarios')
          .select('id, descripcion_corte, cantidad_piezas, monto_total, monto_neto, fecha_cierre, empleador:empleador_id (nombre_completo)')
          .eq('funcionario_id', user.id)
          .eq('estado', 'Cerrado')
          .order('fecha_cierre', { ascending: false }),
        this.db.from('vales_adelantos').select('id, monto, estado, fecha').eq('funcionario_id', user.id),
        this.planService.cargar(),
      ]);

      const subActiva = sub.data && (!sub.data.expira_el || new Date(sub.data.expira_el) > new Date());
      const planPerfilActivo = esPlanPagoId(perf.data?.plan) && (!perf.data?.plan_vigente_hasta || new Date(perf.data.plan_vigente_hasta) > new Date());
      this.esPro.set(!!limites.registro_manual || !!subActiva || planPerfilActivo);

      this.cortes.set((asig.data ?? []).map((a: any) => ({ ...a, empleador: uno(a.empleador) })));
      this.vales.set(vales.data ?? []);
    } catch (e: any) {
      this.aviso.set({ texto: mensajeAmigable(e, 'No se pudo cargar tu resumen financiero.'), tipo: 'error' });
    } finally {
      this.cargando.set(false);
    }
  }
}
