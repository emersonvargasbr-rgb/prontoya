import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { SocialService } from '../../../core/services/social.service';
import { UI, abrirWhatsApp, claseEstado, moneda, uno } from '../../../core/utils/helpers';
import { IconComponent } from '../../../shared/components/icon.component';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { TabItem, TabsComponent } from '../../../shared/components/tabs.component';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';
import { SolicitudesVinculoComponent } from '../../../shared/components/solicitudes-vinculo.component';


type Seccion = 'produccion' | 'solicitudes' | 'equipo' | 'anuncios' | 'historial';

const PERFIL_MIN = 'id, nombre_completo, rol, telefono, zona_ubicacion, verificado, promedio_estrellas';

@Component({
  selector: 'app-panel-tienda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, AvatarComponent,
            TabsComponent, ToastComponent, SolicitudesVinculoComponent],
  templateUrl: './panel-tienda.component.html',
})
export class PanelTiendaComponent implements OnInit {
  readonly ui = UI;
  readonly claseEstado = claseEstado;
  readonly moneda = moneda;
  usuarioId = '';

  cargando = signal(true);
  seccion = signal<Seccion>('produccion');
  aviso = signal<Aviso | null>(null);
  formAbierto = signal(false);

  perfil = signal<any>(null);
  stats = signal({ seguidores: 0, siguiendo: 0 });
  lotes = signal<any[]>([]);
  asignaciones = signal<any[]>([]);
  equipo = signal<any[]>([]);
  misPublicaciones = signal<any[]>([]);
  historial = signal<any[]>([]);

  nuevo = { funcionario_id: '', descripcion_corte: '', cantidad_piezas: 0, pago_por_pieza: 0 };
  private borradores: Record<string, { piezas: number; motivo: string }> = {};

  // ----------------------------------------------------------------- derivados
  /** Lotes en marcha, vengan de un anuncio mío (busco_oficina) o de una propuesta mía a un taller libre (busco_corte). */
  produccion = computed(() => this.lotes().filter(l =>
    ['Aceptado', 'En Proceso', 'Terminado'].includes(l.estado) &&
    ['busco_oficina', 'busco_corte'].includes(l.tipo)));

  /** Oficinas que se postularon a mis lotes. */
  solicitudesLotes = computed(() => this.lotes().filter(l =>
    l.estado === 'Pendiente' && !l.soyEmisor && l.tipo === 'busco_oficina'));

  candidatos = computed(() => this.lotes().filter(l =>
    l.estado === 'Pendiente' && !l.soyEmisor && l.tipo === 'busco_funcionario'));

  /** Propuestas que yo envié a talleres libres y siguen sin respuesta. */
  propuestasEnviadas = computed(() => this.lotes().filter(l =>
    l.estado === 'Pendiente' && l.soyEmisor && l.tipo === 'busco_corte'));

  pendientes = computed(() => this.solicitudesLotes().length + this.candidatos().length);
  equipoActivo = computed(() => this.equipo().filter(e => e.estado === 'Activo'));
  cortesActivos = computed(() => this.asignaciones().filter(a => !a.lote_origen_id && a.estado !== 'Cerrado'));
  cortesCerrados = computed(() => this.asignaciones().filter(a => !a.lote_origen_id && a.estado === 'Cerrado'));

  tabs = computed<TabItem[]>(() => [
    { id: 'produccion',  txt: 'Producción',  icono: 'layers',    n: this.produccion().length },
    { id: 'solicitudes', txt: 'Solicitudes', icono: 'inbox',     n: this.pendientes(), alerta: true },
    { id: 'equipo',      txt: 'Equipo',      icono: 'users',     n: this.equipoActivo().length },
    { id: 'anuncios',    txt: 'Anuncios',    icono: 'megaphone', n: this.misPublicaciones().length },
    { id: 'historial',   txt: 'Historial',   icono: 'archive',   n: this.historial().length },
  ]);

