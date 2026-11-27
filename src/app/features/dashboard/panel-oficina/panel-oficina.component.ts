import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { SocialService } from '../../../core/services/social.service';
import { PlanService } from '../../../core/services/plan.service';
import { OPERACIONES, UI, abrirWhatsApp, claseEstado, mensajeAmigable, uno } from '../../../core/utils/helpers';
import { esPlanPagoId, nombreDePlan, planVigente } from '../../../core/utils/planes';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { SolicitudesVinculoComponent } from '../../../shared/components/solicitudes-vinculo.component';
import { ControlLiquidacionCarritoComponent } from '../../../shared/control-liquidacion-carrito.component';
import { CortesManualesComponent } from '../../perfil/mis-ingresos/mis-ingresos.component';


type Seccion = 'produccion' | 'solicitudes' | 'equipo' | 'anuncios' | 'historial' | 'finanzas';

const PERFIL_MIN = 'id, nombre_completo, rol, telefono, zona_ubicacion, verificado, promedio_estrellas, avatar_svg_id, avatar_icono, avatar_color, avatar_marco';

@Component({
  selector: 'app-panel-oficina',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IconComponent,
    AvatarComponent,
    SolicitudesVinculoComponent,
    ControlLiquidacionCarritoComponent,
    CortesManualesComponent,
  ],
  templateUrl: './panel-oficina.component.html',
})
export class PanelOficinaComponent implements OnInit {
  readonly ui = UI;
  readonly claseEstado = claseEstado;
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
  suscripcionActiva = signal<any>(null);
  planesCatalogo = signal<Record<string, string>>({});
  stats = signal({ seguidores: 0, siguiendo: 0 });
  lotes = signal<any[]>([]);              // todas las postulaciones donde participo
  asignaciones = signal<any[]>([]);       // sub-cortes y cortes a operarios
  equipo = signal<any[]>([]);
  misPublicaciones = signal<any[]>([]);
  historial = signal<any[]>([]);
  totalCortesManuales = signal(0);

  // ------------------------------------------------- formularios (no signals)
  nuevoSub = { funcionario_id: '', operacion_maquina: 'Overlock', cantidad_piezas: 0, pago_por_pieza: 0 };
  private borradores: Record<string, { piezas: number; motivo: string }> = {};

  // ------------------------------------------------------------- derivados
  totalGanadoPlataforma = computed(() =>
    this.historial().reduce((t, h) => t + Number(h.monto_total || 0), 0)
  );

  infoPlan = computed(() => {
    const p = this.perfil();
    const sub = this.suscripcionActiva();
    const catalogo = this.planesCatalogo();

    const subVigente =
      sub &&
      sub.estado === 'Activa' &&
      esPlanPagoId(sub.plan_id) &&
      (!sub.expira_el || new Date(sub.expira_el).getTime() > Date.now());

    const planPerfil = planVigente(p?.plan, p?.plan_vigente_hasta);
    const planId = subVigente ? sub.plan_id : (planPerfil ?? 'free');
    const esPago = esPlanPagoId(planId);
    const nombrePlan = esPago ? (catalogo[planId] || nombreDePlan(planId)) : 'Gratis';
    const inicio = subVigente ? sub.inicia_el : null;
    const vence = subVigente ? sub.expira_el : (planPerfil ? p?.plan_vigente_hasta : null);
    const estado = esPago ? (sub?.estado || 'Activa') : 'Gratis';

    return {
      planId,
      nombrePlan,
      inicio,
      vence,
      estado,
      esPago,
    };
  });

