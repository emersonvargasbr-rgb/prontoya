import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { ROL_PANEL } from '../utils/helpers';
import { calcularGamificacion } from '../utils/gamificacion';

/** Campos justos para pintar el menú de usuario y calcular su nivel. */
const CAMPOS = `id, nombre_completo, rol, verificado, avatar_icono, avatar_color, bio_taller, lema, zona_ubicacion,
  especialidad_principal, maquinas_maneja, modalidad_trabajo, cantidad_maquinas, cantidad_operarios, tipo_tienda,
  operaciones_cerradas, operaciones_sin_defectos, piezas_totales, promedio_estrellas, total_evaluaciones,
  seguidores_count, conexiones_count, equipo_count, created_at`;

/**
 * Estado de sesión único para toda la app.
 * Header y sidebar lo leen: así hay UNA consulta de perfil y UN listener de autenticación,
 * y los dos se actualizan a la vez al iniciar o cerrar sesión.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private navegador = isPlatformBrowser(inject(PLATFORM_ID));

  readonly cargando = signal(true);
  readonly usuario = signal<any>(null);
  readonly pendientes = signal(0);
  private readonly rolCache = signal('');   // pinta el menú al instante, antes de que responda Supabase

  readonly logueado = computed(() => !!this.usuario());
  readonly rol = computed(() => this.usuario()?.rol ?? this.rolCache());
  readonly rutaPanel = computed(() => ROL_PANEL[this.rol()] ?? '/feed');
  readonly g = computed(() => (this.usuario() ? calcularGamificacion(this.usuario()) : null));

  private iniciado = false;
  private userId = '';

  private get db() { return this.supabaseService.supabase; }

  /** Idempotente: se puede llamar desde cualquier componente. */
  iniciar() {
    if (this.iniciado) return;
    this.iniciado = true;

    if (!this.navegador) { this.cargando.set(false); return; } // en el servidor no hay sesión

    this.rolCache.set(localStorage.getItem('rol_usuario') ?? '');

    this.db.auth.onAuthStateChange((_evento, session) => {
      const id = session?.user?.id ?? '';
      if (id === this.userId) return;            // ignora eventos repetidos (cambio de pestaña, refresh de token)
      setTimeout(() => this.recargar(), 0);       // nunca llamar a Supabase directamente dentro del callback
    });

    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      if (this.userId) this.cargarPendientes();
    });

    this.recargar();
  }

  async recargar() {
    try {
      const { data: { session } } = await this.db.auth.getSession();
      if (!session?.user) { this.limpiar(); return; }

      this.userId = session.user.id;
      const { data } = await this.db.from('perfiles').select(CAMPOS).eq('id', this.userId).maybeSingle();
      if (data) {
        this.usuario.set(data);
        this.rolCache.set(data.rol);
        localStorage.setItem('rol_usuario', data.rol);
      }
      await this.cargarPendientes();
    } catch (e) {
      console.error('Error cargando la sesión:', e);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Postulaciones y solicitudes de conexión que esperan tu respuesta. */
  async cargarPendientes() {
    const id = this.userId;
    if (!id) return;
    const [post, vinc] = await Promise.all([
      this.db.from('postulaciones_lotes').select('id', { count: 'exact', head: true }).eq('receptor_id', id).eq('estado', 'Pendiente'),
      this.db.from('vinculos').select('id', { count: 'exact', head: true }).eq('destinatario_id', id).eq('estado', 'Pendiente'),
    ]);
    this.pendientes.set((post.count ?? 0) + (vinc.count ?? 0));
  }

  async cerrarSesion() {
    await this.db.auth.signOut();
    this.limpiar();
  }

  private limpiar() {
    this.userId = '';
    this.usuario.set(null);
    this.rolCache.set('');
    this.pendientes.set(0);
    if (this.navegador) localStorage.removeItem('rol_usuario');
  }
}
