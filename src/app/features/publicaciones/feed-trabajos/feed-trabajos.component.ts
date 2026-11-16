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

  mostrarFiltros = signal(false);
  cargando = signal(true);
  error = signal(false);
  lista = signal<any[]>([]);
  visibles = signal<any[]>([]);
  mostrarModalInvitado = signal(false);

  /** Referencia al elemento del carrusel VIP en el HTML */
  @ViewChild('carruselVip') carruselVip?: ElementRef<HTMLElement>;
  
  slideActual = signal(0);
  private intervaloCarrusel?: ReturnType<typeof setInterval>;

  /**
   * ESTADO REACTIVO. Antes eran propiedades normales (`usuarioLogueado = false`) que se cambiaban
   * después de un `await`. En una app zoneless Angular no se entera de esos cambios y, en
   * desarrollo, los detecta como NG0100 (valor distinto entre dos comprobaciones).
   * Ahora viven en signals; los getters mantienen intacto el template (`usuarioLogueado`
   * se sigue leyendo igual) pero cada lectura queda registrada como dependencia.
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

  /** Los tipos del selector dependen del rol (ahora sí se recalculan al conocer al usuario). */
  tiposDisponibles = computed(() => {
    const ids = this.logueado() ? (TIPOS_POR_ROL[this.rol()] ?? TODOS) : TODOS;
    return ids.map(id => ({ id, ...TIPO_PUBLICACION[id] }));
  });

  /** Computed para filtrar los anuncios destacados / VIP o mostrar cartel promocional si no hay ninguno */
  destacados = computed(() => {
    const todos = this.visibles();
    const vips = todos.filter(item => item.es_vip || item.destacado);
    
    if (vips.length > 0) {
      return vips.slice(0, 5);
    }

    // Cartel promocional predeterminado si la base de datos no tiene anuncios VIP activos todavía
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

  ngOnInit(): void {
    this.iniciarAutoPlayCarrusel();
  }

  ngOnDestroy(): void {
    if (this.intervaloCarrusel) {
      clearInterval(this.intervaloCarrusel);
    }
  }

  private get db() { return this.supabaseService.supabase; }

  private async inicializarDatos() {
    await this.verificarUsuario();
    await this.cargarFeed();
  }

  private async verificarUsuario() {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) { this.logueado.set(false); return; }
    this.usuarioId = user.id;

    const [perfil, seg] = await Promise.all([
      this.db.from('perfiles').select('rol').eq('id', user.id).maybeSingle(),
      this.db.from('seguidores').select('seguido_id').eq('seguidor_id', user.id),
    ]);
    this.seguidos = new Set((seg.data ?? []).map((s: any) => s.seguido_id));
    this.rol.set(perfil.data?.rol ?? '');
    this.logueado.set(true); // al final: ya están listos el rol y los seguidos
  }

  async cargarFeed() {
    this.cargando.set(true);
    this.error.set(false);
    try {
      let query = this.db.from('publicaciones')
        .select(`id, creador_id, tipo_publicacion, titulo, descripcion, cantidad_piezas, pago_por_pieza,
          modalidad_pago, maquinas_requeridas, especialidad_taller, tipo_tejido, modalidad_alojamiento,
          puesto_trabajo, zona_ubicacion, created_at, es_vip, destacado,
          creador:creador_id (id, nombre_completo, verificado, zona_ubicacion, promedio_estrellas)`)
        .eq('estado', 'Activo')
        .order('created_at', { ascending: false })
        .limit(100);

      if (this.logueado()) {
        const permitidos = TIPOS_POR_ROL[this.rol()];
        if (permitidos) query = query.in('tipo_publicacion', permitidos);
        query = query.neq('creador_id', this.usuarioId); // no mostrar mis propios anuncios
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
        };
      }));
      this.aplicarFiltros();
    } catch (e) {
      console.error(e);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  aplicarFiltros() {
    const q = this.busquedaTexto.toLowerCase().trim();
    this.visibles.set(this.lista().filter(t => {
      const texto = !q || [t.titulo, t.empresa, t.descripcion, t.puesto_trabajo].some(v => (v ?? '').toLowerCase().includes(q));
      const zona = !this.filtroZona || t.zona === this.filtroZona;
      const tipo = !this.filtroTipo || t.tipo_publicacion === this.filtroTipo;
      const maq = !this.filtroMaquina || (t.maquinas_requeridas ?? []).includes(this.filtroMaquina);
      const seg = !this.soloSeguidos || this.seguidos.has(t.creador_id);
      return texto && zona && tipo && maq && seg;
    }));
  }

  limpiarFiltros() {
    this.busquedaTexto = this.filtroZona = this.filtroTipo = this.filtroMaquina = '';
    this.soloSeguidos = false;
    this.aplicarFiltros();
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
    this.intervaloCarrusel = setInterval(() => {
      const total = this.destacados().length;
      if (total <= 1) return;
      const siguiente = (this.slideActual() + 1) % total;
      this.irASlide(siguiente);
    }, 3000); // Rota cada 3 segundos
  }

  irASlide(indice: number): void {
    this.slideActual.set(indice);
    const el = this.carruselVip?.nativeElement;
    if (el) {
      const anchoSlide = el.clientWidth + 12; // Ancho del contenedor + gap-3 (12px)
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
    // Si está verificado: Dorado / Ámbar oscuro elegante
    if (t.verificado) {
      return 'linear-gradient(to bottom right, #0f172a, #1c1917, #451a03)';
    }

    const tipo = (t.tipo_publicacion || '').toLowerCase().trim();

    if (tipo.includes('corte')) {
      return 'linear-gradient(to bottom right, #065f46, #115e59, #042f2e)'; // Verde esmeralda oscuro
    }
    if (tipo.includes('oficina')) {
      return 'linear-gradient(to bottom right, #3730a3, #581c87, #0f172a)'; // Morado / Índico
    }
    if (tipo.includes('funcionario')) {
      return 'linear-gradient(to bottom right, #1e40af, #312e81, #0f172a)'; // Azul corporativo
    }
    if (tipo.includes('trabajo')) {
      return 'linear-gradient(to bottom right, #115e59, #155e75, #0f172a)'; // Turquesa / Cian oscuro
    }

    // Respaldo por defecto (Oscuro elegante)
    return 'linear-gradient(to bottom right, #1e293b, #0f172a, #042f2e)';
  }
  irAlLogin() { this.router.navigate(['/login']); }
  irAlRegistro() { this.router.navigate(['/registro']); }
}