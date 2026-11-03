import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-dejar-evaluacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dejar-evaluacion.component.html'
})
export class DejarEvaluacionComponent implements OnInit {
  evaluadorId: string = '';
  evaluadoId: string = ''; // ID de la Oficina o Tienda que estamos calificando
  
  // Datos del formulario
  estrellasSeleccionadas: number = 0;
  comentario: string = '';
  
  // Opciones predefinidas de etiquetas
  etiquetasDisponibles = ['Entrega Puntual', 'Excelente Costura', 'Faltó Mercancía', 'Paga a Tiempo', 'Buena Comunicación', 'Problemas con Tela'];
  etiquetasSeleccionadas: string[] = [];

  cargando = false;
  mensaje = '';

  constructor(
    private supabase: SupabaseService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit() {
    // Obtenemos a quién vamos a calificar desde la URL (ej: /evaluar/UUID_DE_LA_OFICINA)
    this.evaluadoId = this.route.snapshot.paramMap.get('id') || '';
    
    // Obtenemos quién está calificando (Usuario logueado)
    const { data: { user } } = await this.supabase.supabase.auth.getUser();
    if (user) this.evaluadorId = user.id;
  }

  // Lógica para marcar estrellas al hacer clic
  seleccionarEstrella(valor: number) {
    this.estrellasSeleccionadas = valor;
  }

  // Lógica para elegir etiquetas tipo "Chips"
  toggleEtiqueta(etiqueta: string) {
    const index = this.etiquetasSeleccionadas.indexOf(etiqueta);
    if (index === -1) {
      this.etiquetasSeleccionadas.push(etiqueta);
    } else {
      this.etiquetasSeleccionadas.splice(index, 1);
    }
  }

  async enviarEvaluacion() {
    if (this.estrellasSeleccionadas === 0) {
      this.mensaje = 'Por favor, selecciona una calificación de estrellas.';
      return;
    }

    this.cargando = true;
    try {
      const { error } = await this.supabase.supabase
        .from('evaluaciones')
        .insert([{
          evaluador_id: this.evaluadorId,
          evaluado_id: this.evaluadoId,
          estrellas: this.estrellasSeleccionadas,
          etiquetas: this.etiquetasSeleccionadas,
          comentario: this.comentario
        }]);

      if (error) throw error;

      alert('¡Evaluación registrada! Gracias por mantener segura la comunidad.');
      this.router.navigate(['/panel-tienda']); // Regresamos al panel

    } catch (error) {
      this.mensaje = 'Error al enviar la evaluación. Intenta nuevamente.';
    } finally {
      this.cargando = false;
    }
  }
}