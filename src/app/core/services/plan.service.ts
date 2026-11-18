import { Injectable, computed, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Limites, rangoCosmeticos as calcularRango } from '../utils/planes';

const LIMITES_VACIOS: Limites = { cosmeticos: 'basico', erp_completo: false, registro_manual: false };

@Injectable({ providedIn: 'root' })
export class PlanService {
  readonly limites = signal<Limites>(LIMITES_VACIOS);
  readonly cargado = signal(false);

  // Usamos el helper importado con otro alias para evitar autorreferencia recursiva
  readonly rangoCosmeticos = computed<number>(() => calcularRango(this.limites()));
  readonly erpCompleto = computed<boolean>(() => !!this.limites().erp_completo);
  readonly registroManual = computed<boolean>(() => !!this.limites().registro_manual);

  constructor(private supabaseService: SupabaseService) {}

  private get db() { return this.supabaseService.supabase; }

  async cargar(): Promise<Limites> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) { this.limites.set(LIMITES_VACIOS); this.cargado.set(true); return LIMITES_VACIOS; }

    const { data, error } = await this.db.rpc('limites_de', { pid: user.id });
    const l = !error && data ? (data as Limites) : LIMITES_VACIOS;
    this.limites.set(l);
    this.cargado.set(true);
    return l;
  }

  tope(valor: number | null | undefined): string {
    return valor === null ? 'ilimitados' : String(valor ?? 0);
  }
}