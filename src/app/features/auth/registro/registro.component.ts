import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { mensajeAmigable } from '../../../core/utils/helpers';

export interface PaisWhatsApp {
  codigo: string;
  iso: string;
  nombre: string;
  placeholder: string;
}

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './registro.component.html'
})
export class RegistroComponent {
  readonly paises: PaisWhatsApp[] = [
    { codigo: '55',  iso: 'BR', nombre: 'Brasil (+55)',    placeholder: '11 99999-9999' },
    { codigo: '591', iso: 'BO', nombre: 'Bolivia (+591)',  placeholder: '7123-4567' },
    { codigo: '58',  iso: 'VE', nombre: 'Venezuela (+58)', placeholder: '412-1234567' },
    { codigo: '51',  iso: 'PE', nombre: 'Perú (+51)',      placeholder: '987 654 321' },
    { codigo: '595', iso: 'PY', nombre: 'Paraguay (+595)', placeholder: '981 123456' },
    { codigo: '57',  iso: 'CO', nombre: 'Colombia (+57)',  placeholder: '300 1234567' },
  ];

  paisSeleccionado = '55';
  numeroLocal = '';

  usuario = {
    email: '',
    password: '',
    nombre_completo: '',
    rol: 'funcionario', // 'funcionario' | 'oficina' | 'tienda'
    zona_ubicacion: '',
    especialidad_principal: '',
    telefono: '',
    documento: '', // Opcional al registrarse; queda pendiente de verificación si está vacío o pendiente
    verificado: false,
  };

  mensajeError = '';
  avisoInfo = '';
  cargando = false;

  constructor(
    private authService: AuthService,
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  private get db() {
    return this.supabaseService.supabase;
  }

  get paisActual(): PaisWhatsApp {
    return this.paises.find(p => p.codigo === this.paisSeleccionado) ?? this.paises[0];
  }

  get telefonoNormalizado(): string {
    let digitos = (this.numeroLocal || '').replace(/\D/g, '').replace(/^0+/, '');
    if (!digitos) return '';

    // Evita duplicar el código de país si el usuario ya lo escribió
    if (digitos.startsWith(this.paisSeleccionado) && digitos.length > 9) {
      return digitos;
    }
    return `${this.paisSeleccionado}${digitos}`;
  }

  private async whatsappYaExiste(telefono: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('perfiles')
      .select('id')
      .eq('telefono', telefono)
      .limit(1);

    if (error) return false;
    return (data?.length ?? 0) > 0;
  }

  async onSubmit() {
    this.mensajeError = '';
    this.avisoInfo = '';

    const telFinal = this.telefonoNormalizado;
    if (!/^\d{10,15}$/.test(telFinal)) {
      this.mensajeError = 'Ingresa un número de WhatsApp válido con su código de país.';
      return;
    }

    this.cargando = true;

    try {
      const duplicado = await this.whatsappYaExiste(telFinal);
      if (duplicado) {
        this.mensajeError = 'Este número de WhatsApp ya está asociado a otra cuenta.';
        return;
      }

      const docLimpio = (this.usuario.documento || '').replace(/[^a-zA-Z0-9]/g, '').trim();
      const payload = {
        ...this.usuario,
        telefono: telFinal,
        documento: docLimpio || null,
        verificado: false, // Queda en verificación pendiente sin bloquear el alta
      };

      await this.authService.registrar(this.usuario.email.trim(), this.usuario.password, payload);

      const msgDoc = docLimpio
        ? ' Tu documento quedará en estado de verificación.'
        : ' Podrás completar tu CPF/CNPJ o documento más adelante en tu perfil.';

      alert(`¡Registro exitoso! Bienvenido a CosturaPronta.${msgDoc}`);
      this.router.navigate(['/login']);
    } catch (error: any) {
      this.mensajeError = mensajeAmigable(error, 'Hubo un error al crear la cuenta.');
    } finally {
      this.cargando = false;
    }
  }
}