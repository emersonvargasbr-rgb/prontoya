import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-sidebar-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar-dashboard.component.html',
  styleUrls: ['./sidebar-dashboard.component.css']
})
export class SidebarDashboardComponent implements OnInit {
  rolUsuario: string = '';
  cargando = true;

  constructor(
    private supabaseService: SupabaseService, 
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    // 1. Intentamos leer el rol del localStorage de inmediato para evitar demoras visuales
    const rolGuardado = localStorage.getItem('rol_usuario');
    if (rolGuardado) {
      this.rolUsuario = rolGuardado;
      this.cargando = false;
      this.cdr.detectChanges();
    }

    try {
      // 2. Consultamos Supabase en segundo plano para asegurar que esté actualizado
      const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
      if (user) {
        const { data } = await this.supabaseService.supabase
          .from('perfiles')
          .select('rol')
          .eq('id', user.id)
          .single();
        
        if (data && data.rol) {
          this.rolUsuario = data.rol;
          // Actualizamos la memoria local con el rol fresco
          localStorage.setItem('rol_usuario', data.rol);
        }
      } else {
        // Si no hay sesión, limpiamos y mandamos al login
        localStorage.removeItem('rol_usuario');
        this.router.navigate(['/login']);
      }
    } catch (error) {
      console.error('Error cargando rol en el sidebar:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async cerrarSesion() {
    // Limpiamos la memoria local al salir
    localStorage.removeItem('rol_usuario');
    await this.supabaseService.supabase.auth.signOut();
    this.router.navigate(['/login']);
  }
}