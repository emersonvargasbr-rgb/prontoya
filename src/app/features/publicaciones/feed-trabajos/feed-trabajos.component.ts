import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // Para que funcionen los enlaces a los detalles
import { TarjetaTrabajoComponent } from '../../../shared/components/tarjeta-trabajo/tarjeta-trabajo.component';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-feed-trabajos',
  standalone: true,
  imports: [CommonModule, RouterModule, TarjetaTrabajoComponent],
  templateUrl: './feed-trabajos.component.html'
})
export class FeedTrabajosComponent implements OnInit {
  listaTrabajos: any[] = [];
  cargando = true;

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit() {
    this.cargarFeed();
  }

  async cargarFeed() {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('publicaciones')
        .select(`
          id,
          tipo_publicacion,
          titulo,
          cantidad_piezas,
          pago_por_pieza,
          maquinas_requeridas,
          created_at,
          creador:creador_id (nombre_completo, verificado, zona_ubicacion)
        `)
        .eq('estado', 'Activo')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Agregamos (pub: any) para quitar la restricción estricta de TypeScript
      this.listaTrabajos = data.map((pub: any) => {
        // Truco de seguridad: Si Supabase lo envía como array, tomamos el primer elemento [0]. Si no, lo usamos normal.
        const datosCreador = Array.isArray(pub.creador) ? pub.creador[0] : pub.creador;

        return {
          id: pub.id,
          titulo: pub.titulo,
          cantidad_piezas: pub.cantidad_piezas,
          pago_por_pieza: pub.pago_por_pieza,
          maquinas_requeridas: pub.maquinas_requeridas,
          zona: datosCreador?.zona_ubicacion || 'São Paulo', // Ahora sí leerá las propiedades sin error
          empresa: datosCreador?.nombre_completo,
          verificado: datosCreador?.verificado,
          tiempo_publicacion: new Date(pub.created_at).toLocaleDateString()
        };
      });

    } catch (error) {
      console.error('Error al cargar el marketplace', error);
    } finally {
      this.cargando = false;
    }
  }
}