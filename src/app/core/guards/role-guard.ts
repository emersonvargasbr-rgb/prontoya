import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const roleGuard: CanActivateFn = async (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);
  
  // Leemos qué rol exige esta ruta específica (lo definiremos en app.routes.ts)
  const expectedRole = route.data['expectedRole']; 

  const { data: { user } } = await supabaseService.supabase.auth.getUser();
  if (!user) return false;

  const { data: perfil } = await supabaseService.supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (perfil && perfil.rol === expectedRole) {
    return true; // El rol coincide, déjalo pasar
  } else {
    // Si intenta hacer trampa, mándalo al inicio
    router.navigate(['/']); 
    return false;
  }
};