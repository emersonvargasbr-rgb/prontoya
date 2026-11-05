import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  evaluadoId: string = '';
  evaluadoNombre: string = 'Usuario';
  cargando = false;
  mensajeError = '';

  estrellas: number = 5;
  comentario: string = '';
  
  etiquetasDisponibles: string[] = [
    'Puntual en la entrega',
    'Excelente calidad de costura',
    'Cuidado impecable del material',
    'Buena comunicación',
    'Recomendado 100%'
  ];
  etiquetasSeleccionadas: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.evaluadoId = this.route.snapshot.paramMap.get('id') || '';
    
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.evaluadorId = user.id;
      await this.cargarDatosEvaluado();
    } else {
      this.router.navigate(['/login']);
    }
  }

  async cargarDatosEvaluado() {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('perfiles')
        .select('nombre_completo')
        .eq('id', this.evaluadoId)
        .single();

      if (error) throw error;
      if (data) this.evaluadoNombre = data.nombre_completo;
    } catch (e) {
      console.error('Error cargando usuario a evaluar:', e);
    } finally {
      this.cdr.detectChanges();
    }
  }

  seleccionarEstrellas(n: number) {
    this.estrellas = n;
    this.cdr.detectChanges();
  }

  toggleEtiqueta(etiqueta: string) {
    if (this.etiquetasSeleccionadas.includes(etiqueta)) {
      this.etiquetasSeleccionadas = this.etiquetasSeleccionadas.filter(e => e !== etiqueta);
    } else {
      this.etiquetasSeleccionadas.push(etiqueta);
    }
    this.cdr.detectChanges();
  }

  async enviarEvaluacion() {
    if (!this.evaluadoId || !this.evaluadorId) {
      this.mensajeError = 'Datos de evaluación incompletos.';
      return;
    }

    this.cargando = true;
    this.mensajeError = '';
    this.cdr.detectChanges();

    try {
      // 1. Insertar la evaluación en la tabla
      const { error: errEval } = await this.supabaseService.supabase
        .from('evaluaciones')
        .insert([{
          evaluador_id: this.evaluadorId,
          evaluado_id: this.evaluadoId,
          estrellas: this.estrellas,
          etiquetas: this.etiquetasSeleccionadas,
          comentario: this.comentario
        }]);

      if (errEval) throw errEval;

      // 2. Recalcular promedio de estrellas y total de evaluaciones del perfil evaluado
      const { data: todasEval, error: errQuery } = await this.supabaseService.supabase
        .from('evaluaciones')
        .select('estrellas')
        .eq('evaluado_id', this.evaluadoId);

      if (!errQuery && todasEval && todasEval.length > 0) {
        const total = todasEval.length;
        const suma = todasEval.reduce((acc, curr) => acc + curr.estrellas, 0);
        const promedio = Number((suma / total).toFixed(2));

        await this.supabaseService.supabase
          .from('perfiles')
          .update({
            promedio_estrellas: promedio,
            total_evaluaciones: total
          })
          .eq('id', this.evaluadoId);
      }

      alert('¡Evaluación enviada con éxito! Gracias por calificar la reputación de la red.');
      this.router.navigate(['/feed']);

    } catch (e: any) {
      this.mensajeError = 'Error al enviar la evaluación: ' + (e?.message || 'Intente de nuevo');
      console.error(e);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }
}