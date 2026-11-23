import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Sólo deja pasar a administradores (RPC `es_admin` / tabla `administradores`).
 *   { path: 'admin/suscripciones', component: AdminSuscripcionesComponent, canActivate: [adminGuard] }
 *
 * Es una comodidad de interfaz. La protección real está en la base de datos y en la
 * Edge Function `verificar-suscripcion`, que comprueban permisos de administrador.
 */
export const adminGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const db = inject(SupabaseService).supabase;

  try {
    const { data: { session }, error: sessionError } = await db.auth.getSession();
    if (sessionError || !session?.user) {
      return router.createUrlTree(['/login']);
    }

    const { data, error } = await db.rpc('es_admin');
    if (error) {
      console.error('Error comprobando es_admin:', error);
      return router.createUrlTree(['/feed']);
    }

    return data === true ? true : router.createUrlTree(['/feed']);
  } catch (err) {
    console.error('Error inesperado en adminGuard:', err);
    return router.createUrlTree(['/feed']);
  }
};