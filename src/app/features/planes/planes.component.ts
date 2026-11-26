import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { CotizacionSuscripcion, PlanService } from '../../core/services/plan.service';
import { UI, mensajeAmigable, moneda } from '../../core/utils/helpers';
import {
  Ciclo,
  DESCUENTO_CICLO,
  ETIQUETA_CICLO,
  INCLUYE_GRATIS,
  MESES_CICLO,
  PLAN_ESTILO,
  Plan,
  ahorroCiclo,
  formatoPrecio,
  grupoDeRol,
  nombreDePlan,
  planesPara,
  precio,
  resolverEstadoPlan,
} from '../../core/utils/planes';
import { IconComponent } from '../../shared/components/icon.component';

const CICLOS_ACTIVOS: Ciclo[] = ['mensual', 'trimestral', 'anual'];

@Component({
  selector: 'app-planes',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  templateUrl: './planes.component.html',
})
export class PlanesComponent implements OnInit {
  readonly ui = UI;
  readonly moneda = moneda;
  readonly estilo = PLAN_ESTILO;
  readonly formatoPrecio = formatoPrecio;
  readonly nombreDePlan = nombreDePlan;
  readonly incluyeGratis = INCLUYE_GRATIS;
  readonly etiquetaCiclo = ETIQUETA_CICLO;
  readonly descuentos = DESCUENTO_CICLO;
  readonly mesesCiclo = MESES_CICLO;
  readonly ciclos = CICLOS_ACTIVOS;

  cargando = signal(true);
  cotizando = signal(false);
  perfil = signal<any>(null);
  suscripciones = signal<any[]>([]);
  ciclo = signal<Ciclo>('trimestral');
  cotizacionPrevia = signal<CotizacionSuscripcion | null>(null);
  planSeleccionado = signal<Plan | null>(null);

  error = signal('');
  exito = signal('');

  grupo = computed(() => grupoDeRol(this.perfil()?.rol ?? ''));
  planes = computed(() => planesPara(this.perfil()?.rol ?? ''));

  estadoPlan = computed(() => resolverEstadoPlan(this.perfil(), this.suscripciones()));
  planActual = computed(() => this.estadoPlan().planId);
  vigenteHasta = computed(() => this.estadoPlan().vigenteHasta);

  docVerificado = computed(() =>
    ['verificado', 'aprobado'].includes(String(this.perfil()?.estado_documento ?? '').toLowerCase()) ||
    !!this.perfil()?.verificado,
  );

  constructor(
    private supabaseService: SupabaseService,
    readonly planService: PlanService,
    private router: Router,
  ) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) { this.router.navigate(['/login']); return; }
    await Promise.all([
      this.cargar(user.id),
      this.planService.cargar(),
      this.planService.cargarUso(user.id),
    ]);
    this.cargando.set(false);
  }

  private async cargar(id: string) {
    const [perfilRes, subsRes] = await Promise.all([
      this.db
        .from('perfiles')
        .select('id, rol, verificado, estado_documento, plan, plan_vigente_hasta')
        .eq('id', id)
        .maybeSingle(),
      this.db
        .from('suscripciones')
        .select('id, plan_id, ciclo, estado, inicia_el, expira_el, created_at')
        .eq('perfil_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    this.perfil.set(perfilRes.data ?? null);
    this.suscripciones.set(subsRes.data ?? []);
  }

  precioCiclo(p: Plan, cicloActual: Ciclo): number {
    return precio(p, cicloActual);
  }

  ahorro(p: Plan, cicloActual: Ciclo): number {
    return ahorroCiclo(p, cicloActual);
  }

  cambiarCiclo(nuevo: Ciclo) {
    if (!CICLOS_ACTIVOS.includes(nuevo)) return;
    this.ciclo.set(nuevo);
    if (this.planSeleccionado()) {
      this.abrirCotizacion(this.planSeleccionado()!);
    }
  }

  async abrirCotizacion(p: Plan) {
    this.planSeleccionado.set(p);
    this.cotizando.set(true);
    this.error.set('');
    try {
      const cot = await this.planService.cotizarSuscripcion(p.id, this.ciclo());
      this.cotizacionPrevia.set(cot);
    } catch (e: any) {
      this.error.set(mensajeAmigable(e, 'No se pudo obtener la cotización del plan.'));
    } finally {
      this.cotizando.set(false);
    }
  }

  cerrarCotizacion() {
    this.planSeleccionado.set(null);
    this.cotizacionPrevia.set(null);
  }

  continuarAlCheckout(p: Plan) {
    this.router.navigate(['/checkout-suscripcion'], {
      queryParams: { plan: p.id, ciclo: this.ciclo() },
    });
  }
}