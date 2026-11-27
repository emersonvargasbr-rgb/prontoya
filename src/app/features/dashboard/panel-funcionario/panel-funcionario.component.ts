import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { SocialService } from '../../../core/services/social.service';
import { PlanService } from '../../../core/services/plan.service';
import { UI, abrirWhatsApp, claseEstado, mensajeAmigable, moneda, uno } from '../../../core/utils/helpers';
import { esPlanPagoId, nombreDePlan, planVigente } from '../../../core/utils/planes';
import { IconComponent } from '../../../shared/components/icon.component';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { TabItem, TabsComponent } from '../../../shared/components/tabs.component';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';
import { SolicitudesVinculoComponent } from '../../../shared/components/solicitudes-vinculo.component';

import { ControlValesComponent } from '../../../shared/control-vales.component';
import { CortesManualesComponent } from '../../perfil/mis-ingresos/mis-ingresos.component';


type Seccion = 'resumen' | 'trabajos' | 'postulaciones' | 'anuncios' | 'insignias' | 'resenas' | 'finanzas';

export interface Insignia {
  id: string; nombre: string; descripcion: string; icono: string; desbloqueada: boolean;
}

export interface SuscripcionActiva {
  plan_id: string | null;
  expira_el: string | null;
  estado: string | null;
}

const NIVELES = [
  { desde: 0,    nombre: 'Operario Bronce' },
  { desde: 300,  nombre: 'Operario Plata' },
  { desde: 800,  nombre: 'Costurero Oro' },
  { desde: 1500, nombre: 'Especialista Diamante' },
  { desde: 3000, nombre: 'Maestro de Costura' },
];

@Component({
  selector: 'app-panel-funcionario',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IconComponent,
    AvatarComponent,
    TabsComponent,
    ToastComponent,
    SolicitudesVinculoComponent,
    CortesManualesComponent,
    ControlValesComponent,
  ],
  templateUrl: './panel-funcionario.component.html',
})
export class PanelFuncionarioComponent implements OnInit {
  readonly ui = UI;
  readonly claseEstado = claseEstado;
  readonly moneda = moneda;
  usuarioId = '';

  totalCortesManuales = signal(0);
  cargando = signal(true);
  seccion = signal<Seccion>('resumen');
  aviso = signal<Aviso | null>(null);

  perfil = signal<any>(null);
  suscripcionActiva = signal<SuscripcionActiva | null>(null);
  stats = signal({ seguidores: 0, siguiendo: 0 });
  asignaciones = signal<any[]>([]);
  postulaciones = signal<any[]>([]);
  misPublicaciones = signal<any[]>([]);
  empleadores = signal<any[]>([]);
  evaluaciones = signal<any[]>([]);

  // --------------------------------------------------------------- derivados
  trabajosActivos = computed(() => this.asignaciones().filter(a => a.estado !== 'Cerrado'));
  trabajosCerrados = computed(() => this.asignaciones().filter(a => a.estado === 'Cerrado'));

  ganado = computed(() =>
    this.trabajosCerrados().reduce((t, a) => t + Number(a.monto_neto ?? a.monto_total ?? 0), 0)
  );
  porCobrar = computed(() =>
    this.asignaciones()
      .filter(a => a.estado === 'Terminado')
      .reduce((t, a) => t + Number(a.monto_total || 0), 0)
  );

  postulacionesPendientes = computed(() => this.postulaciones().filter(p => p.estado === 'Pendiente').length);

  planIdEfectivo = computed(() => {
    const sub = this.suscripcionActiva();
    const p = this.perfil();
    const planSub = (sub?.plan_id ?? '').toLowerCase().trim();
    if (sub && esPlanPagoId(planSub) && (!sub.expira_el || new Date(sub.expira_el).getTime() > Date.now())) {
      return planSub;
    }
    return planVigente(p?.plan ?? p?.plan_id, p?.plan_vigente_hasta) ?? 'free';
  });

  esPlanPro = computed(() => esPlanPagoId(this.planIdEfectivo()) || this.plan.registroManual());

