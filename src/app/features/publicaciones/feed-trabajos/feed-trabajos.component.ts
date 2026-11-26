import { Component, computed, signal, afterNextRender, ElementRef, ViewChild, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MAQUINAS, TIPO_PUBLICACION, UI, ZONAS, moneda, uno } from '../../../core/utils/helpers';
import { AvatarComponent } from '../../../shared/components/avatar.component';
import { IconComponent } from '../../../shared/components/icon.component';

/** Qué anuncios le sirven a cada perfil. Un invitado ve todo en modo lectura. */
const TIPOS_POR_ROL: Record<string, string[]> = {
  funcionario: ['busco_funcionario'],
  tienda:      ['busco_corte', 'busco_trabajo'],
  oficina:     ['busco_oficina', 'busco_trabajo'],
};
const TODOS = ['busco_oficina', 'busco_corte', 'busco_funcionario', 'busco_trabajo'];
const TAMANO_PAGINA = 20;
const DIAS_VIGENCIA = 7;

@Component({
  selector: 'app-feed-trabajos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent, AvatarComponent],
  templateUrl: './feed-trabajos.component.html',
})
export class FeedTrabajosComponent implements OnInit, OnDestroy {
  readonly ui = UI;
  readonly zonas = ZONAS;
  readonly maquinas = MAQUINAS;
  readonly tipos = TIPO_PUBLICACION;
  readonly moneda = moneda;
  readonly tamanoPagina = TAMANO_PAGINA;

  mostrarFiltros = signal(false);
  cargando = signal(true);
  error = signal(false);
  lista = signal<any[]>([]);
  visibles = signal<any[]>([]);
  paginaActual = signal(1);
  mostrarModalInvitado = signal(false);

  /** Referencia al elemento del carrusel VIP en el HTML */
  @ViewChild('carruselVip') carruselVip?: ElementRef<HTMLElement>;

  slideActual = signal(0);
  private intervaloCarrusel?: ReturnType<typeof setInterval>;

  /**
   * ESTADO REACTIVO con Signals para evitar conflictos NG0100 en modo zoneless.
   */
  private logueado = signal(false);
  private rol = signal('');
  get usuarioLogueado(): boolean { return this.logueado(); }
  get rolUsuario(): string { return this.rol(); }

  usuarioId = '';
  seguidos = new Set<string>();
  mensajeInvitado = '';

  busquedaTexto = '';
  filtroZona = '';
  filtroTipo = '';
  filtroMaquina = '';
  soloSeguidos = false;

  /** Los tipos del selector dependen del rol y se recalculan al conocer al usuario. */
  tiposDisponibles = computed(() => {
    const ids = this.logueado() ? (TIPOS_POR_ROL[this.rol()] ?? TODOS) : TODOS;
    return ids.map(id => ({ id, ...TIPO_PUBLICACION[id] }));
  });

  /** Total de páginas según los anuncios filtrados (20 por página). */
  totalPaginas = computed(() => Math.max(1, Math.ceil(this.visibles().length / TAMANO_PAGINA)));

  /** Subconjunto de anuncios de la página actual (máximo 20). */
  anunciosPagina = computed(() => {
    const pag = Math.min(Math.max(1, this.paginaActual()), this.totalPaginas());
    const inicio = (pag - 1) * TAMANO_PAGINA;
    return this.visibles().slice(inicio, inicio + TAMANO_PAGINA);
  });

  /** Items de paginación con separador '...' cuando hay muchas páginas. */
  itemsPaginacion = computed<(number | 'dots')[]>(() => {
    const total = this.totalPaginas();
    const actual = Math.min(Math.max(1, this.paginaActual()), total);
    if (total <= 7) {
      return Array.from({ length: total }, (_, idx) => idx + 1);
    }

    const items: (number | 'dots')[] = [1];
    const start = Math.max(2, actual - 1);
    const end = Math.min(total - 1, actual + 1);

    if (start > 2) items.push('dots');
    for (let i = start; i <= end; i++) items.push(i);
    if (end < total - 1) items.push('dots');
    items.push(total);

    return items;
  });

  /** Computed para filtrar los anuncios destacados / VIP o mostrar cartel promocional si no hay ninguno */
  destacados = computed(() => {
    const todos = this.visibles();
    const vips = todos.filter(item => item.es_vip || item.destacado);

    if (vips.length > 0) {
      return vips.slice(0, 5);
    }

    return [{
      id: 'promo-vip',
      es_promo: true,
      titulo: '¡Destaca tu taller o marca aquí!',
      empresa: 'Contrata un plan Pro/Gold o adquiere anuncios VIP para llegar a más clientes.',
      zona: 'Espacio VIP'
    }];
  });

