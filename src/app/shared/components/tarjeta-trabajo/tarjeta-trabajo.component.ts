import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

// Interfaz para tipar correctamente los datos que vienen de la base de datos
export interface Trabajo {
  id?: string;
  titulo: string;
  descripcion?: string;
  cantidad_piezas: number;
  pago_por_pieza: number;
  maquinas_requeridas: string[];
  zona: string;
  empresa?: string;
  verificado?: boolean;
  tiempo_publicacion?: string;
  creador_rol?: string;     // 'tienda' o 'oficina'
  creador_nombre?: string;  // Nombre del taller o tienda que publica
}

@Component({
  selector: 'app-tarjeta-trabajo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tarjeta-trabajo.component.html',
  styleUrls: ['./tarjeta-trabajo.css']
})
export class TarjetaTrabajoComponent {
  // Ahora el input espera obligatoriamente un objeto Trabajo dinámico desde el padre (feed)
  @Input() trabajo!: Trabajo;

  // Calculamos la ganancia total estimada en tiempo real
  get totalGanancia(): number {
    if (!this.trabajo) return 0;
    return (this.trabajo.cantidad_piezas || 0) * (this.trabajo.pago_por_pieza || 0);
  }
}