  nombrePlanActual = computed(() => {
    const id = this.planIdEfectivo();
    return id === 'free' ? 'Plan Gratis' : nombreDePlan(id);
  });

  gamificacion = computed(() => {
    const p = this.perfil();
    const cerrados = this.trabajosCerrados();
    const sinDefectos = cerrados.filter(a => !(a.piezas_defectuosas > 0)).length;

    const xp =
      this.evaluaciones().length * 150 +
      cerrados.length * 100 +
      sinDefectos * 50 +
      this.empleadores().length * 200 +
      (p?.verificado ? 300 : 0);

    let idx = NIVELES.length - 1;
    for (let i = 0; i < NIVELES.length; i++) {
      if (xp < (NIVELES[i + 1]?.desde ?? Infinity)) {
        idx = i;
        break;
      }
    }
    const actual = NIVELES[idx];
    const sig = NIVELES[idx + 1];
    const pct = sig
      ? Math.min(100, Math.floor(((xp - actual.desde) / (sig.desde - actual.desde)) * 100))
      : 100;

    return {
      xp,
      nivel: idx + 1,
      nombre: actual.nombre,
      pct,
      faltan: sig ? sig.desde - xp : 0,
      siguiente: sig?.nombre ?? null,
      sinDefectos,
    };
  });

  insignias = computed<Insignia[]>(() => {
    const p = this.perfil();
    const g = this.gamificacion();
    return [
      {
        id: 'verificado',
        nombre: 'Identidad verificada',
        icono: 'verified',
        descripcion: 'Tus datos fueron confirmados por CosturaPronta.',
        desbloqueada: !!p?.verificado,
      },
      {
        id: 'cinco',
        nombre: 'Calidad cinco estrellas',
        icono: 'star',
        descripcion: 'Promedio de 4.8 o más con al menos una reseña.',
        desbloqueada: Number(p?.promedio_estrellas) >= 4.8 && this.evaluaciones().length > 0,
      },
      {
        id: 'multi',
        nombre: 'Multi-máquina',
        icono: 'cog',
        descripcion: 'Dominas tres o más máquinas industriales.',
        desbloqueada: (p?.maquinas_maneja ?? []).length >= 3,
      },
      {
        id: 'primero',
        nombre: 'Primer trabajo',
        icono: 'briefcase',
        descripcion: 'Completaste tu primer corte en la plataforma.',
        desbloqueada: this.trabajosCerrados().length > 0,
      },
      {
        id: 'cero',
        nombre: 'Cero defectos',
        icono: 'check',
        descripcion: 'Cinco cortes liquidados sin piezas defectuosas.',
        desbloqueada: g.sinDefectos >= 5,
      },
      {
        id: 'equipo',
        nombre: 'En equipo',
        icono: 'users',
        descripcion: 'Eres parte del equipo de un taller o tienda.',
        desbloqueada: this.empleadores().length > 0,
      },
    ];
  });

  tabs = computed<TabItem[]>(() => [
    { id: 'resumen',        txt: 'Resumen',         icono: 'user' },
    { id: 'trabajos',       txt: 'Mis trabajos',    icono: 'layers',    n: this.trabajosActivos().length },
    { id: 'postulaciones',  txt: 'Postulaciones',   icono: 'briefcase', n: this.postulacionesPendientes() },
    { id: 'anuncios',       txt: 'Anuncios',        icono: 'megaphone', n: this.misPublicaciones().length },
    { id: 'finanzas',       txt: 'Cuentas y Vales', icono: 'wallet' },
    { id: 'insignias',      txt: 'Insignias',       icono: 'verified' },
    { id: 'resenas',        txt: 'Reseñas',         icono: 'star',      n: this.evaluaciones().length },
  ]);

  constructor(
    private supabaseService: SupabaseService,
    private social: SocialService,
    private router: Router,
    readonly plan: PlanService,
  ) {}

  private get db() {
    return this.supabaseService.supabase;
  }

