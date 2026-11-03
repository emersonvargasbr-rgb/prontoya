import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.component.html'
})
export class RegistroComponent {
  // Modelo de datos atado al formulario HTML
  usuario = {
    email: '',
    password: '',
    nombre_completo: '',
    rol: 'funcionario', // Valor por defecto
    telefono: '',
    documento: '' // CNPJ o CPF
  };

  mensajeError = '';
  cargando = false;

  constructor(private authService: AuthService, private router: Router) {}

  async onSubmit() {
    this.cargando = true;
    this.mensajeError = '';

    try {
      await this.authService.registrar(this.usuario.email, this.usuario.password, this.usuario);
      alert('¡Registro exitoso! Bienvenido a la plataforma.');
      this.router.navigate(['/login']); // Lo enviamos a iniciar sesión
    } catch (error: any) {
      this.mensajeError = error.message || 'Hubo un error en el registro.';
    } finally {
      this.cargando = false;
    }
  }
}