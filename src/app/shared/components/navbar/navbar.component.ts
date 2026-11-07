import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html'
})
export class NavbarComponent implements OnInit {
  usuarioLogueado = false;
  rutaPanel = '';
  nombreUsuario = '';
  rolUsuario = '';
  menuMobileAbierto = false;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.verificarSesion();

    // Escuchador de cambios de autenticación en tiempo real
    this.supabaseService.supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await this.verificarSesion();
      } else {
        this.usuarioLogueado = false;
        this.rutaPanel = '';
        this.nombreUsuario = '';
        this.rolUsuario = '';
        this.cdr.detectChanges();
      }
    });
  }

  async verificarSesion() {
    try {
      const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
      
      if (user) {
        this.usuarioLogueado = true;
        
        const { data: perfil } = await this.supabaseService.supabase
          .from('perfiles')
          .select('rol, nombre_completo')
          .eq('id', user.id)
          .single();

        if (perfil) {
          this.rolUsuario = perfil.rol;
          this.nombreUsuario = perfil.nombre_completo || 'Usuario';
          this.rutaPanel = `/panel-${perfil.rol}`;
        }
      } else {
        this.usuarioLogueado = false;
      }
    } catch (e) {
      console.error('Error verificando sesión en Navbar:', e);
      this.usuarioLogueado = false;
    } finally {
      // Fuerza a Angular a repintar el navbar de inmediato al cargar o recargar
      this.cdr.detectChanges();
    }
  }

  async cerrarSesion() {
    await this.supabaseService.supabase.auth.signOut();
    this.usuarioLogueado = false;
    this.menuMobileAbierto = false;
    this.router.navigate(['/login']);
  }

  toggleMenuMobile() {
    this.menuMobileAbierto = !this.menuMobileAbierto;
  }
}