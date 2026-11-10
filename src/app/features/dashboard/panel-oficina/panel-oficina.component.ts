import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { SocialService } from '../../../core/services/social.service';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { IconComponent } from '../../../shared/components/icon.component';


type Seccion = 'produccion' | 'solicitudes' | 'equipo' | 'anuncios' | 'historial';

const PERFIL_MIN = 'id, nombre_completo, rol, telefono, zona_ubicacion, verificado, promedio_estrellas';

export const OPERACIONES = [
  'Overlock', 'Reta', 'Galoneira', 'Botoneira', 'Caseadeira', 'Travete', 'Plancha y acabados',
];

@Component({
  selector: 'app-panel-oficina',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, AvatarComponent],
  templateUrl: './panel-oficina.component.html',
})
export class PanelOficinaComponent implements OnInit {
  usuarioId = '';
  readonly operaciones = OPERACIONES;

  // ---------------------------------------------------------------- estado UI
  cargando = signal(true);
  seccion = signal<Seccion>('produccion');
  aviso = signal<{ texto: string; tipo: 'ok' | 'error' } | null>(null);
  loteAbierto = signal<string | null>(null);
  loteConFormulario = signal<string | null>(null);

  // --------------------------------------------------------------------- datos
  perfil = signal<any>(null);
  stats = signal({ seguidores: 0, siguiendo: 0 });
  lotes = signal<any[]>([]);              // todas las postulaciones donde participo
  asignaciones = signal<any[]>([]);       // sub-cortes y cortes a operarios
  equipo = signal<any[]>([]);
  misPublicaciones = signal<any[]>([]);
  historial = signal<any[]>([]);

  // ------------------------------------------------- formularios (no signals)
  nuevoSub = { funcionario_id: '', operacion_maquina: 'Overlock', cantidad_piezas: 0, pago_por_pieza: 0 };
  private borradores: Record<string, { piezas: number; motivo: string }> = {};

  // ------------------------------------------------------------- derivados
  /** Lo que la oficina está produciendo ahora (excluye vacantes de empleo). */
  produccion = computed(() =>
    this.lotes().filter(l =>
      ['Aceptado', 'En Proceso', 'Terminado'].includes(l.estado) &&
      !['busco_funcionario', 'busco_trabajo'].includes(l.tipo)));

  produccionConProgreso = computed(() =>
    this.produccion().map(l => {
      const subs = this.asignaciones().filter(a => a.lote_origen_id === l.id);
      const hechos = subs.filter(a => ['Terminado', 'Cerrado'].includes(a.estado)).length;
      return {
        ...l,
        subs,
        hechos,
        progreso: subs.length ? Math.round((hechos / subs.length) * 100) : 0,
        todoCerrado: subs.length > 0 && subs.every(a => a.estado === 'Cerrado'),
      };
    }));

  /** Propuestas de tiendas a un anuncio mío "busco_corte". */
  ofertasRecibidas = computed(() =>
    this.lotes().filter(l => l.estado === 'Pendiente' && !l.soyEmisor && l.tipo === 'busco_corte'));

  /** Mis postulaciones a lotes de tiendas, esperando respuesta. */
  postulacionesEnviadas = computed(() =>
    this.lotes().filter(l => l.estado === 'Pendiente' && l.soyEmisor && l.tipo === 'busco_oficina'));

  candidatos = computed(() =>
    this.lotes().filter(l => l.estado === 'Pendiente' && !l.soyEmisor && l.tipo === 'busco_funcionario'));

  pendientes = computed(() => this.ofertasRecibidas().length + this.candidatos().length);

  equipoActivo = computed(() => this.equipo().filter(e => e.estado === 'Activo'));

