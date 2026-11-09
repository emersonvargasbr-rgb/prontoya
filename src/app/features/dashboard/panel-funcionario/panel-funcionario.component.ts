import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { SocialService } from '../../../core/services/social.service';
import { UI, abrirWhatsApp, claseEstado, moneda, uno } from '../../../core/utils/helpers';
import { IconComponent } from '../../../shared/components/icon.component';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { TabItem, TabsComponent } from '../../../shared/components/tabs.component';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';
import { SolicitudesVinculoComponent } from '../../../shared/components/solicitudes-vinculo.component';


type Seccion = 'resumen' | 'trabajos' | 'postulaciones' | 'insignias' | 'resenas';

export interface Insignia {
  id: string; nombre: string; descripcion: string; icono: string; desbloqueada: boolean;
}

const NIVELES = [
  { desde: 0,    nombre: 'Operario Bronce' },
  { desde: 300,  nombre: 'Operario Plata' },
  { desde: 800,  nombre: 'Costurero Oro' },
  { desde: 1500, nombre: 'Especialista Diamante' },
  { desde: 3000, nombre: 'Maestro de Costura' },
];

@Component({ selector: 'app-panel-funcionario',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, AvatarComponent, TabsComponent,
            ToastComponent, SolicitudesVinculoComponent],
  templateUrl: './panel-funcionario.component.html',
})
export class PanelFuncionarioComponent implements OnInit {
  readonly ui = UI;
  readonly claseEstado = claseEstado;
  readonly moneda = moneda;
  usuarioId = '';

  cargando = signal(true);
  seccion = signal<Seccion>('resumen');
  aviso = signal<Aviso | null>(null);

  perfil = signal<any>(null);
  stats = signal({ seguidores: 0, siguiendo: 0 });
  asignaciones = signal<any[]>([]);
  postulaciones = signal<any[]>([]);
  empleadores = signal<any[]>([]);
  evaluaciones = signal<any[]>([]);

  // --------------------------------------------------------------- derivados
  trabajosActivos = computed(() => this.asignaciones().filter(a => a.estado !== 'Cerrado'));
  trabajosCerrados = computed(() => this.asignaciones().filter(a => a.estado === 'Cerrado'));

  /** Plata ya liquidada y plata que falta cobrar (trabajo terminado, sin liquidar). */
  ganado = computed(() => this.trabajosCerrados().reduce((t, a) => t + Number(a.monto_neto ?? a.monto_total ?? 0), 0));
  porCobrar = computed(() => this.asignaciones().filter(a => a.estado === 'Terminado')
    .reduce((t, a) => t + Number(a.monto_total || 0), 0));

  postulacionesPendientes = computed(() => this.postulaciones().filter(p => p.estado === 'Pendiente').length);

