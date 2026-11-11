import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import { EstadoVinculo, SocialService } from '../../../core/services/social.service';
import { ROL_ETIQUETA, ROL_PANEL, TIPO_PUBLICACION, UI, abrirWhatsApp, moneda, uno } from '../../../core/utils/helpers';
import { calcularGamificacion, estiloPortada } from '../../../core/utils/gamificacion';
import { GamificacionComponent } from '../../../shared/components/gamificacion/gamificacion.component';
import { Aviso, ToastComponent } from '../../../shared/components/toast.component';
import { TabItem, TabsComponent } from '../../../shared/components/tabs.component';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { IconComponent } from '../../../shared/components/icon.component';


type Seccion = 'resumen' | 'insignias' | 'anuncios' | 'resenas' | 'red';

/** Sólo campos públicos: nunca documento, cnpj, cep ni correo. */
const CAMPOS_PUBLICOS = `id, nombre_completo, rol, verificado, zona_ubicacion, especialidad_principal, bio_taller, lema,
  color_portada, patron_portada, avatar_icono, avatar_color, insignias_destacadas, created_at,
  promedio_estrellas, total_evaluaciones, operaciones_cerradas, operaciones_sin_defectos, piezas_totales,
  seguidores_count, conexiones_count, equipo_count, cantidad_maquinas, cantidad_operarios, tipo_tienda,
  estado_laboral, maquinas_maneja, tiene_vehiculo, trabaja_en_casal, busca_alojamiento, alojamiento_propio,
  modalidad_trabajo, visibilidad_whatsapp`;

@Component({
  selector: 'app-vista-perfil',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, AvatarComponent, TabsComponent, ToastComponent, GamificacionComponent],
  templateUrl: './vista-perfil.component.html',
})
export class VistaPerfilComponent implements OnInit, OnDestroy {
  readonly ui = UI;
  readonly roles = ROL_ETIQUETA;
  readonly tipos = TIPO_PUBLICACION;
  readonly moneda = moneda;
  readonly estiloPortada = estiloPortada;

  private sub?: Subscription;
  yoId = '';
  perfilId = '';

  cargando = signal(true);
  noEncontrado = signal(false);
  aviso = signal<Aviso | null>(null);
  seccion = signal<Seccion>('resumen');

  perfil = signal<any>(null);
  stats = signal({ seguidores: 0, siguiendo: 0 });
  anuncios = signal<any[]>([]);
  resenas = signal<any[]>([]);
  conexiones = signal<any[]>([]);
  telefono = signal<string | null>(null);
  puedoEvaluar = signal(false);

  siguiendo = signal(false);
  vinculo = signal<{ estado: EstadoVinculo; id?: string }>({ estado: 'ninguno' });
  procesando = signal(false);

  esMio = computed(() => !!this.yoId && this.yoId === this.perfilId);
  g = computed(() => (this.perfil() ? calcularGamificacion(this.perfil()) : null));

  /** Hasta 3 insignias a la vista: las elegidas por el dueño, o las de más valor si no eligió. */
  destacadas = computed(() => {
    const x = this.g();
    if (!x) return [];
    const ganadas = x.logros.filter(l => l.desbloqueada);
    const elegidas = (this.perfil()?.insignias_destacadas ?? []) as string[];
    const sel = ganadas.filter(l => elegidas.includes(l.id));
    return (sel.length ? sel : [...ganadas].sort((a, b) => b.xp - a.xp)).slice(0, 3);
  });

  /** Distribución de estrellas para el resumen de reseñas. */
  distribucion = computed(() => {
    const lista = this.resenas();
    return [5, 4, 3, 2, 1].map(n => {
      const count = lista.filter(r => r.estrellas === n).length;
      return { n, count, pct: lista.length ? Math.round((count / lista.length) * 100) : 0 };
    });
  });