  constructor(private supabaseService: SupabaseService, public router: Router) {
    // Sólo en el navegador: en el servidor no hay sesión y así no se pide dos veces.
    afterNextRender(() => { this.inicializarDatos(); });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.intervaloCarrusel) {
      clearInterval(this.intervaloCarrusel);
    }
  }

  private get db() { return this.supabaseService.supabase; }

  private async inicializarDatos() {
    this.iniciarAutoPlayCarrusel();
    await this.verificarUsuario();
    await this.cargarFeed();
  }

  private limpiarSesionLocal() {
    this.usuarioId = '';
    this.seguidos.clear();
    this.rol.set('');
    this.logueado.set(false);
  }

  private async verificarUsuario() {
    try {
      const { data: { session }, error: sessionError } = await this.db.auth.getSession();
      if (sessionError || !session?.user) {
        this.limpiarSesionLocal();
        return;
      }

      const { data: { user }, error: userError } = await this.db.auth.getUser();
      if (userError || !user) {
        await this.db.auth.signOut({ scope: 'local' }).catch(() => {});
        this.limpiarSesionLocal();
        return;
      }

      this.usuarioId = user.id;

      const [perfil, seg] = await Promise.all([
        this.db.from('perfiles').select('rol').eq('id', user.id).maybeSingle(),
        this.db.from('seguidores').select('seguido_id').eq('seguidor_id', user.id),
      ]);

      this.seguidos = new Set((seg.data ?? []).map((s: any) => s.seguido_id));
      this.rol.set(perfil.data?.rol ?? '');
      this.logueado.set(true);
    } catch {
      this.limpiarSesionLocal();
    }
  }

  async cargarFeed() {
    this.cargando.set(true);
    this.error.set(false);
    try {
      const limiteVigencia = new Date(Date.now() - DIAS_VIGENCIA * 24 * 60 * 60 * 1000).toISOString();

      let query = this.db.from('publicaciones')
        .select(`id, creador_id, tipo_publicacion, titulo, descripcion, cantidad_piezas, pago_por_pieza,
          modalidad_pago, maquinas_requeridas, especialidad_taller, tipo_tejido, modalidad_alojamiento,
          puesto_trabajo, zona_ubicacion, created_at, es_vip, destacado,
          creador:creador_id (id, nombre_completo, verificado, zona_ubicacion, promedio_estrellas, avatar_svg_id, avatar_icono, avatar_color, avatar_marco)`)
        .eq('estado', 'Activo')
        .gte('created_at', limiteVigencia)
        .order('created_at', { ascending: false })
        .limit(200);

      if (this.logueado()) {
        const permitidos = TIPOS_POR_ROL[this.rol()];
        if (permitidos) query = query.in('tipo_publicacion', permitidos);
        if (this.usuarioId) query = query.neq('creador_id', this.usuarioId);
      }

      const { data, error } = await query;
      if (error) throw error;

      this.lista.set((data ?? []).map((pub: any) => {
        const c = uno(pub.creador) as any;
        return {
          ...pub,
          zona: pub.zona_ubicacion || c?.zona_ubicacion || 'São Paulo',
          empresa: c?.nombre_completo || 'Anunciante',
          verificado: !!c?.verificado,
          rating: c?.promedio_estrellas ?? 0,
          icono: c?.avatar_icono || c?.avatar_svg_id || null,
          svgId: c?.avatar_svg_id ?? null,
          color: c?.avatar_color ?? null,
          marco: c?.avatar_marco ?? null,
        };
      }));
      this.aplicarFiltros(true);
    } catch (e) {
      console.error(e);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  aplicarFiltros(resetPagina = true) {
    const q = this.busquedaTexto.toLowerCase().trim();
    const filtrados = this.lista().filter(t => {
      const texto = !q || [t.titulo, t.empresa, t.descripcion, t.puesto_trabajo].some(v => (v ?? '').toLowerCase().includes(q));
      const zona = !this.filtroZona || t.zona === this.filtroZona;
      const tipo = !this.filtroTipo || t.tipo_publicacion === this.filtroTipo;
      const maq = !this.filtroMaquina || (t.maquinas_requeridas ?? []).includes(this.filtroMaquina);
      const seg = !this.soloSeguidos || this.seguidos.has(t.creador_id);
      return texto && zona && tipo && maq && seg;
    });

    this.visibles.set(filtrados);
    if (resetPagina) {
      this.paginaActual.set(1);
    } else if (this.paginaActual() > this.totalPaginas()) {
      this.paginaActual.set(this.totalPaginas());
    }
  }

  irAPagina(pagina: number) {
    const destino = Math.min(Math.max(1, pagina), this.totalPaginas());
    if (destino === this.paginaActual()) return;
    this.paginaActual.set(destino);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  limpiarFiltros() {
    this.busquedaTexto = this.filtroZona = this.filtroTipo = this.filtroMaquina = '';
    this.soloSeguidos = false;
    this.aplicarFiltros(true);
  }

  get hayFiltros(): boolean {
    return !!(this.busquedaTexto || this.filtroZona || this.filtroTipo || this.filtroMaquina || this.soloSeguidos);
  }

  esEmpleo(t: any) { return t.tipo_publicacion === 'busco_funcionario' || t.tipo_publicacion === 'busco_trabajo'; }

  /** Línea de "dato clave" de la tarjeta según el tipo de anuncio. */
  dato(t: any): string {
    if (this.esEmpleo(t)) {
      const pago = t.pago_por_pieza > 0 ? moneda(t.pago_por_pieza) : 'Pago a convenir';
      const mod = t.modalidad_pago === 'salario_mensual' ? ' mensual' : t.modalidad_pago === 'salario_semanal' ? ' semanal' : ' por pieza';
      return t.pago_por_pieza > 0 ? pago + mod : pago;
    }
    if (t.cantidad_piezas > 0) return `${Number(t.cantidad_piezas).toLocaleString('pt-BR')} piezas · ${moneda(t.pago_por_pieza)} c/u`;
    return t.especialidad_taller || 'Capacidad disponible';
  }

  /** Métodos para el control del carrusel VIP automático */
  iniciarAutoPlayCarrusel(): void {
    if (this.intervaloCarrusel) clearInterval(this.intervaloCarrusel);
    this.intervaloCarrusel = setInterval(() => {
      const total = this.destacados().length;
      if (total <= 1) return;
      const siguiente = (this.slideActual() + 1) % total;
      this.irASlide(siguiente);
    }, 3000);
  }

  irASlide(indice: number): void {
    this.slideActual.set(indice);
    const el = this.carruselVip?.nativeElement;
    if (el) {
      const anchoSlide = el.clientWidth + 12;
      el.scrollTo({ left: anchoSlide * indice, behavior: 'smooth' });
    }
  }

  onScrollCarrusel(): void {
    const el = this.carruselVip?.nativeElement;
    if (!el) return;
    const anchoSlide = el.clientWidth + 12;
    const nuevoIndice = Math.round(el.scrollLeft / anchoSlide);
    if (nuevoIndice !== this.slideActual()) {
      this.slideActual.set(nuevoIndice);
    }
  }

  abrirPublicacion(id: string) {
    if (id === 'promo-vip') {
      this.publicar();
      return;
    }
    if (!this.usuarioLogueado) {
      this.solicitarAccionInvitado('Crea una cuenta gratuita para ver los detalles y contactar al anunciante.');
      return;
    }
    this.router.navigate(['/trabajo', id]);
  }

  publicar() {
    if (this.usuarioLogueado) this.router.navigate(['/crear-publicacion']);
    else this.solicitarAccionInvitado('Regístrate para publicar tu oferta o vacante.');
  }

  solicitarAccionInvitado(mensaje: string) {
    this.mensajeInvitado = mensaje;
    this.mostrarModalInvitado.set(true);
  }

  obtenerFondoCabecera(t: any): string {
    if (t.verificado) {
      return 'linear-gradient(to bottom right, #0f172a, #1c1917, #451a03)';
    }

    const tipo = (t.tipo_publicacion || '').toLowerCase().trim();

    if (tipo.includes('corte')) {
      return 'linear-gradient(to bottom right, #065f46, #115e59, #042f2e)';
    }
    if (tipo.includes('oficina')) {
      return 'linear-gradient(to bottom right, #3730a3, #581c87, #0f172a)';
    }
    if (tipo.includes('funcionario')) {
      return 'linear-gradient(to bottom right, #1e40af, #312e81, #0f172a)';
    }
    if (tipo.includes('trabajo')) {
      return 'linear-gradient(to bottom right, #115e59, #155e75, #0f172a)';
    }

    return 'linear-gradient(to bottom right, #1e293b, #0f172a, #042f2e)';
  }

  irAlLogin() { this.router.navigate(['/login']); }
  irAlRegistro() { this.router.navigate(['/registro']); }
}