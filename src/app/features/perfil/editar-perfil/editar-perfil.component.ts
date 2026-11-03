import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-editar-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editar-perfil.component.html'
})
export class EditarPerfilComponent implements OnInit {
  usuarioId: string = '';
  rolUsuario: string = '';
  cargando = true;
  guardando = false;
  mensajeExito = '';
  mensajeError = '';

  perfil = {
    telefono: '',
    zona_ubicacion: '',
    tipo_tienda: 'firma', // 'firma' o 'ferinha'
    estado_laboral: 'Disponible', // 'Disponible' o 'Ocupado'
    cantidad_funcionarios: 0,
    especialidades: [] as string[]
  };

  // Catálogo oficial industrial textil (São Paulo standards)
  catalogoMaquinasRoles = [
    { categoria: 'Costura y Acabado', items: ['RETA', 'OVERLOCK', 'GALONEIRA', 'ELASTIQUEIRA', 'BOTONEIRA', 'CASEADEIRA', 'TRAVETE'] },
    { categoria: 'Corte y Producción', items: ['CORTADOR (Corte con sierra)', 'ENFESTADOR (Estendedor de telas)', 'AYUDANTE / AUXILIAR'] }
  ];

  constructor(
    private supabaseService: SupabaseService, 
    private router: Router,
    private cdr: ChangeDetectorRef // 👈 Inyección clave para romper el bloqueo de renderizado
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    if (user) {
      this.usuarioId = user.id;
      await this.cargarPerfilActual();
    } else {
      this.router.navigate(['/login']);
    }
  }

  async cargarPerfilActual() {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('perfiles')
        .select('rol, telefono, zona_ubicacion, tipo_tienda, estado_laboral, cantidad_funcionarios, especialidades')
        .eq('id', this.usuarioId)
        .single();

      if (error) throw error;
      
      if (data) {
        this.rolUsuario = data.rol;
        this.perfil.telefono = data.telefono || '';
        this.perfil.zona_ubicacion = data.zona_ubicacion || '';
        this.perfil.tipo_tienda = data.tipo_tienda || 'firma';
        this.perfil.estado_laboral = data.estado_laboral || 'Disponible';
        this.perfil.cantidad_funcionarios = data.cantidad_funcionarios || 0;
        this.perfil.especialidades = data.especialidades || [];
      }
    } catch (error) {
      this.mensajeError = 'No se pudo cargar tu información actual.';
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); // 👈 Refresco inmediato de la vista al terminar la carga
    }
  }

  // --- Lógica de Selección mediante Checkboxes (Evita duplicados) ---
  onMaquinaCheckboxChange(event: any, item: string) {
    if (event.target.checked) {
      if (!this.perfil.especialidades.includes(item)) {
        this.perfil.especialidades.push(item);
      }
    } else {
      this.perfil.especialidades = this.perfil.especialidades.filter(m => m !== item);
    }
  }

  isMaquinaSeleccionada(item: string): boolean {
    return this.perfil.especialidades.includes(item);
  }

  // --- Guardar en Base de Datos ---
  async guardarCambios() {
    this.guardando = true;
    this.mensajeExito = '';
    this.mensajeError = '';

    try {
      const datosUpdate: any = {
        telefono: this.perfil.telefono,
        zona_ubicacion: this.perfil.zona_ubicacion,
        especialidades: this.perfil.especialidades
      };

      if (this.rolUsuario === 'tienda') {
        datosUpdate.tipo_tienda = this.perfil.tipo_tienda;
      }
      if (this.rolUsuario === 'funcionario') {
        datosUpdate.estado_laboral = this.perfil.estado_laboral;
      }
      if (this.rolUsuario === 'oficina') {
        datosUpdate.cantidad_funcionarios = Number(this.perfil.cantidad_funcionarios);
      }

      const { error } = await this.supabaseService.supabase
        .from('perfiles')
        .update(datosUpdate)
        .eq('id', this.usuarioId);

      if (error) throw error;

      this.mensajeExito = '¡Perfil profesional actualizado con éxito!';
      
    } catch (error) {
      this.mensajeError = 'Hubo un error al guardar los cambios en la base de datos.';
    } finally {
      this.guardando = false;
      this.cdr.detectChanges(); // 👈 Muestra el mensaje de éxito/error al instante sin demoras
    }
  }
}