  tabs = computed<TabItem[]>(() => [
    { id: 'resumen',   txt: 'Resumen',     icono: 'user' },
    { id: 'insignias', txt: 'Insignias',   icono: 'verified',  n: this.g()?.desbloqueados ?? 0 },
    { id: 'anuncios',  txt: 'Anuncios',    icono: 'megaphone', n: this.anuncios().length },
    { id: 'resenas',   txt: 'Reseñas',     icono: 'star',      n: this.resenas().length },
    { id: 'red',       txt: 'Conexiones',  icono: 'users',     n: this.conexiones().length },
  ]);

  /** Ficha técnica según el tipo de perfil. */
  ficha = computed(() => {
    const p = this.perfil();
    if (!p) return [] as { etq: string; val: string }[];
    const f: { etq: string; val: string }[] = [];
    if (p.especialidad_principal) f.push({ etq: 'Especialidad', val: p.especialidad_principal });
    if (p.zona_ubicacion) f.push({ etq: 'Zona', val: p.zona_ubicacion });
    if (p.rol === 'tienda' && p.tipo_tienda) f.push({ etq: 'Tipo de tienda', val: p.tipo_tienda === 'ferinha' ? 'Feirinha' : 'Firma' });
    if (p.rol === 'oficina') {
      if (p.cantidad_maquinas) f.push({ etq: 'Máquinas', val: String(p.cantidad_maquinas) });
      if (p.cantidad_operarios) f.push({ etq: 'Operarios', val: String(p.cantidad_operarios) });
    }
    if (p.rol === 'funcionario') {
      f.push({ etq: 'Disponibilidad', val: p.estado_laboral ?? 'Disponible' });
      f.push({ etq: 'Modalidad', val: p.trabaja_en_casal ? 'Casal (pareja)' : (p.modalidad_trabajo ?? 'Individual') });
      f.push({ etq: 'Alojamiento', val: p.alojamiento_propio ? 'Tiene alojamiento propio' : (p.busca_alojamiento ? 'Busca cama dentro' : 'No necesita') });
      if (p.tiene_vehiculo) f.push({ etq: 'Vehículo', val: 'Sí' });
    }
    return f;
  });

  /** Cifras de trayectoria, comunes a los tres perfiles. */
  trayectoria = computed(() => {
    const p = this.perfil();
    if (!p) return [] as { etq: string; val: string }[];
    return [
      { etq: 'Trabajos cerrados', val: Number(p.operaciones_cerradas || 0).toLocaleString('pt-BR') },
      { etq: 'Piezas producidas', val: Number(p.piezas_totales || 0).toLocaleString('pt-BR') },
      { etq: p.rol === 'funcionario' ? 'Empleadores' : 'Equipo activo', val: String(p.equipo_count || 0) },
      { etq: 'En la plataforma desde', val: p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '-' },
    ];
  });

