import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private supabaseService: SupabaseService) {}

  // Función de Registro Completo sincronizada con la BD
  async registrar(email: string, password: string, datosPerfil: any) {
    // 1. Crea el usuario en Supabase Auth
    const { data, error } = await this.supabaseService.supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    // 2. Si se creó bien, guardamos su información en la tabla "perfiles"
    if (data.user) {
      const { error: errorPerfil } = await this.supabaseService.supabase
        .from('perfiles')
        .upsert([{
          id: data.user.id,
          correo: email,
          nombre_completo: datosPerfil.nombre_completo,
          rol: datosPerfil.rol,
          telefono: datosPerfil.telefono || null,
          documento: datosPerfil.documento || null
        }]);
        
      if (errorPerfil) throw errorPerfil;
    }
    return data;
  }

  // Función de Login
  async login(email: string, password: string) {
    const { data, error } = await this.supabaseService.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  }
}