import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-panel-tienda',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './panel-tienda.component.html'
})
export class PanelTiendaComponent implements OnInit {
  usuarioId: string = '';
  cargando = true;
  pestanaActiva: 'solicitudes' | 'en_proceso' | 'mis_publicaciones' = 'solicitudes';

  perfil: any = null;
  solicitudesPendientes: any[] = [];
  lotesEnProceso: any[] = [];
  misPublicaciones: any[] = [];

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioId = user.id;
      await this.cargarDatosPanel();
    } else {
      this.router.navigate(['/login']);
    }
  }

  async cargarDatosPanel() {
    this.cargando = true;
    try {
      // 0. Cargar Perfil Pro de la Tienda (portada, avatar svg, estrellas, CNPJ, etc.)
      const { data: perfData } = await this.supabaseService.supabase
        .from('perfiles')
        .select('*')
        .eq('id', this.usuarioId)
        .single();

      if (perfData) {
        this.perfil = perfData;
      }

      // 1. Solicitudes entrantes de talleres para los lotes de esta tienda
      const { data: postulaciones } = await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .select(`
          id,
          created_at,
          estado,
          publicacion:publicacion_id (id, titulo, cantidad_piezas, pago_por_pieza, creador_id),
          taller:taller_id (id, nombre_completo, zona_ubicacion, verificado, promedio_estrellas, telefono, avatar_svg_id)
        `)
        .eq('estado', 'Pendiente');

      this.solicitudesPendientes = (postulaciones || []).filter((p: any) => {
        const pub = Array.isArray(p.publicacion) ? p.publicacion[0] : p.publicacion;
        return pub && pub.creador_id === this.usuarioId;
      }).map((p: any) => ({
        id: p.id,
        created_at: p.created_at,
        publicacion: Array.isArray(p.publicacion) ? p.publicacion[0] : p.publicacion,
        taller: Array.isArray(p.taller) ? p.taller[0] : p.taller
      }));

      // 2. Lotes activos en producción con talleres
      const { data: lotes } = await this.supabaseService.supabase
        .from('lotes_asignados')
        .select(`
          id,
          descripcion_corte,
          cantidad_piezas,
          estado,
          fecha_asignacion,
          oficina:oficina_id (id, nombre_completo, zona_ubicacion, telefono, promedio_estrellas, avatar_svg_id)
        `)
        .eq('tienda_id', this.usuarioId)
        .order('fecha_asignacion', { ascending: false });

      this.lotesEnProceso = (lotes || []).map((l: any) => ({
        ...l,
        oficina_info: Array.isArray(l.oficina) ? l.oficina[0] : l.oficina
      }));

      // 3. Mis publicaciones propias de la tienda
      const { data: pubs } = await this.supabaseService.supabase
        .from('publicaciones')
        .select('*')
        .eq('creador_id', this.usuarioId)
        .order('created_at', { ascending: false });

      this.misPublicaciones = pubs || [];

    } catch (e) {
      console.error('Error cargando panel de tienda:', e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // Mapeador de avatares animales SVG
  getAvatarEmoji(id: string): string {
    const mapa: any = { tigre: '🐯', leon: '🦁', oso: '🐻', zorro: '🦊', aguila: '🦅', buho: '🦉' };
    return mapa[id] || '🧵';
  }

  async aceptarSolicitud(solicitud: any) {
    if (!confirm(`¿Deseas asignar el corte de "${solicitud.publicacion.titulo}" a ${solicitud.taller.nombre_completo}?`)) return;

    this.cargando = true;
    try {
      await this.supabaseService.supabase
        .from('lotes_asignados')
        .insert([{
          tienda_id: this.usuarioId,
          oficina_id: solicitud.taller.id,
          descripcion_corte: solicitud.publicacion.titulo,
          cantidad_piezas: solicitud.publicacion.cantidad_piezas,
          estado: 'En Proceso'
        }]);

      await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .update({ estado: 'Aceptado' })
        .eq('id', solicitud.id);

      await this.supabaseService.supabase
        .from('publicaciones')
        .update({ estado: 'Asignado' })
        .eq('id', solicitud.publicacion.id);

      alert('¡Lote asignado con éxito!');
      await this.cargarDatosPanel();
    } catch (e: any) {
      alert('Error al asignar: ' + (e?.message || 'Error'));
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async cambiarEstadoAnuncio(pub: any) {
    const nuevoEstado = pub.estado === 'Activo' ? 'Pausado' : 'Activo';
    await this.supabaseService.supabase.from('publicaciones').update({ estado: nuevoEstado }).eq('id', pub.id);
    pub.estado = nuevoEstado;
    this.cdr.detectChanges();
  }

  async eliminarAnuncio(id: string) {
    if (!confirm('¿Deseas eliminar este anuncio?')) return;
    await this.supabaseService.supabase.from('publicaciones').delete().eq('id', id);
    this.misPublicaciones = this.misPublicaciones.filter(p => p.id !== id);
    this.cdr.detectChanges();
  }

  irAEvaluacion(usuarioIdObjetivo: string) {
    this.router.navigate(['/dejar-evaluacion', usuarioIdObjetivo]);
  }

  contactarWhatsApp(telefono: string, nombre: string, concepto: string) {
    if (!telefono) {
      alert('El usuario no posee un teléfono registrado.');
      return;
    }
    const limpio = telefono.replace(/\D/g, '');
    const mensaje = `Hola ${nombre}, me pongo en contacto desde CosturaPronta respecto al lote: "${concepto}".`;
    window.open(`https://wa.me/${limpio}?text=${encodeURIComponent(mensaje)}`, '_blank');
  }
}