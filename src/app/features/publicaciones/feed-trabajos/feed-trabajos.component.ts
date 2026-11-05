import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TarjetaTrabajoComponent } from '../../../shared/components/tarjeta-trabajo/tarjeta-trabajo.component';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-feed-trabajos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TarjetaTrabajoComponent],
  templateUrl: './feed-trabajos.component.html'
})
export class FeedTrabajosComponent implements OnInit {
  listaTrabajos: any[] = [];
  trabajosFiltrados: any[] = [];
  cargando = true;

  // Variables de filtros y búsqueda
  busquedaTexto: string = '';
  filtroZona: string = '';
  filtroTipo: string = '';
  filtroMaquina: string = '';

  zonasDisponibles: string[] = [
    'Brás',
    'Bom Retiro',
    'Pari',
    'Guarulhos',
    'Zona Leste',
    'Zona Norte',
    'Zona Sul',
    'Osasco'
  ];

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

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
          descripcion,
          cantidad_piezas,
          pago_por_pieza,
          maquinas_requeridas,
          zona_ubicacion,
          logistica_entrega,
          created_at,
          creador:creador_id (nombre_completo, verificado, zona_ubicacion)
        `)
        .eq('estado', 'Activo')
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.listaTrabajos = (data || []).map((pub: any) => {
        const datosCreador = Array.isArray(pub.creador) ? pub.creador[0] : pub.creador;

        return {
          id: pub.id,
          tipo_publicacion: pub.tipo_publicacion,
          titulo: pub.titulo,
          descripcion: pub.descripcion || '',
          cantidad_piezas: pub.cantidad_piezas,
          pago_por_pieza: pub.pago_por_pieza,
          maquinas_requeridas: pub.maquinas_requeridas || [],
          zona: pub.zona_ubicacion || datosCreador?.zona_ubicacion || 'São Paulo - SP',
          logistica: pub.logistica_entrega || 'A convenir',
          empresa: datosCreador?.nombre_completo || 'Anunciante',
          verificado: datosCreador?.verificado,
          tiempo_publicacion: new Date(pub.created_at).toLocaleDateString()
        };
      });

      this.aplicarFiltros();

    } catch (error) {
      console.error('Error al cargar el marketplace', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  aplicarFiltros() {
    const textoQuery = this.busquedaTexto.toLowerCase().trim();

    this.trabajosFiltrados = this.listaTrabajos.filter(trabajo => {
      // 1. Filtro por texto libre (busca en título, descripción o empresa)
      const coincideTexto = !textoQuery || 
        trabajo.titulo.toLowerCase().includes(textoQuery) ||
        trabajo.descripcion.toLowerCase().includes(textoQuery) ||
        trabajo.empresa.toLowerCase().includes(textoQuery);

      // 2. Filtro por Zona
      const coincideZona = !this.filtroZona || trabajo.zona.toLowerCase().includes(this.filtroZona.toLowerCase());

      // 3. Filtro por Tipo de Publicación
      const coincideTipo = !this.filtroTipo || trabajo.tipo_publicacion === this.filtroTipo;

      // 4. Filtro por Maquinaria requerida
      const coincideMaquina = !this.filtroMaquina || trabajo.maquinas_requeridas.includes(this.filtroMaquina);

      return coincideTexto && coincideZona && coincideTipo && coincideMaquina;
    });

    this.cdr.detectChanges();
  }
}