import { Component, OnInit, Inject, PLATFORM_ID, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
  // Signals para reactividad ultra-rápida y cero retardos
  rolUsuario = signal<string>('');
  usuarioLogueado = signal<boolean>(false);
  cargando = signal<boolean>(true);
  sidebarExpandido = signal<boolean>(true); // Control de colapso en PC

  constructor(
    private supabaseService: SupabaseService,
    public router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit() {
    // 1. Carga instantánea de memoria local solo en el navegador (Evita error SSR)
    if (isPlatformBrowser(this.platformId)) {
      const rolGuardado = localStorage.getItem('rol_usuario');
      if (rolGuardado) {
        this.rolUsuario.set(rolGuardado);
      }
    }

    try {
      // 2. Verificar la sesión en Supabase de forma segura
      const { data: { session } } = await this.supabaseService.supabase.auth.getSession();
      
      if (session?.user) {
        this.usuarioLogueado.set(true);

        const { data } = await this.supabaseService.supabase
          .from('perfiles')
          .select('rol')
          .eq('id', session.user.id)
          .single();

        if (data?.rol) {
          this.rolUsuario.set(data.rol);
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('rol_usuario', data.rol);
          }
        }
      } else {
        // 🛡️ CORRECCIÓN CLAVE: Si no hay usuario, SIMPLEMENTE LIMPIAMOS ESTADO.
        // ¡JAMÁS HACES ROUTER.NAVIGATE A LOGIN AQUÍ! (Permite ver el feed público)
        this.usuarioLogueado.set(false);
        this.rolUsuario.set('');
        if (isPlatformBrowser(this.platformId)) {
          localStorage.removeItem('rol_usuario');
        }
      }
    } catch (error) {
      console.error('Error verificando usuario en Sidebar:', error);
    } finally {
      this.cargando.set(false);
      this.cdr.detectChanges();
    }
  }

  toggleSidebar() {
    this.sidebarExpandido.update(v => !v);
  }

  async cerrarSesion() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('rol_usuario');
    }
    await this.supabaseService.supabase.auth.signOut();
    this.usuarioLogueado.set(false);
    this.rolUsuario.set('');
    this.router.navigate(['/login']);
  }
}