  constructor(private supabaseService: SupabaseService, private social: SocialService, private router: Router) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    const { data: { session } } = await this.db.auth.getSession();
    if (!session?.user) { this.router.navigate(['/login']); return; }
    this.usuarioId = session.user.id;
    await this.cargar();
  }

  // ===================================================================== CARGA
  async cargar() {
    this.cargando.set(true);
    const id = this.usuarioId;
    try {
      const [perf, pubs, lotes, hist, emp, asig, stats] = await Promise.all([
        this.db.from('perfiles').select('*').eq('id', id).single(),
        this.db.from('publicaciones').select('*').eq('creador_id', id).order('created_at', { ascending: false }),
        this.db.from('postulaciones_lotes').select(`
            id, estado, created_at, descripcion_corte, cantidad_piezas, pago_por_pieza,
            taller_id, receptor_id, publicacion_id,
            publicacion:publicacion_id (id, titulo, tipo_publicacion, creador_id,
              creador:creador_id (${PERFIL_MIN})),
            emisor:taller_id (${PERFIL_MIN})
          `)
          .or(`taller_id.eq.${id},receptor_id.eq.${id}`)
          .order('created_at', { ascending: false }),
        this.db.from('historial_operaciones')
          .select('*, oficina:oficina_id (nombre_completo, zona_ubicacion)')
          .eq('tienda_id', id).order('fecha_cierre', { ascending: false }),
        this.db.from('empleados')
          .select(`id, estado, fecha_ingreso,
            funcionario:funcionario_id (id, nombre_completo, telefono, especialidad_principal, promedio_estrellas, verificado, maquinas_maneja)`)
          .eq('empleador_id', id).order('fecha_ingreso', { ascending: false }),
        this.db.from('asignaciones_funcionarios')
          .select('*, funcionario:funcionario_id (id, nombre_completo, telefono)')
          .eq('empleador_id', id).order('fecha_inicio', { ascending: false }).limit(300),
        this.social.contar(id),
      ]);

      [perf, pubs, lotes, hist, emp, asig].forEach(r => r.error && console.error(r.error));

      this.perfil.set(perf.data);
      this.misPublicaciones.set(pubs.data ?? []);
      this.historial.set((hist.data ?? []).map((h: any) => ({ ...h, oficina: uno(h.oficina) })));
      this.equipo.set((emp.data ?? []).map((e: any) => ({ ...e, funcionario: uno(e.funcionario) })));
      this.asignaciones.set((asig.data ?? []).map((a: any) => ({ ...a, funcionario: uno(a.funcionario) })));
      this.stats.set(stats);

      this.lotes.set((lotes.data ?? []).map((l: any) => {
        const pub = uno(l.publicacion) as any;
        const soyEmisor = l.taller_id === id;
        return {
          ...l,
          publicacion: pub,
          tipo: pub?.tipo_publicacion,
          soyEmisor,
          // la otra parte del trato (oficina o taller), sea quien sea
          contraparte: soyEmisor ? uno(pub?.creador) : uno(l.emisor),
        };
      }));
    } catch (e) {
      console.error(e);
      this.notificar('No se pudieron cargar los datos. Intenta de nuevo.', 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  // ================================================================ SOLICITUDES
  async responderLote(l: any, aceptar: boolean) {
    const nombre = l.contraparte?.nombre_completo;
    if (!confirm(aceptar ? `Adjudicar este lote a ${nombre}?` : 'Rechazar esta solicitud?')) return;
    await this.actualizar('postulaciones_lotes', l.id, { estado: aceptar ? 'Aceptado' : 'Rechazado' },
      aceptar ? 'Lote adjudicado. La producción comienza.' : 'Solicitud rechazada.');
  }

  async cancelarPropuesta(l: any) {
    if (!confirm('Retirar esta propuesta?')) return;
    const { error } = await this.db.from('postulaciones_lotes').delete().eq('id', l.id).eq('estado', 'Pendiente');
    if (error) return this.notificar(error.message, 'error');
    this.notificar('Propuesta retirada.');
    await this.cargar();
  }

  async aprobarCandidato(c: any) {
    const nombre = c.contraparte?.nombre_completo;
    if (!confirm(`Incorporar a ${nombre} a tu equipo?`)) return;
    try {
      const { error: e1 } = await this.db.from('postulaciones_lotes').update({ estado: 'Aceptado' }).eq('id', c.id);
      if (e1) throw e1;
      const { error: e2 } = await this.db.from('empleados').upsert({
        empleador_id: this.usuarioId, funcionario_id: c.contraparte.id,
        postulacion_id: c.id, estado: 'Activo', fecha_salida: null,
      }, { onConflict: 'empleador_id,funcionario_id' });
      if (e2) throw e2;
      this.notificar(`${nombre} ya forma parte de tu equipo.`);
      await this.cargar();
    } catch (e: any) { this.notificar(e?.message ?? 'No se pudo aprobar.', 'error'); }
  }

  async rechazarCandidato(c: any) {
    if (!confirm('Rechazar esta postulación?')) return;
    await this.actualizar('postulaciones_lotes', c.id, { estado: 'Rechazado' }, 'Postulación rechazada.');
  }

  // ================================================================= PRODUCCIÓN
  /** Cierra el trato: archiva el comprobante y marca el lote como Cerrado. */
  async confirmarRecepcion(l: any) {
    if (!confirm('Confirmas que recibiste el lote conforme? Se archivará el comprobante y se cerrará el trato.')) return;
    try {
      const oficinaId = l.contraparte?.id;
      if (!oficinaId) throw new Error('No se pudo identificar la oficina del lote.');

      // evita comprobantes duplicados si se hace doble clic
      const { data: existente } = await this.db.from('historial_operaciones')
        .select('id').eq('lote_id', l.id).maybeSingle();

      if (!existente) {
        const dias = Math.max(0, Math.round((Date.now() - new Date(l.created_at).getTime()) / 86400000));
        const { error } = await this.db.from('historial_operaciones').insert({
          lote_id: l.id,
          tienda_id: this.usuarioId,
          oficina_id: oficinaId,
          descripcion_corte: l.descripcion_corte || l.publicacion?.titulo || 'Lote de confección',
          cantidad_piezas: l.cantidad_piezas,
          pago_por_pieza: l.pago_por_pieza || 0,
          monto_total: +(Number(l.cantidad_piezas || 0) * Number(l.pago_por_pieza || 0)).toFixed(2),
          dias_ejecucion: dias,
          fecha_inicio: l.created_at,
          fecha_cierre: new Date().toISOString(),
          estado_final: 'Completado',
        });
        if (error) throw error;
      }

      const { error: e2 } = await this.db.from('postulaciones_lotes').update({ estado: 'Cerrado' }).eq('id', l.id);
      if (e2) throw e2;

      this.notificar('Comprobante archivado. Ya puedes calificar al taller.');
      await this.cargar();
    } catch (e: any) { this.notificar(e?.message ?? 'No se pudo cerrar el lote.', 'error'); }
  }

  // ========================================================= OPERARIOS INTERNOS
  abrirFormulario() {
    this.nuevo = { funcionario_id: '', descripcion_corte: '', cantidad_piezas: 0, pago_por_pieza: 0 };
    this.formAbierto.set(true);
  }

  async asignarCorte() {
    const f = this.nuevo;
    const piezas = Number(f.cantidad_piezas), tarifa = Number(f.pago_por_pieza);
    if (!f.funcionario_id) return this.notificar('Elige un operario del equipo.', 'error');
    if (!f.descripcion_corte.trim()) return this.notificar('Describe el corte.', 'error');
    if (!(piezas > 0) || !(tarifa > 0)) return this.notificar('Indica piezas y tarifa mayores a cero.', 'error');
    try {
      const { error } = await this.db.from('asignaciones_funcionarios').insert({
        empleador_id: this.usuarioId,
        funcionario_id: f.funcionario_id,
        descripcion_corte: f.descripcion_corte.trim(),
        operacion_maquina: 'General',
        cantidad_piezas: piezas,
        pago_por_pieza: tarifa,
        monto_total: +(piezas * tarifa).toFixed(2),
        estado: 'Asignado',
        fecha_inicio: new Date().toISOString(),
      });
      if (error) throw error;
      this.formAbierto.set(false);
      this.notificar('Corte asignado.');
      await this.cargar();
    } catch (e: any) { this.notificar(e?.message ?? 'No se pudo asignar.', 'error'); }
  }

  async alternarTerminado(a: any) {
    if (a.estado === 'Cerrado') return;
    const terminar = a.estado !== 'Terminado';
    await this.actualizar('asignaciones_funcionarios', a.id, terminar
      ? { estado: 'Terminado', fecha_terminado: new Date().toISOString() }
      : { estado: 'En Confección', fecha_terminado: null });
  }

  borrador(a: any) {
    return (this.borradores[a.id] ??= { piezas: a.piezas_defectuosas || 0, motivo: a.motivo_descuento || '' });
  }
  descuento(a: any): number {
    return +(Math.min(this.borrador(a).piezas || 0, a.cantidad_piezas) * a.pago_por_pieza).toFixed(2);
  }
  neto(a: any): number { return +((a.monto_total || 0) - this.descuento(a)).toFixed(2); }

  async liquidar(a: any) {
    const b = this.borrador(a);
    const defect = Number(b.piezas) || 0;
    if (defect < 0 || defect > a.cantidad_piezas) return this.notificar('Piezas defectuosas fuera de rango.', 'error');
    if (defect > 0 && !b.motivo.trim()) return this.notificar('Indica el motivo del descuento.', 'error');
    if (!confirm(`Liquidar a ${a.funcionario?.nombre_completo}: ${moneda(this.neto(a))} netos?`)) return;
    await this.actualizar('asignaciones_funcionarios', a.id, {
      estado: 'Cerrado', piezas_defectuosas: defect, motivo_descuento: b.motivo.trim() || null,
      monto_descuento: this.descuento(a), monto_neto: this.neto(a), fecha_cierre: new Date().toISOString(),
    }, 'Corte liquidado.');
  }

  async quitarDelEquipo(e: any) {
    if (!confirm(`Quitar a ${e.funcionario?.nombre_completo} de tu equipo?`)) return;
    await this.actualizar('empleados', e.id, { estado: 'Inactivo', fecha_salida: new Date().toISOString() },
      'Operario retirado del equipo.');
  }

  // =================================================================== ANUNCIOS
  async alternarAnuncio(p: any) {
    await this.actualizar('publicaciones', p.id, { estado: p.estado === 'Activo' ? 'Pausado' : 'Activo' });
  }

  async eliminarAnuncio(id: string) {
    if (!confirm('Eliminar este anuncio?')) return;
    const { error } = await this.db.from('publicaciones').delete().eq('id', id);
    if (error) return this.notificar(error.message, 'error');
    this.misPublicaciones.update(l => l.filter(p => p.id !== id));
  }

  // ==================================================================== HELPERS
  private async actualizar(tabla: string, id: string, cambios: object, ok?: string) {
    try {
      const { error } = await this.db.from(tabla).update(cambios).eq('id', id);
      if (error) throw error;
      if (ok) this.notificar(ok);
      await this.cargar();
    } catch (e: any) { this.notificar(e?.message ?? 'No se pudo guardar.', 'error'); }
  }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 3500);
  }

  whatsapp(tel: string | null | undefined, nombre: string, concepto: string) {
    if (!abrirWhatsApp(tel, nombre, concepto)) this.notificar('Este usuario no tiene teléfono visible.', 'error');
  }

  etiquetaLote(l: any): string {
    return l.estado === 'Terminado' ? 'Listo para retirar' : 'En producción';
  }
}