  constructor(
    private supabaseService: SupabaseService,
    private social: SocialService,
    private router: Router,
  ) {}

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
  .order('created_at', { ascending: false }),
        this.db.from('historial_operaciones')
          .select('*, tienda:tienda_id (nombre_completo, zona_ubicacion)')
          .eq('oficina_id', id).order('fecha_cierre', { ascending: false }),
        this.db.from('empleados')
          .select(`id, estado, fecha_ingreso,
            funcionario:funcionario_id (id, nombre_completo, telefono, especialidad_principal, promedio_estrellas, verificado, maquinas_maneja)`)
          .eq('empleador_id', id).order('fecha_ingreso', { ascending: false }),
        this.db.from('asignaciones_funcionarios')
          .select('*, funcionario:funcionario_id (id, nombre_completo, telefono)')
          .eq('empleador_id', id).order('fecha_inicio', { ascending: false }).limit(500),
        this.social.contar(id),
      ]);

      [perf, pubs, lotes, hist, emp, asig].forEach(r => r.error && console.error(r.error));

      this.perfil.set(perf.data);
      this.misPublicaciones.set(pubs.data ?? []);
      this.historial.set(hist.data ?? []);
      this.equipo.set((emp.data ?? []).map((e: any) => ({ ...e, funcionario: this.uno(e.funcionario) })));
      this.asignaciones.set((asig.data ?? []).map((a: any) => ({ ...a, funcionario: this.uno(a.funcionario) })));
      this.stats.set(stats);

      this.lotes.set((lotes.data ?? []).map((l: any) => {
        const pub = this.uno(l.publicacion);
        const emisor = this.uno(l.emisor);
        const soyEmisor = l.taller_id === id;
        return {
          ...l,
          publicacion: pub,
          tipo: pub?.tipo_publicacion,
          soyEmisor,
          // la otra parte del trato, sea quien sea
          contraparte: soyEmisor ? this.uno(pub?.creador) : emisor,
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
    if (!confirm(aceptar ? 'Aceptar este lote y comenzar la producción?' : 'Rechazar esta propuesta?')) return;
    await this.actualizar('postulaciones_lotes', l.id, { estado: aceptar ? 'Aceptado' : 'Rechazado' },
      aceptar ? 'Lote aceptado. Ya puedes asignarlo a tu equipo.' : 'Propuesta rechazada.');
  }

  async aprobarCandidato(c: any) {
    const nombre = c.contraparte?.nombre_completo;
    if (!confirm(`Incorporar a ${nombre} a tu equipo?`)) return;
    try {
      const { error: e1 } = await this.db.from('postulaciones_lotes').update({ estado: 'Aceptado' }).eq('id', c.id);
      if (e1) throw e1;
      const { error: e2 } = await this.db.from('empleados').upsert({
        empleador_id: this.usuarioId,
        funcionario_id: c.contraparte.id,
        postulacion_id: c.id,
        estado: 'Activo',
        fecha_salida: null,
      }, { onConflict: 'empleador_id,funcionario_id' });
      if (e2) throw e2;
      this.notificar(`${nombre} ya forma parte de tu equipo.`);
      await this.cargar();
    } catch (e: any) { this.notificar(e?.message ?? 'No se pudo aprobar al candidato.', 'error'); }
  }

  async rechazarCandidato(c: any) {
    if (!confirm('Rechazar esta postulación?')) return;
    await this.actualizar('postulaciones_lotes', c.id, { estado: 'Rechazado' }, 'Postulación rechazada.');
  }

  async quitarDelEquipo(e: any) {
    if (!confirm(`Quitar a ${e.funcionario?.nombre_completo} de tu equipo?`)) return;
    await this.actualizar('empleados', e.id,
      { estado: 'Inactivo', fecha_salida: new Date().toISOString() }, 'Operario retirado del equipo.');
  }

  // ============================================================ PRODUCCIÓN / CADENA
  toggleLote(id: string) {
    this.loteAbierto.update(v => (v === id ? null : id));
    this.loteConFormulario.set(null);
  }

  abrirFormulario(lote: any) {
    this.nuevoSub = {
      funcionario_id: '',
      operacion_maquina: 'Overlock',
      cantidad_piezas: lote.cantidad_piezas || 0,
      pago_por_pieza: 0,
    };
    this.loteConFormulario.set(lote.id);
  }

  piezasAsignadas(lote: any, operacion: string): number {
    return (lote.subs as any[])
      .filter(s => s.operacion_maquina === operacion)
      .reduce((t, s) => t + (s.cantidad_piezas || 0), 0);
  }

  async crearSubcorte(lote: any) {
    const f = this.nuevoSub;
    const piezas = Number(f.cantidad_piezas);
    const tarifa = Number(f.pago_por_pieza);

    if (!f.funcionario_id) return this.notificar('Elige un operario del equipo.', 'error');
    if (!(piezas > 0) || !(tarifa > 0)) return this.notificar('Indica piezas y tarifa mayores a cero.', 'error');

    const yaAsignadas = this.piezasAsignadas(lote, f.operacion_maquina);
    if (yaAsignadas + piezas > (lote.cantidad_piezas || 0)) {
      return this.notificar(
        `${f.operacion_maquina}: ya hay ${yaAsignadas} de ${lote.cantidad_piezas} piezas asignadas.`, 'error');
    }

    try {
      const { error } = await this.db.from('asignaciones_funcionarios').insert({
        empleador_id: this.usuarioId,
        funcionario_id: f.funcionario_id,
        lote_origen_id: lote.id,
        descripcion_corte: lote.descripcion_corte || lote.publicacion?.titulo,
        operacion_maquina: f.operacion_maquina,
        cantidad_piezas: piezas,
        pago_por_pieza: tarifa,
        monto_total: +(piezas * tarifa).toFixed(2),
        estado: 'Asignado',
        fecha_inicio: new Date().toISOString(),
      });
      if (error) throw error;
      this.loteConFormulario.set(null);
      this.notificar('Operación asignada.');
      await this.cargar();
    } catch (e: any) { this.notificar(e?.message ?? 'No se pudo asignar.', 'error'); }
  }

  /** Tachar / destachar una operación. */
  async alternarTerminado(s: any) {
    if (s.estado === 'Cerrado') return;
    const terminar = s.estado !== 'Terminado';
    await this.actualizar('asignaciones_funcionarios', s.id, terminar
      ? { estado: 'Terminado', fecha_terminado: new Date().toISOString() }
      : { estado: 'En Confección', fecha_terminado: null });
  }

  borrador(s: any) {
    return (this.borradores[s.id] ??= { piezas: s.piezas_defectuosas || 0, motivo: s.motivo_descuento || '' });
  }

  descuento(s: any): number {
    return +(Math.min(this.borrador(s).piezas || 0, s.cantidad_piezas) * s.pago_por_pieza).toFixed(2);
  }

  neto(s: any): number {
    return +((s.monto_total || 0) - this.descuento(s)).toFixed(2);
  }

  async liquidar(s: any) {
    const b = this.borrador(s);
    const defect = Number(b.piezas) || 0;
    if (defect < 0 || defect > s.cantidad_piezas) return this.notificar('Piezas defectuosas fuera de rango.', 'error');
    if (defect > 0 && !b.motivo.trim()) return this.notificar('Indica el motivo del descuento.', 'error');
    if (!confirm(`Liquidar a ${s.funcionario?.nombre_completo}: R$ ${this.neto(s).toFixed(2)} netos?`)) return;

    await this.actualizar('asignaciones_funcionarios', s.id, {
      estado: 'Cerrado',
      piezas_defectuosas: defect,
      motivo_descuento: b.motivo.trim() || null,
      monto_descuento: this.descuento(s),
      monto_neto: this.neto(s),
      fecha_cierre: new Date().toISOString(),
    }, 'Operación liquidada.');
  }

  async terminarLote(l: any) {
    if (!l.todoCerrado && !confirm('Hay operaciones sin liquidar. Marcar el lote como terminado igualmente?')) return;
    await this.actualizar('postulaciones_lotes', l.id, { estado: 'Terminado' },
      'Lote marcado como terminado. La tienda debe confirmar la recepción.');
  }

  // ================================================================== ANUNCIOS
  async alternarAnuncio(p: any) {
    const estado = p.estado === 'Activo' ? 'Pausado' : 'Activo';
    await this.actualizar('publicaciones', p.id, { estado });
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

  private uno<T>(v: T | T[] | null | undefined): T | null {
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 3500);
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case 'Asignado':      return 'bg-slate-100 text-slate-700';
      case 'En Confección':
      case 'Aceptado':
      case 'En Proceso':    return 'bg-sky-50 text-sky-700';
      case 'Terminado':     return 'bg-amber-50 text-amber-800';
      case 'Cerrado':       return 'bg-teal-50 text-teal-800';
      default:              return 'bg-slate-100 text-slate-700';
    }
  }

  etiquetaLote(l: any): string {
    return l.estado === 'Terminado' ? 'Esperando confirmación de la tienda' : 'En producción';
  }

  contactarWhatsApp(telefono: string | null | undefined, nombre: string, concepto: string) {
    if (!telefono) return this.notificar('Este usuario no tiene teléfono registrado.', 'error');
    let n = telefono.replace(/\D/g, '');
    if (n.length <= 11) n = '55' + n; // Brasil por defecto
    const msg = `Hola ${nombre}, te escribo desde CosturaPronta por: "${concepto}".`;
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  }

  irA(seccion: Seccion) { this.seccion.set(seccion); }
}