  async ngOnInit() {
    const { data: { session } } = await this.db.auth.getSession();
    if (!session?.user) {
      this.router.navigate(['/login']);
      return;
    }
    this.usuarioId = session.user.id;
    await this.cargar();
  }

  private async cargarSuscripcionActiva(perfilId: string): Promise<SuscripcionActiva | null> {
    const { data, error } = await this.db
      .from('suscripciones')
      .select('plan_id, expira_el, estado')
      .eq('perfil_id', perfilId)
      .eq('estado', 'Activa')
      .or(`expira_el.is.null,expira_el.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error cargando suscripción activa:', error);
      return null;
    }
    return data ?? null;
  }

  async cargar() {
    this.cargando.set(true);
    const id = this.usuarioId;
    try {
      const [perf, subActiva, asig, post, pubs, emp, evals, stats] = await Promise.all([
        this.db.from('perfiles').select('*').eq('id', id).single(),
        this.cargarSuscripcionActiva(id),
        this.db
          .from('asignaciones_funcionarios')
          .select('*, empleador:empleador_id (id, nombre_completo, telefono, zona_ubicacion, rol, verificado, avatar_svg_id, avatar_icono, avatar_color, avatar_marco)')
          .eq('funcionario_id', id)
          .order('fecha_inicio', { ascending: false })
          .limit(200),
        this.db
          .from('postulaciones_lotes')
          .select(`id, estado, created_at,
            publicacion:publicacion_id (id, titulo, tipo_publicacion,
              creador:creador_id (id, nombre_completo, zona_ubicacion, telefono, verificado, avatar_svg_id, avatar_icono, avatar_color, avatar_marco))`)
          .eq('taller_id', id)
          .order('created_at', { ascending: false }),
        this.db
          .from('publicaciones')
          .select('*')
          .eq('creador_id', id)
          .order('created_at', { ascending: false }),
        this.db
          .from('empleados')
          .select('id, fecha_ingreso, empleador:empleador_id (id, nombre_completo, telefono, zona_ubicacion, rol, verificado, avatar_svg_id, avatar_icono, avatar_color, avatar_marco)')
          .eq('funcionario_id', id)
          .eq('estado', 'Activo'),
        this.db
          .from('evaluaciones')
          .select('id, estrellas, comentario, created_at, evaluador:evaluador_id (nombre_completo)')
          .eq('evaluado_id', id)
          .order('created_at', { ascending: false }),
        this.social.contar(id),
      ]);
      await this.plan.cargar();

      [perf, asig, post, pubs, emp, evals].forEach(
        r => r.error && console.error('Error cargando dato del panel de operario:', r.error)
      );

      this.perfil.set(perf.data);
      this.suscripcionActiva.set(subActiva);
      this.stats.set(stats);
      this.asignaciones.set((asig.data ?? []).map((a: any) => ({ ...a, empleador: uno(a.empleador) })));
      this.misPublicaciones.set(pubs.data ?? []);
      this.empleadores.set((emp.data ?? []).map((e: any) => ({ ...e, empleador: uno(e.empleador) })));
      this.evaluaciones.set((evals.data ?? []).map((e: any) => ({ ...e, evaluador: uno(e.evaluador) })));
      this.postulaciones.set(
        (post.data ?? [])
          .map((p: any) => {
            const pub = uno(p.publicacion) as any;
            return { ...p, publicacion: pub ? { ...pub, creador: uno(pub.creador) } : null };
          })
          .filter((p: any) => p.publicacion?.tipo_publicacion === 'busco_funcionario')
      );
    } catch (e) {
      console.error('Error cargando panel de operario:', e);
      this.notificar('No pudimos cargar tu panel en este momento. Intenta actualizar en unos segundos.', 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarEstadoLaboral() {
    const p = this.perfil();
    if (!p) return;
    const nuevo = p.estado_laboral === 'Disponible' ? 'Ocupado' : 'Disponible';
    const { error } = await this.db
      .from('perfiles')
      .update({ estado_laboral: nuevo })
      .eq('id', this.usuarioId);

    if (error) {
      console.error('Error cambiando estado laboral:', error);
      return this.notificar(
        mensajeAmigable(error, 'No pudimos actualizar tu disponibilidad. Intenta de nuevo.'),
        'error'
      );
    }

    this.perfil.set({ ...p, estado_laboral: nuevo });
    this.notificar(
      nuevo === 'Disponible'
        ? 'Ahora figuras como disponible para nuevos trabajos.'
        : 'Tu estado cambió a ocupado.'
    );
  }

  async iniciar(a: any) {
    await this.actualizarAsignacion(
      a.id,
      { estado: 'En Confección' },
      'Trabajo iniciado. ¡Mucho éxito con la confección!',
      'No pudimos marcar el trabajo como iniciado. Intenta nuevamente.'
    );
  }

  async terminar(a: any) {
    if (!confirm('¿Marcar este trabajo como terminado? Tu empleador lo revisará para liquidarlo.')) return;
    await this.actualizarAsignacion(
      a.id,
      { estado: 'Terminado', fecha_terminado: new Date().toISOString() },
      'Trabajo marcado como terminado. Queda pendiente de revisión y pago.',
      'No pudimos actualizar el estado del trabajo. Intenta nuevamente.'
    );
  }

  async retirarPostulacion(p: any) {
    if (!confirm('¿Retirar esta postulación?')) return;
    const { error } = await this.db
      .from('postulaciones_lotes')
      .delete()
      .eq('id', p.id)
      .eq('estado', 'Pendiente');

    if (error) {
      console.error('Error retirando postulación:', error);
      return this.notificar(
        mensajeAmigable(error, 'No se pudo retirar la postulación porque ya tiene respuesta.'),
        'error'
      );
    }

    this.notificar('Postulación retirada.');
    await this.cargar();
  }

  async alternarAnuncio(p: any) {
    const nuevoEstado = p.estado === 'Activo' ? 'Pausado' : 'Activo';
    const { error } = await this.db
      .from('publicaciones')
      .update({ estado: nuevoEstado })
      .eq('id', p.id);

    if (error) {
      console.error('Error cambiando estado del anuncio:', error);
      return this.notificar(
        mensajeAmigable(error, 'No pudimos cambiar el estado del anuncio.'),
        'error'
      );
    }

    this.misPublicaciones.update(list =>
      list.map(item => (item.id === p.id ? { ...item, estado: nuevoEstado } : item))
    );
    this.notificar(nuevoEstado === 'Activo' ? 'Anuncio activado.' : 'Anuncio pausado.');
  }

  async eliminarAnuncio(id: string) {
    if (!confirm('¿Eliminar este anuncio? Si ya tiene postulaciones o trabajos vinculados, no se podrá borrar.')) {
      return;
    }

    const { error } = await this.db.from('publicaciones').delete().eq('id', id);
    if (error) {
      console.error('Error eliminando anuncio:', error);
      return this.notificar(
        mensajeAmigable(
          error,
          'Este anuncio ya tiene postulaciones o registros vinculados, por lo que no se puede eliminar. Puedes pausarlo.'
        ),
        'error'
      );
    }

    this.misPublicaciones.update(l => l.filter(p => p.id !== id));
    this.notificar('Anuncio eliminado.');
  }

  private async actualizarAsignacion(
    id: string,
    cambios: object,
    ok: string,
    msgError = 'No pudimos guardar el cambio. Intenta nuevamente.'
  ) {
    const { error } = await this.db
      .from('asignaciones_funcionarios')
      .update(cambios)
      .eq('id', id);

    if (error) {
      console.error('Error actualizando asignación:', error);
      return this.notificar(mensajeAmigable(error, msgError), 'error');
    }

    this.notificar(ok);
    await this.cargar();
  }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 4000);
  }

  whatsapp(tel: string | null | undefined, nombre: string, concepto: string) {
    if (!abrirWhatsApp(tel, nombre, concepto)) {
      this.notificar('Este usuario no tiene un número de WhatsApp disponible.', 'error');
    }
  }
}