import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { SesionService } from '../../core/services/sesion.service';
import { UI } from '../../core/utils/helpers';
import { Ciclo, INCLUYE_GRATIS, PLAN_ESTILO, Plan, formatoPrecio, grupoDeRol, nombreDePlan, planVigente, planesPara, precio } from '../../core/utils/planes';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-planes',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  templateUrl: './planes.component.html',
})
export class PlanesComponent implements OnInit {
  readonly ui = UI;
  readonly estilo = PLAN_ESTILO;
  readonly formatoPrecio = formatoPrecio;
  readonly nombreDePlan = nombreDePlan;
  readonly incluyeGratis = INCLUYE_GRATIS;

  cargando = signal(true);
  perfil = signal<any>(null);
  ciclo = signal<Ciclo>('mensual');

  error = signal('');
  exito = signal<string>('');

  grupo = computed(() => grupoDeRol(this.perfil()?.rol ?? ''));
  planes = computed(() => planesPara(this.perfil()?.rol ?? ''));
  planActual = computed(() => planVigente(this.perfil()?.plan, this.perfil()?.plan_vigente_hasta));
  
  // Desactivado temporalmente: Siempre permite continuar
  puedeComprar = computed(() => true); 

  constructor(private supabaseService: SupabaseService, private sesion: SesionService, private router: Router) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) { this.router.navigate(['/login']); return; }
    await this.cargar(user.id);
    this.cargando.set(false);
  }

  private async cargar(id: string) {
    const { data } = await this.db.from('perfiles').select('id, rol, documento_verificado, plan, plan_vigente_hasta').eq('id', id).maybeSingle();
    this.perfil.set(data);
  }

  /**
   * Debe dar el mismo número que cotizar_suscripcion() en la base de datos:
   * anual = mensual x 12 menos el descuento. (Antes se aplicaba el 7% sobre `p.anual`, que no
   * necesariamente vale mensual x 12, y el precio mostrado podía no coincidir con el cobrado.)
   * El checkout vuelve a pedir el precio al servidor, así que lo único que importa aquí es mostrarlo igual.
   */
  private readonly DESCUENTO_ANUAL = 0.07;
  precioConDescuento(p: Plan, cicloActual: Ciclo): number {
    return cicloActual === 'anual'
      ? Math.round(p.mensual * 12 * (1 - this.DESCUENTO_ANUAL))
      : p.mensual;
  }

  seleccionarPlan(p: Plan) {
    // El monto ya no viaja por la URL: el checkout lo pide al servidor.
    this.router.navigate(['/checkout-suscripcion'], { queryParams: { plan: p.id, ciclo: this.ciclo() } });
  }
}