import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
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

  constructor(
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef // 👈 Inyección
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarDetalle(id);
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

    } catch (e) {
      this.error = 'No se pudo cargar la información de este corte.';
      console.error(e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); // 👈 Render inmediato
    }
  }

  contactarWhatsApp() {
    const telefono = this.trabajo.creador_info.telefono;
    
    if (!telefono) {
      alert('El anunciante no tiene un número de teléfono público registrado.');
      return;
    }

    const telefonoLimpio = telefono.replace(/\D/g, '');
    const mensaje = `Hola ${this.trabajo.creador_info.nombre_completo}, vi tu anuncio para el corte de "${this.trabajo.titulo}" (${this.trabajo.cantidad_piezas} piezas) en la plataforma. ¿Podemos hablar de los detalles?`;
    
    const url = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }
}