  /** Motor de gamificación: puntos, nivel y progreso al siguiente. */
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
      if (xp < (NIVELES[i + 1]?.desde ?? Infinity)) { idx = i; break; }
    }
    const actual = NIVELES[idx], sig = NIVELES[idx + 1];
    const pct = sig ? Math.min(100, Math.floor(((xp - actual.desde) / (sig.desde - actual.desde)) * 100)) : 100;

    return { xp, nivel: idx + 1, nombre: actual.nombre, pct, faltan: sig ? sig.desde - xp : 0, siguiente: sig?.nombre ?? null, sinDefectos };
  });

  insignias = computed<Insignia[]>(() => {
    const p = this.perfil();
    const g = this.gamificacion();
    return [
      { id: 'verificado', nombre: 'Identidad verificada', icono: 'verified',
        descripcion: 'Tus datos fueron confirmados por CosturaPronta.', desbloqueada: !!p?.verificado },
      { id: 'cinco', nombre: 'Calidad cinco estrellas', icono: 'star',
        descripcion: 'Promedio de 4.8 o más con al menos una reseña.',
        desbloqueada: Number(p?.promedio_estrellas) >= 4.8 && this.evaluaciones().length > 0 },
      { id: 'multi', nombre: 'Multi-máquina', icono: 'cog',
        descripcion: 'Dominas tres o más máquinas industriales.', desbloqueada: (p?.maquinas_maneja ?? []).length >= 3 },
      { id: 'primero', nombre: 'Primer trabajo', icono: 'briefcase',
        descripcion: 'Completaste tu primer corte en la plataforma.', desbloqueada: this.trabajosCerrados().length > 0 },
      { id: 'cero', nombre: 'Cero defectos', icono: 'check',
        descripcion: 'Cinco cortes liquidados sin piezas defectuosas.', desbloqueada: g.sinDefectos >= 5 },
      { id: 'equipo', nombre: 'En equipo', icono: 'users',
        descripcion: 'Eres parte del equipo de un taller o tienda.', desbloqueada: this.empleadores().length > 0 },
    ];
  });

  tabs = computed<TabItem[]>(() => [
    { id: 'resumen',       txt: 'Resumen',        icono: 'user' },
    { id: 'trabajos',      txt: 'Mis trabajos',   icono: 'layers',    n: this.trabajosActivos().length },
    { id: 'postulaciones', txt: 'Postulaciones',  icono: 'briefcase', n: this.postulacionesPendientes() },
    { id: 'insignias',     txt: 'Insignias',      icono: 'verified' },
    { id: 'resenas',       txt: 'Reseñas',        icono: 'star',      n: this.evaluaciones().length },
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
      const [perf, asig, post, emp, evals, stats] = await Promise.all([
        this.db.from('perfiles').select('*').eq('id', id).single(),
        this.db.from('asignaciones_funcionarios')
          .select('*, empleador:empleador_id (id, nombre_completo, telefono, zona_ubicacion, rol)')
          .eq('funcionario_id', id).order('fecha_inicio', { ascending: false }).limit(200),
        this.db.from('postulaciones_lotes')
          .select(`id, estado, created_at,
            publicacion:publicacion_id (id, titulo, tipo_publicacion,
              creador:creador_id (id, nombre_completo, zona_ubicacion, telefono, verificado))`)
          .eq('taller_id', id).order('created_at', { ascending: false }),
        this.db.from('empleados')
          .select('id, fecha_ingreso, empleador:empleador_id (id, nombre_completo, telefono, zona_ubicacion, rol)')
          .eq('funcionario_id', id).eq('estado', 'Activo'),
        this.db.from('evaluaciones')
          .select('id, estrellas, comentario, created_at, evaluador:evaluador_id (nombre_completo)')
          .eq('evaluado_id', id).order('created_at', { ascending: false }),
        this.social.contar(id),
      ]);

      [perf, asig, post, emp, evals].forEach(r => r.error && console.error(r.error));

      this.perfil.set(perf.data);
      this.stats.set(stats);
      this.asignaciones.set((asig.data ?? []).map((a: any) => ({ ...a, empleador: uno(a.empleador) })));
      this.empleadores.set((emp.data ?? []).map((e: any) => ({ ...e, empleador: uno(e.empleador) })));
      this.evaluaciones.set((evals.data ?? []).map((e: any) => ({ ...e, evaluador: uno(e.evaluador) })));
      this.postulaciones.set((post.data ?? [])
        .map((p: any) => {
          const pub = uno(p.publicacion) as any;
          return { ...p, publicacion: pub ? { ...pub, creador: uno(pub.creador) } : null };
        })
        .filter((p: any) => p.publicacion?.tipo_publicacion === 'busco_funcionario'));
    } catch (e) {
      console.error(e);
      this.notificar('No se pudieron cargar tus datos. Intenta de nuevo.', 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  // ================================================================== ACCIONES
  async cambiarEstadoLaboral() {
    const p = this.perfil();
    const nuevo = p.estado_laboral === 'Disponible' ? 'Ocupado' : 'Disponible';
    const { error } = await this.db.from('perfiles').update({ estado_laboral: nuevo }).eq('id', this.usuarioId);
    if (error) return this.notificar(error.message, 'error');
    this.perfil.set({ ...p, estado_laboral: nuevo });
  }

  async iniciar(a: any) {
    await this.actualizarAsignacion(a.id, { estado: 'En Confección' }, 'Confección iniciada.');
  }

  async terminar(a: any) {
    if (!confirm('Marcar este trabajo como terminado? Tu empleador lo revisará y liquidará.')) return;
    await this.actualizarAsignacion(a.id,
      { estado: 'Terminado', fecha_terminado: new Date().toISOString() },
      'Trabajo marcado como terminado.');
  }

  async retirarPostulacion(p: any) {
    if (!confirm('Retirar esta postulación?')) return;
    const { error } = await this.db.from('postulaciones_lotes').delete().eq('id', p.id).eq('estado', 'Pendiente');
    if (error) return this.notificar(error.message, 'error');
    this.notificar('Postulación retirada.');
    await this.cargar();
  }

  private async actualizarAsignacion(id: string, cambios: object, ok: string) {
    const { error } = await this.db.from('asignaciones_funcionarios').update(cambios).eq('id', id);
    if (error) return this.notificar(error.message, 'error');
    this.notificar(ok);
    await this.cargar();
  }

  // ==================================================================== HELPERS
  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 3500);
  }

  whatsapp(tel: string | null | undefined, nombre: string, concepto: string) {
    if (!abrirWhatsApp(tel, nombre, concepto)) this.notificar('Este usuario no tiene teléfono visible.', 'error');
  }
}