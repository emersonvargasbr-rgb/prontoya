import { Injectable, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

export interface PerfilActual {
  id: string;
  correo?: string | null;
  nombre_completo?: string | null;
  rol?: string | null;
  telefono?: string | null;
  documento?: string | null;
  verificado?: boolean | null;
  created_at?: string | null;
  plan?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Señales útiles para layout, sidebar y componentes
  usuarioAuth = signal<User | null>(null);
  perfil = signal<PerfilActual | null>(null);

  constructor(private supabaseService: SupabaseService) {
    this.inicializarSesion();
  }

  private get sb() {
    return this.supabaseService.supabase;
  }

  private async inicializarSesion() {
    const { data: { session } } = await this.sb.auth.getSession();
    this.usuarioAuth.set(session?.user ?? null);
    if (session?.user) {
      await this.cargarPerfil(session.user.id);
    }

    this.sb.auth.onAuthStateChange(async (_event, sesion) => {
      this.usuarioAuth.set(sesion?.user ?? null);
      if (sesion?.user) {
        await this.cargarPerfil(sesion.user.id);
      } else {
        this.perfil.set(null);
      }
    });
  }

  async cargarPerfil(userId: string): Promise<PerfilActual | null> {
    const { data, error } = await this.sb
      .from('perfiles')
      .select('id, correo, nombre_completo, rol, telefono, documento, verificado, created_at, plan')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      this.perfil.set(data);
      return data;
    }
    return null;
  }

  // Función de Registro Completo sincronizada con la BD
  async registrar(email: string, password: string, datosPerfil: any) {
    const correoLimpio = email.trim().toLowerCase();

    // 1. Crea el usuario en Supabase Auth
    const { data, error } = await this.sb.auth.signUp({
      email: correoLimpio,
      password,
    });

    if (error) throw error;

    // 2. Si se creó bien, guardamos su información en la tabla "perfiles"
    if (data.user) {
      const telefonoLimpio = String(datosPerfil.telefono ?? '').replace(/\D/g, '') || null;
      const documentoLimpio = String(datosPerfil.documento ?? '').replace(/[^a-zA-Z0-9]/g, '').trim() || null;

      const filaPerfil: Record<string, unknown> = {
        id: data.user.id,
        correo: correoLimpio,
        nombre_completo: String(datosPerfil.nombre_completo ?? '').trim(),
        rol: datosPerfil.rol || 'funcionario',
        telefono: telefonoLimpio,
        documento: documentoLimpio,
        verificado: false,
      };

      if (datosPerfil.zona_ubicacion?.trim()) {
        filaPerfil['zona_ubicacion'] = datosPerfil.zona_ubicacion.trim();
      }
      if (datosPerfil.especialidad_principal?.trim()) {
        filaPerfil['especialidad_principal'] = datosPerfil.especialidad_principal.trim();
      }

      const { error: errorPerfil } = await this.sb
        .from('perfiles')
        .upsert([filaPerfil], { onConflict: 'id' });

      if (errorPerfil) throw errorPerfil;

      if (data.session) {
        await this.cargarPerfil(data.user.id);
      }
    }

    return data;
  }

  // Función de Login
  async login(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) throw error;

    if (data.user) {
      await this.cargarPerfil(data.user.id);
    }

    return data;
  }

  async cerrarSesion() {
    await this.sb.auth.signOut();
    this.usuarioAuth.set(null);
    this.perfil.set(null);
  }
}