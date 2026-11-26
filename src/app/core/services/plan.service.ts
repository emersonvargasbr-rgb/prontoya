import { Injectable, computed, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  Ciclo,
  DESCUENTO_CICLO,
  Limites,
  MESES_CICLO,
  PLANES,
  PlanId,
  calcularPrecioCiclo,
  rangoCosmeticos as calcularRango,
} from '../utils/planes';

const LIMITES_VACIOS: Limites = {
  max_operarios: 1,
  anuncios_activos_max: 3,
  anuncios_vip_mes: 0,
  cosmeticos: 'basico',
  erp_completo: false,
  reportes: false,
  registro_manual: false,
};

export interface UsoPlan {
  anunciosActivos: number;
  vipUsadosMes: number;
  operariosActivos: number;
}

export interface CotizacionSuscripcion {
  plan: string;
  nombre: string;
  ciclo: Ciclo;
  meses: number;
  descuento_pct: number;
  monto_brl_centavos: number;
  monto_usdt: number;
  tasa: number;
  receptor_binance_id: string | null;
  receptor_nombre: string | null;
  origen: 'servidor' | 'catalogo';
}

const TASA_USDT_RESPALDO = 5.8;

@Injectable({ providedIn: 'root' })
export class PlanService {
  readonly limites = signal<Limites>(LIMITES_VACIOS);
  readonly cargado = signal(false);
  readonly uso = signal<UsoPlan>({ anunciosActivos: 0, vipUsadosMes: 0, operariosActivos: 0 });

  readonly rangoCosmeticos = computed<number>(() => calcularRango(this.limites()));
  readonly erpCompleto = computed<boolean>(() => !!this.limites().erp_completo);
  readonly registroManual = computed<boolean>(() => !!this.limites().registro_manual);

  readonly maxOperarios = computed<number | null>(() => {
    const v = this.limites().max_operarios;
    return v === undefined ? 1 : v;
  });

  readonly anunciosActivosMax = computed<number | null>(() => {
    const v = this.limites().anuncios_activos_max;
    return v === undefined ? 3 : v;
  });

  readonly anunciosVipMes = computed<number | null>(() => {
    const v = this.limites().anuncios_vip_mes;
    return v === undefined ? 0 : v;
  });

  constructor(private supabaseService: SupabaseService) {}

  private get db() { return this.supabaseService.supabase; }

