import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-detalle-trabajo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './detalle-trabajo.component.html'
})
export class DetalleTrabajoComponent implements OnInit {
  trabajo: any = null;
  cargando = true;
  error = '';
  
  usuarioActualId: string = '';
  rolUsuario: string = '';
  yaPostulado = false;
  cargandoPostulacion = false;

  constructor(
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.verificarSesionYRol();
      await this.cargarDetalle(id);
    }
  }

  async verificarSesionYRol() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioActualId = user.id;
      const { data } = await this.supabaseService.supabase
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single();
      if (data) this.rolUsuario = data.rol;
    }
  }

  async cargarDetalle(id: string) {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('publicaciones')
        .select(`
          *,
          creador:creador_id (id, nombre_completo, telefono, verificado, zona_ubicacion, promedio_estrellas)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      const datosCreador = Array.isArray(data.creador) ? data.creador[0] : data.creador;
      
      this.trabajo = {
        ...data,
        creador_info: datosCreador || {}
      };

      if (this.usuarioActualId) {
        const { data: post } = await this.supabaseService.supabase
          .from('postulaciones_lotes')
          .select('id')
          .eq('publicacion_id', id)
          .eq('taller_id', this.usuarioActualId)
          .single();

        if (post) this.yaPostulado = true;
      }

    } catch (e) {
      this.error = 'No se pudo cargar la información del anuncio.';
      console.error(e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  mostrarBotonPostular(): boolean {
    if (!this.trabajo) return false;
    if (this.trabajo.tipo_publicacion === 'busco_oficina' && this.rolUsuario === 'oficina') return true;
    if (this.trabajo.tipo_publicacion === 'busco_funcionario' && this.rolUsuario === 'funcionario') return true;
    return false;
  }

  async postularse() {
    if (!this.usuarioActualId) {
      alert('Debes iniciar sesión para postularte.');
      this.router.navigate(['/login']);
      return;
    }

    this.cargandoPostulacion = true;
    try {
      const { error } = await this.supabaseService.supabase
        .from('postulaciones_lotes')
        .insert([{
          publicacion_id: this.trabajo.id,
          taller_id: this.usuarioActualId,
          estado: 'Pendiente'
        }]);

      if (error) throw error;

      this.yaPostulado = true;
      alert('¡Postulación enviada con éxito!');

    } catch (e: any) {
      console.error(e);
      alert('Error al enviar la postulación: ' + (e.message || 'Intenta de nuevo'));
    } finally {
      this.cargandoPostulacion = false;
      this.cdr.detectChanges();
    }
  }

  contactarWhatsApp() {
    const telefono = this.trabajo.creador_info.telefono;
    if (!telefono) {
      alert('El anunciante no tiene un número de teléfono público registrado.');
      return;
    }

    const telefonoLimpio = telefono.replace(/\D/g, '');
    let mensaje = `Hola ${this.trabajo.creador_info.nombre_completo}, vi tu anuncio de "${this.trabajo.titulo}" en CosturaPronta. ¿Podemos hablar de los detalles?`;
    
    if (this.trabajo.tipo_publicacion === 'busco_funcionario') {
      // 👈 Corrección aplicada aquí usando 'this.trabajo.titulo' correctamente
      mensaje = `Hola ${this.trabajo.creador_info.nombre_completo}, me interesa la vacante de "${this.trabajo.puesto_trabajo || this.trabajo.titulo}" en tu taller. ¿Sigue disponible?`;
    }

    const url = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }
}