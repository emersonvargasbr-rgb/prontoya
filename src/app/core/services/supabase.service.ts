import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../enviroments/enviroment';


@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  public supabase: SupabaseClient;

  constructor() {
    // Inicializa la conexión con tu URL y tu Key pública
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }
}