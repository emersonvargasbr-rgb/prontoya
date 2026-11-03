import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  // Verifica si hay una sesión activa en el navegador
  const { data: { session } } = await supabaseService.supabase.auth.getSession();

  if (session) {
    return true; // Déjalo pasar
  } else {
    router.navigate(['/login']); // Patéalo al login
    return false;
  }
};