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

  precioConDescuento(p: Plan, cicloActual: Ciclo): number {
    const base = precio(p, cicloActual);
    if (cicloActual === 'anual') {
      return Math.round(base * 0.93);
    }
    return base;
  }

  seleccionarPlan(p: Plan) {
    this.router.navigate(['/checkout-suscripcion'], { 
      queryParams: { plan: p.id, ciclo: this.ciclo(), monto: this.precioConDescuento(p, this.ciclo()) } 
    });
  }
}