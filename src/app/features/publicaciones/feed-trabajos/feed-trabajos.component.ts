import { Component, OnInit, computed, signal } from '@angular/core';
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
export class FeedTrabajosComponent implements OnInit {
  readonly ui = UI;
  readonly zonas = ZONAS;
  readonly maquinas = MAQUINAS;
  readonly tipos = TIPO_PUBLICACION;
  readonly moneda = moneda;

  cargando = signal(true);
  error = signal(false);
  lista = signal<any[]>([]);
  visibles = signal<any[]>([]);

  usuarioId = '';
  rolUsuario = '';
  usuarioLogueado = false;
  seguidos = new Set<string>();

  mostrarModalInvitado = signal(false);
  mensajeInvitado = '';

  busquedaTexto = '';
  filtroZona = '';
  filtroTipo = '';
  filtroMaquina = '';
  soloSeguidos = false;

  /** Los tipos del selector dependen del rol (antes ofrecía opciones imposibles). */
  tiposDisponibles = computed(() => {
    const ids = this.usuarioLogueado ? (TIPOS_POR_ROL[this.rolUsuario] ?? TODOS) : TODOS;
    return ids.map(id => ({ id, ...TIPO_PUBLICACION[id] }));
  });

  constructor(private supabaseService: SupabaseService, public router: Router) {}

  private get db() { return this.supabaseService.supabase; }

  async ngOnInit() {
    await this.verificarUsuario();
    await this.cargarFeed();
  }

  private async verificarUsuario() {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) { this.usuarioLogueado = false; return; }
    this.usuarioLogueado = true;
    this.usuarioId = user.id;

    const [perfil, seg] = await Promise.all([
      this.db.from('perfiles').select('rol').eq('id', user.id).single(),
      this.db.from('seguidores').select('seguido_id').eq('seguidor_id', user.id),
    ]);
    if (perfil.data) this.rolUsuario = perfil.data.rol;
    this.seguidos = new Set((seg.data ?? []).map((s: any) => s.seguido_id));
  }

  async cargarFeed() {
    this.cargando.set(true);
    this.error.set(false);
    try {
      let query = this.db.from('publicaciones')
        .select(`id, creador_id, tipo_publicacion, titulo, descripcion, cantidad_piezas, pago_por_pieza,
          modalidad_pago, maquinas_requeridas, especialidad_taller, tipo_tejido, modalidad_alojamiento,
          puesto_trabajo, zona_ubicacion, created_at,
          creador:creador_id (id, nombre_completo, verificado, zona_ubicacion, promedio_estrellas)`)
        .eq('estado', 'Activo')
        .order('created_at', { ascending: false })
        .limit(100);

      if (this.usuarioLogueado) {
        const permitidos = TIPOS_POR_ROL[this.rolUsuario];
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

  abrirPublicacion(id: string) {
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

  irAlLogin() { this.router.navigate(['/login']); }
  irAlRegistro() { this.router.navigate(['/registro']); }
}