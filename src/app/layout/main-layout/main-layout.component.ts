import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarDashboardComponent } from '../sidebar-dashboard/sidebar-dashboard.component';
import { HeaderComponent } from '../../shared/components/header/header.component';


@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarDashboardComponent, HeaderComponent],
  templateUrl: './main-layout.component.html'
})
export class MainLayoutComponent {}