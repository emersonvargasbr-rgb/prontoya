import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 class="text-center text-3xl font-extrabold text-gray-900">Completa tu Perfil Profesional</h2>
        <p class="mt-2 text-center text-sm text-gray-600">Ayúdanos a conectarte con los mejores talleres y tiendas en São Paulo.</p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form (ngSubmit)="guardarOnboarding()" class="space-y-6">
            
            <div>
              <label class="block text-sm font-medium text-gray-700">Zona o Barrio en São Paulo</label>
              <input type="text" [(ngModel)]="perfil.zona_ubicacion" name="zona" placeholder="Ej: Brás, Bom Retiro, Pari" required
                class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Especialidad Principal</label>
              <select [(ngModel)]="perfil.especialidad" name="especialidad" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white">
                <option value="Ropa Infantil">Ropa Infantil</option>
                <option value="Moda Femenina / Vestidos">Moda Femenina / Vestidos</option>
                <option value="Jeans / Denim">Jeans / Denim</option>
                <option value="Ropa Deportiva">Ropa Deportiva</option>
              </select>
            </div>

            <div *ngIf="mensajeError" class="text-red-600 text-sm font-medium">
              {{ mensajeError }}
            </div>

            <div>
              <button type="submit" [disabled]="cargando"
                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none">
                {{ cargando ? 'Guardando...' : 'Guardar y Continuar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
})
export class OnboardingComponent implements OnInit {
  usuarioId = '';
  cargando = false;
  mensajeError = '';

  perfil = {
    zona_ubicacion: '',
    especialidad: 'Moda Femenina / Vestidos'
  };

  constructor(private supabaseService: SupabaseService, private router: Router) {}

  async ngOnInit() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioId = user.id;
    } else {
      this.router.navigate(['/login']);
    }
  }

  async guardarOnboarding() {
    this.cargando = true;
    this.mensajeError = '';

    try {
      const { error } = await this.supabaseService.supabase
        .from('perfiles')
        .update({
          zona_ubicacion: this.perfil.zona_ubicacion,
          especialidades: [this.perfil.especialidad] // Guardado como arreglo compatible con tu tabla SQL
        })
        .eq('id', this.usuarioId);

      if (error) throw error;

      alert('¡Perfil configurado con éxito!');
      this.router.navigate(['/feed-trabajos']); // O al panel que corresponda

    } catch (error: any) {
      this.mensajeError = 'Error al guardar los datos. Intenta de nuevo.';
      console.error(error);
    } finally {
      this.cargando = false;
    }
  }
}