import { Component, DestroyRef, ElementRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AvatarComponent } from '../avatar.component';
import { IconComponent } from '../icon.component';
import { ROL_ETIQUETA, UI } from '../../../core/utils/helpers';
import { SesionService } from '../../../core/services/sesion.service';


/** Si tu ruta del perfil público se llama distinto, cámbiala aquí. */
const RUTA_PERFIL = '/perfil-usuario';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, AvatarComponent],
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit {
  readonly ui = UI;
  readonly roles = ROL_ETIQUETA;
  readonly rutaPerfil = RUTA_PERFIL;

  readonly sesion = inject(SesionService);
  private router = inject(Router);
  private el = inject(ElementRef);
  private destroyRef = inject(DestroyRef);

  menuAbierto = signal(false);

  ngOnInit() {
    this.sesion.iniciar();
    // cierra el menú al navegar
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.menuAbierto.set(false));
  }

  /** Clic fuera del header = cierra el menú. */
  @HostListener('document:click', ['$event'])
  clicFuera(ev: Event) {
    if (this.menuAbierto() && !this.el.nativeElement.contains(ev.target)) this.menuAbierto.set(false);
  }

  @HostListener('document:keydown.escape')
  escape() { this.menuAbierto.set(false); }

  alternarMenu() { this.menuAbierto.update(v => !v); }

  async cerrarSesion() {
    this.menuAbierto.set(false);
    await this.sesion.cerrarSesion();
    this.router.navigate(['/login']);
  }
}