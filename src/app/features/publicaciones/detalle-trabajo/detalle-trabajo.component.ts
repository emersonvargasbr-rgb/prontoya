import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-detalle-trabajo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './detalle-trabajo.component.html'
})
export class DetalleTrabajoComponent implements OnInit {
  trabajoId: string = '';
  trabajo: any = null;
  cargando = true;
  cargandoPostulacion = false;
  
  usuarioActualId: string = '';
  rolUsuario: string = '';

  // Modal para Ofertar Corte (Modo Tienda hacia Taller Libre)
  mostrarModalOferta = false;
  datosOferta = {
    descripcion_corte: '',
    cantidad_piezas: 500,
    pago_por_pieza: 2.50,
    tipo_tejido: 'Malla Canelado',
    logistica_entrega: 'recolectar' // 'recolectar' o 'entrega_puerta'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.trabajoId = this.route.snapshot.paramMap.get('id') || '';
    await this.obtenerUsuarioActual();
    await this.cargarDetalleTrabajo();
  }

  async obtenerUsuarioActual() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioActualId = user.id;
      const { data } = await this.supabaseService.supabase
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single();
      if (data) {
        this.rolUsuario = data.rol;
      }
    }
  }

  async cargarDetalleTrabajo() {
    this.cargando = true;
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('publicaciones')
        .select(`
          *,
          creador:creador_id (
            id, nombre_completo, verificado, zona_ubicacion, 
            promedio_estrellas, total_evaluaciones, avatar_svg_id, 
            color_portada, especialidad_principal, telefono, 
            visibilidad_whatsapp, cantidad_maquinas, cantidad_operarios
          )
        `)
        .eq('id', this.trabajoId)
        .single();

      if (error) throw error;
      this.trabajo = data;
    } catch (e) {
      console.error('Error al cargar detalle del anuncio:', e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  abrirModalOfertar() {
    if (!this.usuarioActualId) {
      this.router.navigate(['/login']);
      return;
    }
    this.datosOferta.descripcion_corte = `Lote de ${this.trabajo?.tipo_tejido || 'Moda'} - ${this.trabajo?.titulo || ''}`;
    this.mostrarModalOferta = true;
    this.cdr.detectChanges();
  }

  // Enviar propuesta de la tienda a la oficina
  async enviarOfertaLote() {
    if (!this.datosOferta.descripcion_corte.trim() || this.datosOferta.cantidad_piezas <= 0 || this.datosOferta.pago_por_pieza <= 0) {
      alert('Por favor completa la descripción, cantidad de piezas y precio por pieza.');
      return;
    }

    this.cargandoPostulacion = true;
    try {
      const { error } = await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .insert([{
          publicacion_id: this.trabajoId,
          taller_id: this.usuarioActualId,
          estado: 'Pendiente',
          descripcion_corte: this.datosOferta.descripcion_corte.trim(),
          cantidad_piezas: this.datosOferta.cantidad_piezas,
          pago_por_pieza: this.datosOferta.pago_por_pieza,
          tipo_tejido: this.datosOferta.tipo_tejido,
          logistica_entrega: this.datosOferta.logistica_entrega
        }]);

      if (error) throw error;

      alert('¡Propuesta de lote enviada con éxito a la oficina! Quedará pendiente de su aprobación.');
      this.mostrarModalOferta = false;
      this.router.navigate(['/feed']);

    } catch (e: any) {
      alert('Error al enviar la oferta: ' + (e?.message || 'Intente de nuevo.'));
      console.error(e);
    } finally {
      this.cargandoPostulacion = false;
      this.cdr.detectChanges();
    }
  }

  // Postulación directa de la Oficina al lote de la Tienda
  async postularOficinaAlLote() {
    if (!this.usuarioActualId) {
      this.router.navigate(['/login']);
      return;
    }

    if (!confirm('¿Deseas postular tu taller/oficina a este lote de confección?')) return;

    this.cargandoPostulacion = true;
    try {
      const { error } = await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .insert([{
          publicacion_id: this.trabajoId,
          taller_id: this.usuarioActualId,
          estado: 'Pendiente',
          descripcion_corte: this.trabajo?.titulo || 'Lote de Confección',
          cantidad_piezas: this.trabajo?.cantidad_piezas || 0,
          pago_por_pieza: this.trabajo?.pago_por_pieza || 0,
          tipo_tejido: this.trabajo?.tipo_tejido || 'General',
          logistica_entrega: 'recolectar'
        }]);

      if (error) throw error;

      alert('¡Postulación enviada con éxito! Esperando aprobación de la tienda.');
      this.router.navigate(['/panel-oficina']);

    } catch (e: any) {
      alert('Error al postularse: ' + (e?.message || 'Intente de nuevo.'));
      console.error(e);
    } finally {
      this.cargandoPostulacion = false;
      this.cdr.detectChanges();
    }
  }

  // Postulación del Operario/Funcionario a una Vacante de Empleo
  async postularmeAEmpleo() {
    if (!this.usuarioActualId) {
      this.router.navigate(['/login']);
      return;
    }

    if (!confirm('¿Deseas postularte a esta vacante laboral?')) return;

    this.cargandoPostulacion = true;
    try {
      const { error } = await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .insert([{
          publicacion_id: this.trabajoId,
          taller_id: this.usuarioActualId, // ID del operario / funcionario
          estado: 'Pendiente',
          descripcion_corte: this.trabajo?.titulo || 'Postulación a Vacante',
          cantidad_piezas: this.trabajo?.cantidad_piezas || 0,
          pago_por_pieza: this.trabajo?.pago_por_pieza || 0,
          tipo_tejido: this.trabajo?.tipo_tejido || 'General',
          logistica_entrega: 'recolectar'
        }]);

      if (error) throw error;

      alert('¡Postulación enviada con éxito al taller/anunciante!');
      this.router.navigate(['/panel-funcionario']);

    } catch (e: any) {
      alert('Error al postularse a la vacante: ' + (e?.message || 'Intente de nuevo.'));
      console.error(e);
    } finally {
      this.cargandoPostulacion = false;
      this.cdr.detectChanges();
    }
  }

  contactarWhatsApp() {
    const tel = this.trabajo?.creador?.telefono;
    if (!tel) {
      alert('El anunciante no posee un teléfono registrado.');
      return;
    }
    const limpio = tel.replace(/\D/g, '');
    const mensaje = `Hola ${this.trabajo.creador.nombre_completo}, me pongo en contacto desde CosturaPronta respecto a tu anuncio "${this.trabajo.titulo}".`;
    window.open(`https://wa.me/${limpio}?text=${encodeURIComponent(mensaje)}`, '_blank');
  }

  getAvatarEmoji(id: string): string {
    const mapa: any = { tigre: '🐯', leon: '🦁', oso: '🐻', zorro: '🦊', aguila: '🦅', buho: '🦉' };
    return mapa[id] || '🧵';
  }
}