  async cargar(): Promise<Limites> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) {
      this.limites.set(LIMITES_VACIOS);
      this.uso.set({ anunciosActivos: 0, vipUsadosMes: 0, operariosActivos: 0 });
      this.cargado.set(true);
      return LIMITES_VACIOS;
    }

    const { data, error } = await this.db.rpc('limites_de', { pid: user.id });
    const l: Limites = !error && data && typeof data === 'object'
      ? { ...LIMITES_VACIOS, ...(data as Limites) }
      : LIMITES_VACIOS;

    this.limites.set(l);
    this.cargado.set(true);
    return l;
  }

  async cargarUso(userId?: string): Promise<UsoPlan> {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await this.db.auth.getUser();
      uid = user?.id;
    }
    if (!uid) {
      const vacio = { anunciosActivos: 0, vipUsadosMes: 0, operariosActivos: 0 };
      this.uso.set(vacio);
      return vacio;
    }

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const inicioMesMs = inicioMes.getTime();

    const [pubsRes, empRes] = await Promise.all([
      this.db
        .from('publicaciones')
        .select('id, estado, destacado, es_vip, destacado_en, created_at')
        .eq('creador_id', uid),
      this.db
        .from('empleados')
        .select('id', { count: 'exact', head: true })
        .eq('empleador_id', uid)
        .eq('estado', 'Activo'),
    ]);

    const pubs = pubsRes.data ?? [];
    const anunciosActivos = pubs.filter((p: any) =>
      ['Activo', 'Activa', 'activo', 'activa'].includes(String(p.estado ?? '').trim())
    ).length;

    const vipUsadosMes = pubs.filter((p: any) => {
      if (!(p.destacado || p.es_vip || p.destacado_en)) return false;
      const ref = p.destacado_en || p.created_at;
      return ref ? new Date(ref).getTime() >= inicioMesMs : false;
    }).length;

    const resultado: UsoPlan = {
      anunciosActivos,
      vipUsadosMes,
      operariosActivos: empRes.count ?? 0,
    };
    this.uso.set(resultado);
    return resultado;
  }

  puedePublicarAnuncio(): { ok: boolean; usados: number; tope: number | null; motivo?: string } {
    const tope = this.anunciosActivosMax();
    const usados = this.uso().anunciosActivos;
    if (tope === null) return { ok: true, usados, tope };
    if (usados >= tope) {
      return {
        ok: false,
        usados,
        tope,
        motivo: `Alcanzaste el límite de ${tope} anuncios activos de tu plan actual (${usados}/${tope}). Pausa o elimina uno, o mejora tu plan.`,
      };
    }
    return { ok: true, usados, tope };
  }

  puedeDestacarVip(): { ok: boolean; usados: number; tope: number | null; motivo?: string } {
    const tope = this.anunciosVipMes();
    const usados = this.uso().vipUsadosMes;
    if (tope === null) return { ok: true, usados, tope };
    if (tope <= 0 || usados >= tope) {
      return {
        ok: false,
        usados,
        tope,
        motivo: tope <= 0
          ? 'Tu plan actual no incluye anuncios VIP destacados.'
          : `Ya usaste tus ${tope} anuncios VIP de este mes (${usados}/${tope}).`,
      };
    }
    return { ok: true, usados, tope };
  }

  puedeAgregarOperario(): { ok: boolean; usados: number; tope: number | null; motivo?: string } {
    const tope = this.maxOperarios();
    const usados = this.uso().operariosActivos;
    if (tope === null) return { ok: true, usados, tope };
    if (tope <= 0 || usados >= tope) {
      return {
        ok: false,
        usados,
        tope,
        motivo: tope <= 0
          ? 'Tu plan actual no permite agregar operarios a un equipo.'
          : `Tu plan permite hasta ${tope} operario(s) activo(s) (${usados}/${tope}). Mejora tu plan para ampliar tu equipo.`,
      };
    }
    return { ok: true, usados, tope };
  }

  async cotizarSuscripcion(planId: string, ciclo: Ciclo): Promise<CotizacionSuscripcion> {
    const planLimpio = (planId || '').toLowerCase().trim() as PlanId;
    const planCatalogo = PLANES.find(p => p.id === planLimpio);
    if (!planCatalogo) {
      throw new Error('El plan seleccionado no es válido.');
    }

    const { data, error } = await this.db.rpc('cotizar_suscripcion', {
      p_plan: planCatalogo.id,
      p_ciclo: ciclo,
    });

    if (!error && data) {
      const c = data as any;
      return {
        plan: c.plan ?? planCatalogo.id,
        nombre: c.nombre ?? planCatalogo.nombre,
        ciclo: (c.ciclo ?? ciclo) as Ciclo,
        meses: Number(c.meses ?? MESES_CICLO[ciclo]),
        descuento_pct: Number(c.descuento_pct ?? Math.round((DESCUENTO_CICLO[ciclo] ?? 0) * 100)),
        monto_brl_centavos: Number(c.monto_brl_centavos),
        monto_usdt: Number(c.monto_usdt),
        tasa: Number(c.tasa || TASA_USDT_RESPALDO),
        receptor_binance_id: c.receptor_binance_id ?? null,
        receptor_nombre: c.receptor_nombre ?? null,
        origen: 'servidor',
      };
    }

    if (error && error.code !== 'PGRST202') {
      throw new Error(error.message || 'No se pudo cotizar el plan.');
    }

    const { data: planBd } = await this.db
      .from('planes')
      .select('id, nombre, mensual, trimestral, anual')
      .eq('id', planCatalogo.id)
      .maybeSingle();

    const mensualCentavos = Number(planBd?.mensual || planCatalogo.mensual);
    const trimestralCentavos = Number(planBd?.trimestral || planCatalogo.trimestral || calcularPrecioCiclo(mensualCentavos, 'trimestral'));
    const anualCentavos = Number(planBd?.anual || planCatalogo.anual || calcularPrecioCiclo(mensualCentavos, 'anual'));

    const montoBrlCentavos =
      ciclo === 'trimestral'
        ? trimestralCentavos
        : ciclo === 'anual'
          ? anualCentavos
          : mensualCentavos;

    const tasa = TASA_USDT_RESPALDO;
    const montoUsdt = +((montoBrlCentavos / 100) / tasa).toFixed(2);

    return {
      plan: planCatalogo.id,
      nombre: planBd?.nombre || planCatalogo.nombre,
      ciclo,
      meses: MESES_CICLO[ciclo],
      descuento_pct: Math.round((DESCUENTO_CICLO[ciclo] ?? 0) * 100),
      monto_brl_centavos: montoBrlCentavos,
      monto_usdt: montoUsdt,
      tasa,
      receptor_binance_id: null,
      receptor_nombre: 'CosturaPronta / ProntoYA',
      origen: 'catalogo',
    };
  }

  async solicitarSuscripcion(params: {
    plan: string;
    ciclo: Ciclo;
    referencia: string;
    comprobante: string | null;
    pagador: string | null;
  }) {
    const { data, error } = await this.db.rpc('solicitar_suscripcion', {
      p_plan: params.plan,
      p_ciclo: params.ciclo,
      p_referencia: params.referencia,
      p_comprobante: params.comprobante,
      p_pagador: params.pagador,
    });
    if (error) throw error;
    return data;
  }

  tope(valor: number | null | undefined): string {
    return valor === null ? 'ilimitados' : String(valor ?? 0);
  }
}