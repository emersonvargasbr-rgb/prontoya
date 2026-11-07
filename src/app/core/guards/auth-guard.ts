import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  // 1. Intentamos obtener la sesión actual de forma directa
  let { data: { session } } = await supabaseService.supabase.auth.getSession();

  // 2. Si no viene de inmediato, esperamos a que Supabase termine de restaurarla del almacenamiento local
  if (!session) {
    session = await new Promise((resolve) => {
      const { data: { subscription } } = supabaseService.supabase.auth.onAuthStateChange((event, currentSession) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          subscription.unsubscribe();
          resolve(currentSession);
        }
      });

      // Timeout de seguridad por si el usuario realmente no está logueado (evita que se quede colgado)
      setTimeout(() => {
        subscription.unsubscribe();
        resolve(null);
      }, 1500);
    });
  }

  // 3. Evaluamos el resultado final
  if (session) {
    return true; // Sesión válida recuperada con éxito
  } else {
    router.navigate(['/login']);
    return false;
  }
};