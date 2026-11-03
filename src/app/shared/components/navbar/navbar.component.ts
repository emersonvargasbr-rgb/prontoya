import { Component, OnInit } from '@angular/core';
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
  rutaPanel = ''; // Aquí guardaremos dinámicamente si va a /panel-tienda, /panel-oficina, etc.

  constructor(private supabaseService: SupabaseService, private router: Router) {}

  ngOnInit() {
    // 1. Verificamos el estado inicial al cargar la página
    this.verificarSesion();

    // 2. Este es el "escuchador". Si el usuario hace login o logout, el menú se actualiza al instante.
    this.supabaseService.supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        this.verificarSesion();
      } else {
        this.usuarioLogueado = false;
        this.rutaPanel = '';
      }
    });
  }
  async verificarSesion() {
    const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
    
    if (user) {
      this.usuarioLogueado = true;
      
      // Consultamos qué rol tiene para armar el link de su panel
      const { data: perfil } = await this.supabaseService.supabase
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (perfil) {
        this.rutaPanel = `/panel-${perfil.rol}`; // Se convierte en /panel-tienda, /panel-oficina...
      }
    } else {
      this.usuarioLogueado = false;
    }
  }

  async cerrarSesion() {
    await this.supabaseService.supabase.auth.signOut();
    this.router.navigate(['/login']);
  }
}