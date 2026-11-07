import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-feed-trabajos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './feed-trabajos.component.html'
})
export class FeedTrabajosComponent implements OnInit {
  listaTrabajos: any[] = [];
  trabajosFiltrados: any[] = [];
  cargando = true;
  rolUsuario: string = '';
  usuarioLogueado = false;

  // Control del Modal para Invitados (Guest Interceptor)
  mostrarModalInvitado = false;
  mensajeInvitado = '';

  // Filtros
  busquedaTexto: string = '';
  filtroZona: string = '';
  filtroTipo: string = '';
  filtroMaquina: string = '';

  zonasDisponibles: string[] = [
    'Brás', 'Bom Retiro', 'Pari', 'Guarulhos', 
    'Zona Leste', 'Zona Norte', 'Zona Sul', 'Osasco'
  ];

  constructor(
    private supabaseService: SupabaseService,
    public router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.verificarEstadoUsuario();
    await this.cargarFeed();
  }

  async verificarEstadoUsuario() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioLogueado = true;
      const { data } = await this.supabaseService.supabase
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single();
      if (data) this.rolUsuario = data.rol;
    } else {
      this.usuarioLogueado = false;
      this.rolUsuario = '';
    }
  }

  async cargarFeed() {
    this.cargando = true;
    try {
      let query = this.supabaseService.supabase
        .from('publicaciones')
        .select(`
          id, tipo_publicacion, titulo, descripcion, cantidad_piezas,
          pago_por_pieza, modalidad_pago, maquinas_requeridas, especialidad_taller,
          tipo_tejido, modalidad_alojamiento, modalidad_contratacion, zona_ubicacion,
          created_at, creador:creador_id (id, nombre_completo, verificado, zona_ubicacion, promedio_estrellas, avatar_svg_id)
        `)
        .eq('estado', 'Activo')
        .order('created_at', { ascending: false });

      // Si ESTÁ LOGUEADO, aplicamos el filtro por rol
      if (this.usuarioLogueado) {
        if (this.rolUsuario === 'funcionario') {
          query = query.eq('tipo_publicacion', 'busco_funcionario');
        } else if (this.rolUsuario === 'tienda') {
          query = query.in('tipo_publicacion', ['busco_corte', 'busco_trabajo']);
        } else if (this.rolUsuario === 'oficina') {
          query = query.in('tipo_publicacion', ['busco_oficina', 'busco_trabajo']);
        }
      }
      // Si ES INVITADO (no logueado), ve TODO el catálogo público en modo lectura

      const { data, error } = await query;
      if (error) throw error;

      this.listaTrabajos = (data || []).map((pub: any) => {
        const datosCreador = Array.isArray(pub.creador) ? pub.creador[0] : pub.creador;
        return {
          ...pub,
          zona: pub.zona_ubicacion || datosCreador?.zona_ubicacion || 'São Paulo - SP',
          empresa: datosCreador?.nombre_completo || 'Anunciante Textil',
          verificado: datosCreador?.verificado || false,
          promedio_estrellas: datosCreador?.promedio_estrellas || 5.0
        };
      });

      this.aplicarFiltros();
    } catch (e) {
      console.error('Error cargando el feed:', e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  aplicarFiltros() {
    const textoQuery = this.busquedaTexto.toLowerCase().trim();
    this.trabajosFiltrados = this.listaTrabajos.filter(trabajo => {
      const coincideTexto = !textoQuery || 
        trabajo.titulo.toLowerCase().includes(textoQuery) ||
        trabajo.empresa.toLowerCase().includes(textoQuery);
      const coincideZona = !this.filtroZona || trabajo.zona.toLowerCase().includes(this.filtroZona.toLowerCase());
      const coincideTipo = !this.filtroTipo || trabajo.tipo_publicacion === this.filtroTipo;
      const coincideMaquina = !this.filtroMaquina || (trabajo.maquinas_requeridas || []).includes(this.filtroMaquina);

      return coincideTexto && coincideZona && coincideTipo && coincideMaquina;
    });
    this.cdr.detectChanges();
  }

  // Interceptor para usuarios no autenticados
  abrirPublicacion(trabajoId: string) {
    if (!this.usuarioLogueado) {
      this.mensajeInvitado = 'Crea una cuenta gratuita para ver los detalles completos del trabajo y contactar al anunciante.';
      this.mostrarModalInvitado = true;
    } else {
      this.router.navigate(['/trabajo', trabajoId]);
    }
  }

  solicitarAccionInvitado(mensaje: string) {
    if (!this.usuarioLogueado) {
      this.mensajeInvitado = mensaje;
      this.mostrarModalInvitado = true;
    }
  }

  irAlLogin() {
    this.router.navigate(['/login']);
  }

  irAlRegistro() {
    this.router.navigate(['/registro']);
  }
}