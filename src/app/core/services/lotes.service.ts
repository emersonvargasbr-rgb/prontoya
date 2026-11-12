import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { uno } from '../utils/helpers';

const PERSONA = 'id, nombre_completo, verificado, telefono';

export interface LoteActivo {
  id: string;
  estado: 'Aceptado' | 'En Proceso' | 'Terminado';
  titulo: string;
  descripcion_corte: string;
  cantidad_piezas: number;
  pago_por_pieza: number;
  total: number;
  created_at: string;
  /** Quién es quién, sin importar quién envió la propuesta. */
  tiendaId: string;
  oficinaId: string;
  contraparte: any;
}

export interface FilaHistorial {
  id: string;
  titulo: string;
  contraparte: any;
  piezas: number;
  monto: number;
  fecha: string;
  detalle?: string;
  tipo: 'lote' | 'corte';
}

/**
 * Acceso a datos de lotes. Reemplaza las consultas a `lotes_asignados`
 * (tabla antigua con otras columnas) por el modelo real:
 *   postulaciones_lotes  -> lotes en curso
 *   historial_operaciones -> lotes cerrados entre tienda y oficina
 *   asignaciones_funcionarios -> cortes liquidados a operarios
 */
@Injectable({ providedIn: 'root' })
export class LotesService {
  constructor(private supabaseService: SupabaseService) {}

  private get db() { return this.supabaseService.supabase; }

  /** Lotes en curso donde participo, sea como tienda o como oficina. */
  async activos(userId: string): Promise<LoteActivo[]> {
    const { data, error } = await this.db.from('postulaciones_lotes')
      .select(`id, estado, created_at, descripcion_corte, cantidad_piezas, pago_por_pieza, taller_id, receptor_id,
        publicacion:publicacion_id (id, titulo, tipo_publicacion, creador_id, creador:creador_id (${PERSONA})),
        emisor:taller_id (${PERSONA})`)
      .or(`taller_id.eq.${userId},receptor_id.eq.${userId}`)
      .in('estado', ['Aceptado', 'En Proceso', 'Terminado'])
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? [])
      .map((l: any) => ({ l, pub: uno(l.publicacion) as any }))
      .filter(({ pub }) => pub && ['busco_oficina', 'busco_corte'].includes(pub.tipo_publicacion))
      .map(({ l, pub }) => {
        const delTienda = pub.tipo_publicacion === 'busco_oficina'; // anuncio de tienda: la oficina se postuló
        return {
          id: l.id,
          estado: l.estado,
          titulo: pub.titulo,
          descripcion_corte: l.descripcion_corte || pub.titulo,
          cantidad_piezas: l.cantidad_piezas || 0,
          pago_por_pieza: Number(l.pago_por_pieza) || 0,
          total: +((l.cantidad_piezas || 0) * (Number(l.pago_por_pieza) || 0)).toFixed(2),
          created_at: l.created_at,
          tiendaId: delTienda ? pub.creador_id : l.taller_id,
          oficinaId: delTienda ? l.taller_id : pub.creador_id,
          contraparte: l.taller_id === userId ? uno(pub.creador) : uno(l.emisor),
        } as LoteActivo;
      });
  }

  /** La oficina avisa que terminó. */
  async marcarTerminado(loteId: string) {
    const { error } = await this.db.from('postulaciones_lotes').update({ estado: 'Terminado' }).eq('id', loteId);
    if (error) throw error;
  }

  /** La tienda confirma la recepción: archiva el comprobante y cierra el trato. */
  async confirmarRecepcion(lote: LoteActivo) {
    const { data: existente } = await this.db.from('historial_operaciones').select('id').eq('lote_id', lote.id).maybeSingle();

    if (!existente) {
      const dias = Math.max(0, Math.round((Date.now() - new Date(lote.created_at).getTime()) / 86400000));
      const { error } = await this.db.from('historial_operaciones').insert({
        lote_id: lote.id,
        tienda_id: lote.tiendaId,
        oficina_id: lote.oficinaId,
        descripcion_corte: lote.descripcion_corte,
        cantidad_piezas: lote.cantidad_piezas,
        pago_por_pieza: lote.pago_por_pieza,
        monto_total: lote.total,
        dias_ejecucion: dias,
        fecha_inicio: lote.created_at,
        fecha_cierre: new Date().toISOString(),
        estado_final: 'Completado',
      });
      if (error) throw error;
    }

    const { error: e2 } = await this.db.from('postulaciones_lotes').update({ estado: 'Cerrado' }).eq('id', lote.id);
    if (e2) throw e2;
  }

  /** Historial de tienda u oficina. */
  async historialEmpresa(userId: string): Promise<FilaHistorial[]> {
    const { data, error } = await this.db.from('historial_operaciones')
      .select('id, descripcion_corte, cantidad_piezas, monto_total, fecha_cierre, tienda_id, tienda:tienda_id (id, nombre_completo), oficina:oficina_id (id, nombre_completo)')
      .or(`tienda_id.eq.${userId},oficina_id.eq.${userId}`)
      .eq('estado_final', 'Completado')
      .order('fecha_cierre', { ascending: false })
      .limit(500);
    if (error) throw error;

    return (data ?? []).map((h: any) => ({
      id: h.id,
      titulo: h.descripcion_corte,
      contraparte: h.tienda_id === userId ? uno(h.oficina) : uno(h.tienda),
      piezas: h.cantidad_piezas || 0,
      monto: Number(h.monto_total) || 0,
      fecha: h.fecha_cierre,
      tipo: 'lote' as const,
    }));
  }

  /** Historial del operario: cortes liquidados. */
  async historialOperario(userId: string): Promise<FilaHistorial[]> {
    const { data, error } = await this.db.from('asignaciones_funcionarios')
      .select('id, descripcion_corte, operacion_maquina, cantidad_piezas, piezas_defectuosas, monto_total, monto_neto, monto_descuento, fecha_cierre, empleador:empleador_id (id, nombre_completo)')
      .eq('funcionario_id', userId).eq('estado', 'Cerrado')
      .order('fecha_cierre', { ascending: false })
      .limit(500);
    if (error) throw error;

    return (data ?? []).map((a: any) => ({
      id: a.id,
      titulo: a.descripcion_corte,
      contraparte: uno(a.empleador),
      piezas: a.cantidad_piezas || 0,
      monto: Number(a.monto_neto ?? a.monto_total) || 0,
      fecha: a.fecha_cierre,
      detalle: a.monto_descuento > 0 ? `Descuento de ${Number(a.monto_descuento).toFixed(2)} por ${a.piezas_defectuosas} piezas defectuosas` : undefined,
      tipo: 'corte' as const,
    }));
  }
}
