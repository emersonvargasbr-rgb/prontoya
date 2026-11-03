import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  credenciales = { email: '', password: '' };
  mensajeError = '';
  cargando = false;

  constructor(
    private authService: AuthService,
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef // 👈 Inyección clave para forzar la navegación y actualización
  ) {}

  async onSubmit() {
    this.cargando = true;
    this.mensajeError = '';
    this.cdr.detectChanges();

    try {
      const authData = await this.authService.login(this.credenciales.email, this.credenciales.password);
      
      if (!authData.user) throw new Error('Error al autenticar');

      // Obtenemos el perfil completo para validar su rol
      const { data: perfil, error } = await this.supabaseService.supabase
        .from('perfiles')
        .select('rol, zona_ubicacion')
        .eq('id', authData.user.id)
        .single();

      if (error) throw error;

      if (perfil?.rol) {
        // 🚀 Guardamos el rol en localStorage para que el sidebar cargue al instante sin parpadear
        localStorage.setItem('rol_usuario', perfil.rol);
      }

      // Redirección inteligente basada en el rol de la BD
      switch (perfil?.rol) {
        case 'tienda':
          await this.router.navigate(['/panel-tienda']);
          break;
        case 'oficina':
          await this.router.navigate(['/panel-oficina']);
          break;
        case 'funcionario':
          await this.router.navigate(['/panel-funcionario']);
          break;
        default:
          await this.router.navigate(['/feed']); // Redirige al feed de cortes si el rol no coincide exacto
      }

    } catch (error: any) {
      this.mensajeError = 'Correo o contraseña incorrectos. Verifica tus datos.';
      console.error(error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); // 👈 Rompe el bloqueo para que la interfaz responda al instante
    }
  }
}