  constructor(
    private route: ActivatedRoute, private router: Router,
    private supabaseService: SupabaseService, private social: SocialService
  ) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    const { data: { user } } = await this.db.auth.getUser();
    this.yoId = user?.id ?? '';
    // reacciona si navegas de un perfil a otro sin recrear el componente
    this.sub = this.route.paramMap.subscribe(p => this.cargar(p.get('id') ?? ''));
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  async cargar(id: string) {
    if (!id) { this.noEncontrado.set(true); this.cargando.set(false); return; }
    this.perfilId = id;
    this.cargando.set(true);
    this.noEncontrado.set(false);
    this.seccion.set('resumen');
    this.telefono.set(null);
    this.puedoEvaluar.set(false);

    try {
      const [perf, anuncios, resenas, stats, conex] = await Promise.all([
        this.db.from('perfiles').select(CAMPOS_PUBLICOS).eq('id', id).maybeSingle(),
        this.db.from('publicaciones').select('id, tipo_publicacion, titulo, zona_ubicacion, cantidad_piezas, pago_por_pieza')
          .eq('creador_id', id).eq('estado', 'Activo').order('created_at', { ascending: false }),
        this.db.from('evaluaciones').select('id, estrellas, comentario, etiquetas, created_at, evaluador:evaluador_id (id, nombre_completo)')
          .eq('evaluado_id', id).order('created_at', { ascending: false }).limit(50),
        this.social.contar(id),
        this.social.misVinculos(id).catch(() => []),
      ]);

      if (!perf.data) { this.noEncontrado.set(true); return; }
      this.perfil.set(perf.data);
      this.anuncios.set(anuncios.data ?? []);
      this.resenas.set((resenas.data ?? []).map((r: any) => ({ ...r, evaluador: uno(r.evaluador) })));
      this.stats.set(stats);
      this.conexiones.set(conex);

      if (this.yoId && !this.esMio()) {
        const [v, s, ev] = await Promise.all([
          this.social.estadoVinculo(id),
          this.social.estaSiguiendo(id),
          this.db.rpc('puede_evaluar', { a: this.yoId, b: id }),
        ]);
        this.vinculo.set(v);
        this.siguiendo.set(s);
        this.puedoEvaluar.set(ev.data === true);
        await this.cargarTelefono();
      }
    } catch (e) {
      console.error(e);
      this.noEncontrado.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  /** El teléfono sólo se pide si la privacidad del perfil lo permite. */
  private async cargarTelefono() {
    const vis = this.perfil()?.visibilidad_whatsapp ?? 'publico';
    const ok = vis === 'publico' || (vis === 'conectados' && this.vinculo().estado === 'conectado');
    if (!ok) return;
    const { data } = await this.db.from('perfiles').select('telefono').eq('id', this.perfilId).maybeSingle();
    this.telefono.set(data?.telefono ?? null);
  }

  // ================================================================== ACCIONES
  private exigirSesion(): boolean {
    if (this.yoId) return true;
    this.router.navigate(['/login']);
    return false;
  }

  async alternarSeguir() {
    if (!this.exigirSesion()) return;
    this.procesando.set(true);
    try {
      const antes = this.siguiendo();
      if (antes) await this.social.dejarDeSeguir(this.perfilId); else await this.social.seguir(this.perfilId);
      const delta = antes ? -1 : 1;
      this.siguiendo.set(!antes);
      this.stats.update(s => ({ ...s, seguidores: Math.max(0, s.seguidores + delta) }));
      this.perfil.update(p => ({ ...p, seguidores_count: Math.max(0, (p.seguidores_count || 0) + delta) }));
    } catch (e: any) { this.notificar(e?.message ?? 'No se pudo actualizar.', 'error'); }
    finally { this.procesando.set(false); }
  }

  async conectar() {
    if (!this.exigirSesion()) return;
    this.procesando.set(true);
    try {
      await this.social.solicitarVinculo(this.perfilId);
      this.vinculo.set({ estado: 'enviado' });
      this.notificar('Solicitud de conexión enviada.');
    } catch (e: any) { this.notificar(e?.message ?? 'No se pudo enviar.', 'error'); }
    finally { this.procesando.set(false); }
  }

  async responder(aceptar: boolean) {
    const id = this.vinculo().id;
    if (!id) return;
    try {
      await this.social.responderVinculo(id, aceptar);
      await this.cargar(this.perfilId);
      this.notificar(aceptar ? 'Ahora están conectados.' : 'Solicitud rechazada.');
    } catch (e: any) { this.notificar(e?.message ?? 'No se pudo responder.', 'error'); }
  }

  /** Cancela una solicitud enviada o elimina una conexión existente. */
  async quitarVinculo() {
    const id = this.vinculo().id;
    if (!id) return;
    if (this.vinculo().estado === 'conectado' && !confirm('Eliminar esta conexión?')) return;
    try {
      await this.social.eliminarVinculo(id);
      await this.cargar(this.perfilId);
    } catch (e: any) { this.notificar(e?.message ?? 'No se pudo actualizar.', 'error'); }
  }

  whatsapp() {
    const p = this.perfil();
    if (!abrirWhatsApp(this.telefono(), p?.nombre_completo ?? '', 'conectar en CosturaPronta')) {
      this.notificar('Este perfil no comparte su teléfono.', 'error');
    }
  }

  irAMiPanel() { this.router.navigate([ROL_PANEL[this.perfil()?.rol] ?? '/feed']); }

  notificar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    this.aviso.set({ texto, tipo });
    setTimeout(() => this.aviso.set(null), 3500);
  }
irAtras() {
    window.history.back();
  }
}