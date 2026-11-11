import { Component, HostListener, Inject, OnDestroy, OnInit, PLATFORM_ID, computed, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { SupabaseService } from '../../core/services/supabase.service';
import { UI } from '../../core/utils/helpers';
import { calcularGamificacion } from '../../core/utils/gamificacion';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { IconComponent } from '../../shared/components/icon.component';


/** Si tu ruta del perfil público se llama distinto, cámbiala aquí. */
const RUTA_PERFIL = '/perfil-usuario';

const PANEL: Record<string, { ruta: string; txt: string; icono: string }> = {
  tienda:      { ruta: '/panel-tienda',      txt: 'Panel de tienda',  icono: 'bag' },
  oficina:     { ruta: '/panel-oficina',     txt: 'Panel del taller', icono: 'building' },
  funcionario: { ruta: '/panel-funcionario', txt: 'Panel de operario', icono: 'briefcase' },
};

/** Campos justos para pintar la tarjeta de usuario y calcular su nivel. */
const CAMPOS = `id, nombre_completo, rol, verificado, avatar_icono, avatar_color, bio_taller, lema, zona_ubicacion,
  especialidad_principal, maquinas_maneja, modalidad_trabajo, cantidad_maquinas, cantidad_operarios, tipo_tienda,
  operaciones_cerradas, operaciones_sin_defectos, piezas_totales, promedio_estrellas, total_evaluaciones,
  seguidores_count, conexiones_count, equipo_count, created_at`;

export interface NavItem {
  ruta: string | any[];
  txt: string;
  icono: string;
  /** etiqueta corta para la barra inferior del móvil */
  corto: string;
  badge?: number;
}

@Component({
  selector: 'app-sidebar-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, AvatarComponent],
  templateUrl: './sidebar-dashboard.component.html',
})
export class SidebarDashboardComponent implements OnInit, OnDestroy {
  readonly ui = UI;

  cargando = signal(true);
  usuario = signal<any>(null);
  rolCache = signal('');               // para pintar el menú al instante, antes de que responda Supabase
  pendientes = signal(0);
  expandido = signal(true);            // escritorio: ancho completo o sólo iconos
  menuMovil = signal(false);           // móvil: hoja "Más"

  logueado = computed(() => !!this.usuario());
  rol = computed(() => this.usuario()?.rol ?? this.rolCache());
  g = computed(() => (this.usuario() ? calcularGamificacion(this.usuario()) : null));

  readonly rutaPerfil = RUTA_PERFIL;

  /** Enlaces principales (comunes a escritorio y móvil). */
  items = computed<NavItem[]>(() => {
    const lista: NavItem[] = [{ ruta: '/feed', txt: 'Inicio', corto: 'Inicio', icono: 'home' }];
    const panel = PANEL[this.rol()];
    if (panel) lista.push({ ruta: panel.ruta, txt: panel.txt, corto: 'Panel', icono: panel.icono, badge: this.pendientes() });
    const u = this.usuario();
    if (u) lista.push({ ruta: [RUTA_PERFIL, u.id], txt: 'Mi perfil', corto: 'Perfil', icono: 'user' });
    return lista;
  });

  /** En el móvil el perfil tiene su propio botón, así que no va en la lista. */
  itemsMovil = computed(() => this.items().filter(i => i.corto !== 'Perfil'));

  private subs: Subscription[] = [];
  private usuarioId = '';

  constructor(
    private supabaseService: SupabaseService,
    public router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  private get db() { return this.supabaseService.supabase; }
  private get navegador() { return isPlatformBrowser(this.platformId); }

  async ngOnInit() {
    if (!this.navegador) { this.cargando.set(false); return; } // en el servidor no hay sesión

    this.rolCache.set(localStorage.getItem('rol_usuario') ?? '');
    this.expandido.set(localStorage.getItem('sidebar_expandido') !== '0');

    // El sidebar vive en el layout y no se recrea: hay que reaccionar a login y logout.
    const { data } = this.db.auth.onAuthStateChange((_evento, session) => {
      const id = session?.user?.id ?? '';
      if (id === this.usuarioId) return;               // ignora eventos repetidos (cambio de pestaña, refresh de token)
      setTimeout(() => this.cargarUsuario(), 0);        // nunca llamar a Supabase dentro del callback directamente
    });
    this.subs.push({ unsubscribe: () => data.subscription.unsubscribe() } as Subscription);

    // Actualiza los pendientes y cierra la hoja móvil al navegar.
    this.subs.push(this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.menuMovil.set(false);
      if (this.usuarioId) this.cargarPendientes();
    }));

    await this.cargarUsuario();
  }

  ngOnDestroy() { this.subs.forEach(s => s.unsubscribe()); }

  @HostListener('document:keydown.escape')
  cerrarConEscape() { this.menuMovil.set(false); }

  // ================================================================== DATOS
  private async cargarUsuario() {
    try {
      const { data: { session } } = await this.db.auth.getSession();
      if (!session?.user) { this.limpiar(); return; }

      this.usuarioId = session.user.id;
      const { data } = await this.db.from('perfiles').select(CAMPOS).eq('id', session.user.id).maybeSingle();
      if (data) {
        this.usuario.set(data);
        this.rolCache.set(data.rol);
        localStorage.setItem('rol_usuario', data.rol);
      }
      await this.cargarPendientes();
    } catch (e) {
      console.error('Error verificando usuario en el sidebar:', e);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Postulaciones y solicitudes de conexión que esperan tu respuesta. */
  private async cargarPendientes() {
    const id = this.usuarioId;
    if (!id) return;
    const [post, vinc] = await Promise.all([
      this.db.from('postulaciones_lotes').select('id', { count: 'exact', head: true }).eq('receptor_id', id).eq('estado', 'Pendiente'),
      this.db.from('vinculos').select('id', { count: 'exact', head: true }).eq('destinatario_id', id).eq('estado', 'Pendiente'),
    ]);
    this.pendientes.set((post.count ?? 0) + (vinc.count ?? 0));
  }

  private limpiar() {
    this.usuarioId = '';
    this.usuario.set(null);
    this.rolCache.set('');
    this.pendientes.set(0);
    localStorage.removeItem('rol_usuario');
  }

  // ================================================================ ACCIONES
  toggleSidebar() {
    this.expandido.update(v => !v);
    localStorage.setItem('sidebar_expandido', this.expandido() ? '1' : '0');
  }

  async cerrarSesion() {
    this.menuMovil.set(false);
    await this.db.auth.signOut();
    this.limpiar();
    this.router.navigate(['/login']);
  }
}