  /** Lo que la oficina está produciendo ahora (excluye vacantes de empleo). */
  produccion = computed(() =>
    this.lotes().filter(
      l =>
        ['Aceptado', 'En Proceso', 'Terminado'].includes(l.estado) &&
        !['busco_funcionario', 'busco_trabajo'].includes(l.tipo)
    )
  );

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
    })
  );

  /** Propuestas de tiendas a un anuncio mío "busco_corte". */
  ofertasRecibidas = computed(() =>
    this.lotes().filter(l => l.estado === 'Pendiente' && !l.soyEmisor && l.tipo === 'busco_corte')
  );

  /** Mis postulaciones a lotes de tiendas, esperando respuesta. */
  postulacionesEnviadas = computed(() =>
    this.lotes().filter(l => l.estado === 'Pendiente' && l.soyEmisor && l.tipo === 'busco_oficina')
  );

  candidatos = computed(() =>
    this.lotes().filter(l => l.estado === 'Pendiente' && !l.soyEmisor && l.tipo === 'busco_funcionario')
  );

  pendientes = computed(() => this.ofertasRecibidas().length + this.candidatos().length);

  equipoActivo = computed(() => this.equipo().filter(e => e.estado === 'Activo'));

  constructor(
    private supabaseService: SupabaseService,
    private social: SocialService,
    private router: Router,
    readonly plan: PlanService,
  ) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    const { data: { session } } = await this.db.auth.getSession();
    if (!session?.user) { this.router.navigate(['/login']); return; }
    this.usuarioId = session.user.id;
    await Promise.all([this.cargar(), this.plan.cargar()]);
  }

  // ===================================================================== CARGA
  async cargar() {
    this.cargando.set(true);
    const id = this.usuarioId;
    try {
      const [perf, pubs, lotes, hist, emp, asig, stats, sus, pls] = await Promise.all([
        this.db.from('perfiles').select('*').eq('id', id).single(),
        this.db.from('publicaciones').select('*').eq('creador_id', id).order('created_at', { ascending: false }),
        this.db
          .from('postulaciones_lotes')
          .select(`
            id, estado, created_at, descripcion_corte, cantidad_piezas, pago_por_pieza,
            taller_id, receptor_id, publicacion_id,
            publicacion:publicacion_id (id, titulo, tipo_publicacion, creador_id,
              creador:creador_id (${PERFIL_MIN})),
            emisor:taller_id (${PERFIL_MIN})
          `)
          .or(`taller_id.eq.${id},receptor_id.eq.${id}`)
          .order('created_at', { ascending: false }),
        this.db
          .from('historial_operaciones')
          .select('*, tienda:tienda_id (nombre_completo, zona_ubicacion)')
          .eq('oficina_id', id)
          .order('fecha_cierre', { ascending: false }),
        this.db
          .from('empleados')
          .select(`id, estado, fecha_ingreso,
            funcionario:funcionario_id (id, nombre_completo, telefono, especialidad_principal, promedio_estrellas, verificado, maquinas_maneja, avatar_svg_id, avatar_icono, avatar_color, avatar_marco)`)
          .eq('empleador_id', id)
          .order('fecha_ingreso', { ascending: false }),
        this.db
          .from('asignaciones_funcionarios')
          .select('*, funcionario:funcionario_id (id, nombre_completo, telefono, avatar_svg_id, avatar_icono, avatar_color, avatar_marco)')
          .eq('empleador_id', id)
          .order('fecha_inicio', { ascending: false })
          .limit(500),
        this.social.contar(id),
        this.db
          .from('suscripciones')
          .select('plan_id, ciclo, estado, inicia_el, expira_el')
          .eq('perfil_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        this.db.from('planes').select('id, nombre'),
      ]);

      [perf, pubs, lotes, hist, emp, asig, sus, pls].forEach(
        r => r.error && console.error('Error cargando dato del panel de taller:', r.error)
      );

      this.perfil.set(perf.data);
      this.suscripcionActiva.set(sus.data ?? null);

      const mapaPlanes: Record<string, string> = {};
      for (const item of pls.data ?? []) {
        mapaPlanes[item.id] = item.nombre;
      }
      this.planesCatalogo.set(mapaPlanes);

      this.misPublicaciones.set(pubs.data ?? []);
      this.historial.set(hist.data ?? []);
      this.equipo.set((emp.data ?? []).map((e: any) => ({ ...e, funcionario: uno(e.funcionario) })));
      this.asignaciones.set((asig.data ?? []).map((a: any) => ({ ...a, funcionario: uno(a.funcionario) })));
      this.stats.set(stats);
      await this.plan.cargarUso(id);

      this.lotes.set(
        (lotes.data ?? []).map((l: any) => {
          const pub = uno(l.publicacion);
          const emisor = uno(l.emisor);
          const soyEmisor = l.taller_id === id;
          return {
            ...l,
            publicacion: pub,
            tipo: pub?.tipo_publicacion,
            soyEmisor,
            contraparte: soyEmisor ? uno(pub?.creador) : emisor,
          };
        })
      );
    } catch (e) {
      console.error('Error cargando panel de taller:', e);
      this.notificar('No pudimos cargar tu panel en este momento. Intenta actualizar en unos segundos.', 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  // ================================================================ SOLICITUDES
  async responderLote(l: any, aceptar: boolean) {
    if (!confirm(aceptar ? '¿Aceptar este lote y comenzar la producción?' : '¿Rechazar esta propuesta?')) return;
    await this.actualizar(
      'postulaciones_lotes',
      l.id,
      { estado: aceptar ? 'Aceptado' : 'Rechazado' },
      aceptar ? 'Lote aceptado. Ya puedes asignarlo a tu equipo.' : 'Propuesta rechazada.',
      'No pudimos actualizar la respuesta del lote. Intenta nuevamente.'
    );
  }

  async aprobarCandidato(c: any) {
    const check = this.plan.puedeAgregarOperario();
    if (!check.ok) {
      return this.notificar(check.motivo || 'Alcanzaste el límite de operarios de tu plan.', 'error');
    }

    const nombre = c.contraparte?.nombre_completo || 'este operario';
    if (!confirm(`¿Sumar a ${nombre} a tu equipo?`)) return;
    try {
      const { error: e1 } = await this.db
        .from('postulaciones_lotes')
        .update({ estado: 'Aceptado' })
        .eq('id', c.id);
      if (e1) throw e1;

      const { error: e2 } = await this.db
        .from('empleados')
        .upsert(
          {
            empleador_id: this.usuarioId,
            funcionario_id: c.contraparte.id,
            postulacion_id: c.id,
            estado: 'Activo',
            fecha_salida: null,
          },
          { onConflict: 'empleador_id,funcionario_id' }
        );
      if (e2) throw e2;

      this.notificar(`${nombre} ya forma parte de tu equipo.`);
      await this.cargar();
    } catch (e: any) {
      console.error('Error al aprobar candidato:', e);
      this.notificar(
        mensajeAmigable(e, 'No pudimos sumar al operario a tu equipo. Intenta de nuevo.'),
        'error'
      );
    }
  }

  async rechazarCandidato(c: any) {
    if (!confirm('¿Rechazar esta postulación?')) return;
    await this.actualizar(
      'postulaciones_lotes',
      c.id,
      { estado: 'Rechazado' },
      'Postulación rechazada.',
      'No pudimos rechazar la postulación. Intenta nuevamente.'
    );
  }

  async quitarDelEquipo(e: any) {
    const nombre = e.funcionario?.nombre_completo || 'este operario';
    if (!confirm(`¿Quitar a ${nombre} de tu equipo activo?`)) return;
    await this.actualizar(
      'empleados',
      e.id,
      { estado: 'Inactivo', fecha_salida: new Date().toISOString() },
      `${nombre} fue retirado de tu equipo.`,
      'No pudimos retirar al operario del equipo.'
    );
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

    if (!f.funcionario_id) return this.notificar('Selecciona un operario de tu equipo.', 'error');
    if (!(piezas > 0) || !(tarifa > 0)) {
      return this.notificar('Ingresa una cantidad de piezas y una tarifa mayor a cero.', 'error');
    }

    const yaAsignadas = this.piezasAsignadas(lote, f.operacion_maquina);
    if (yaAsignadas + piezas > (lote.cantidad_piezas || 0)) {
      return this.notificar(
        `En ${f.operacion_maquina} ya asignaste ${yaAsignadas} de ${lote.cantidad_piezas} piezas del lote.`,
        'error'
      );
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
      this.notificar('Operación asignada al operario.');
      await this.cargar();
    } catch (e: any) {
      console.error('Error al asignar operación:', e);
      this.notificar(
        mensajeAmigable(e, 'No pudimos asignar la operación. Intenta de nuevo.'),
        'error'
      );
    }
  }

  async alternarTerminado(s: any) {
    if (s.estado === 'Cerrado') return;
    const terminar = s.estado !== 'Terminado';
    await this.actualizar(
      'asignaciones_funcionarios',
      s.id,
      terminar
        ? { estado: 'Terminado', fecha_terminado: new Date().toISOString() }
        : { estado: 'En Confección', fecha_terminado: null },
      terminar ? 'Operación marcada como terminada.' : 'Operación reabierta.',
      'No pudimos cambiar el estado de la operación.'
    );
  }

  borrador(s: any) {
    return (this.borradores[s.id] ??= {
      piezas: s.piezas_defectuosas || 0,
      motivo: s.motivo_descuento || '',
    });
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
    const nombre = s.funcionario?.nombre_completo || 'el operario';

    if (defect < 0 || defect > s.cantidad_piezas) {
      return this.notificar('Las piezas con falla no pueden superar el total de la operación.', 'error');
    }
    if (defect > 0 && !b.motivo.trim()) {
      return this.notificar('Indica el motivo del descuento por piezas con falla.', 'error');
    }
    if (!confirm(`¿Liquidar a ${nombre}: R$ ${this.neto(s).toFixed(2)} netos?`)) return;

    await this.actualizar(
      'asignaciones_funcionarios',
      s.id,
      {
        estado: 'Cerrado',
        piezas_defectuosas: defect,
        motivo_descuento: b.motivo.trim() || null,
        monto_descuento: this.descuento(s),
        monto_neto: this.neto(s),
        fecha_cierre: new Date().toISOString(),
      },
      'Operación liquidada.',
      'No pudimos liquidar la operación. Intenta nuevamente.'
    );
  }

  async terminarLote(l: any) {
    if (!l.todoCerrado && !confirm('Aún hay operaciones sin liquidar. ¿Marcar el lote como terminado de todas formas?')) {
      return;
    }
    await this.actualizar(
      'postulaciones_lotes',
      l.id,
      { estado: 'Terminado' },
      'Lote marcado como terminado. Ahora la tienda debe confirmar la recepción.',
      'No pudimos marcar el lote como terminado.'
    );
  }

  // ================================================================== ANUNCIOS
  async alternarAnuncio(p: any) {
    const estado = p.estado === 'Activo' ? 'Pausado' : 'Activo';
    await this.actualizar(
      'publicaciones',
      p.id,
      { estado },
      estado === 'Activo' ? 'Anuncio activado.' : 'Anuncio pausado.',
      'No pudimos cambiar el estado del anuncio.'
    );
  }

  async eliminarAnuncio(id: string) {
    if (!confirm('¿Eliminar este anuncio? Si ya tiene postulaciones o trabajos vinculados, no se podrá borrar.')) {
      return;
    }
    const { error } = await this.db.from('publicaciones').delete().eq('id', id);
    if (error) {
      console.error('Error al eliminar anuncio:', error);
      return this.notificar(
        mensajeAmigable(
          error,
          'Este anuncio ya tiene postulaciones o trabajos vinculados, por lo que no se puede eliminar. Puedes pausarlo.'
        ),
        'error'
      );
    }
    this.misPublicaciones.update(l => l.filter(p => p.id !== id));
    this.notificar('Anuncio eliminado.');
  }

  // ==================================================================== HELPERS
  private async actualizar(
    tabla: string,
    id: string,
    cambios: object,
    ok?: string,
    msgError = 'No pudimos guardar el cambio. Intenta nuevamente.'
  ) {
    try {
      const { error } = await this.db.from(tabla).update(cambios).eq('id', id);
      if (error) throw error;
      if (ok) this.notificar(ok);
      await this.cargar();
    } catch (e: any) {
      console.error(`Error actualizando ${tabla}:`, e);
      this.notificar(mensajeAmigable(e, msgError), 'error');
    }
  }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 4000);
  }

  etiquetaLote(l: any): string {
    return l.estado === 'Terminado' ? 'Esperando confirmación de la tienda' : 'En producción';
  }

  contactarWhatsApp(telefono: string | null | undefined, nombre: string, concepto: string) {
    if (!abrirWhatsApp(telefono, nombre, concepto)) {
      this.notificar('Este usuario no tiene un número de WhatsApp disponible.', 'error');
    }
  }

  irA(seccion: Seccion) { this.seccion.set(seccion); }
}