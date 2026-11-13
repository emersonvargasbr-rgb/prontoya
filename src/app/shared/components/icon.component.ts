import { Component, Input } from '@angular/core';

/**
 * Uso:  <app-icon nombre="check" clase="w-4 h-4" />
 *       <app-icon nombre="star" [relleno]="true" clase="w-4 h-4 text-amber-500" />
 * El color se hereda del texto (currentColor), así que se controla con text-*.
 * Para agregar un icono nuevo, sólo añade una entrada a ICONOS.
 */
const ICONOS: Record<string, string> = {
  // --- TUS ICONOS EXISTENTES ---
  check: 'M5 13l4 4L19 7',
  x: 'M6 18L18 6M6 6l12 12',
  plus: 'M12 4v16m8-8H4',
  pencil: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  star: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  'user-plus': 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  'user-minus': 'M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6',
  scissors: 'M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z',
  cog: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  bag: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  'chevron-down': 'M19 9l-7 7-7-7',
  'arrow-left': 'M10 19l-7-7m0 0l7-7m-7 7h18',
  flag: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9',
  briefcase: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  pin: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  verified: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
  inbox: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
  archive: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  megaphone: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  layers: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  undo: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6',
  alert: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  coin: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  share: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8m-4-6l-4-4-4 4m4-4v13',
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  dots: 'M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z',
  logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  login: 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1',
  'chevron-left': 'M15 19l-7-7 7-7',
  'chevron-right': 'M9 5l7 7-7 7',
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',

  // --- 50 ANIMALES DE LA IMAGEN (FILA POR FILA) ---
  // Fila 1
  'animal-hipopotamo': 'M4 7a3 3 0 013-3h10a3 3 0 013 3v6a5 5 0 01-5 5H9a5 5 0 01-5-5V7zm3 3h2v2H7v-2zm8 0h2v2h-2v-2zm-6 5h4v1H9v-1z',
  'animal-caballo': 'M9 3l3 3 3-3v5a4 4 0 01-8 0V3z M11 11h2v8h-2v-8z',
  'animal-burro': 'M10 2l2 4 2-4v6a3 3 0 01-4 0V2z M11 10h2v9h-2v-9z',
  'animal-koala': 'M6 5a3 3 0 10-3 3 1 1 0 011 1v1a6 6 0 1010 0v-1a1 1 0 011-1 3 3 0 10-3-3',
  'animal-oveja': 'M8 4a4 4 0 018 0 3 3 0 013 3 4 4 0 01-1 8 5 5 0 01-10 0 4 4 0 01-1-8 3 3 0 011-3z',

  // Fila 2
  'animal-pantera': 'M4 6a3 3 0 013-3h10a3 3 0 013 3v7a5 5 0 01-5 5H9a5 5 0 01-5-5V6zm4 4h2v2H8v-2zm6 0h2v2h-2v-2z',
  'animal-leon': 'M12 2a10 10 0 1010 10A10 10 0 0012 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z',
  'animal-mono': 'M7 5a5 5 0 1110 0v7a5 5 0 01-10 0V5z M9 9h2v2H9V9zm4 0h2v2h-2V9z',
  'animal-carnero': 'M7 4a5 5 0 1010 0 5 5 0 00-10 0z M5 8a4 4 0 004 4v2a6 6 0 01-6-6V8z',
  'animal-raton': 'M4 7a2 2 0 10-4 0 2 2 0 004 0z M20 7a2 2 0 104 0 2 2 0 00-4 0z M7 6a5 5 0 0110 0v7a5 5 0 01-10 0V6z',

  // Fila 3
  'animal-pulpo': 'M12 2a4 4 0 014 4v2a2 2 0 01-2 2h-4a2 2 0 01-2-2V6a4 4 0 014-4z M4 12c0 3 2 8 2 8s1-4 2-4 1 4 2 4 1-4 2-4 1 4 2 4 2-5 2-8',
  'animal-buho': 'M6 4a6 6 0 0112 0v8a6 6 0 01-12 0V4z M8 8a2 2 0 104 0 2 2 0 00-4 0z M12 8a2 2 0 104 0 2 2 0 00-4 0z',
  'animal-oso': 'M5 4a3 3 0 00-3 3v2a3 3 0 003 3h1v2a5 5 0 0010 0v-2h1a3 3 0 003-3V7a3 3 0 00-3-3H5z',
  'animal-loro': 'M8 4l8 4-4 8-4-4V4z M10 8h2v2h-2V8z',
  'animal-cerdo': 'M5 5a3 3 0 013-3h8a3 3 0 013 3v8a5 5 0 01-5 5h-4a5 5 0 01-5-5V5zm4 7h6v3H9v-3z',

  // Fila 4
  'animal-conejo': 'M9 2c-1 0-2 2-2 4v4a4 4 0 008 0V6c0-2-1-4-2-4z M7 12a5 5 0 0010 0v7H7v-7z',
  'animal-hipopotamo-mini': 'M5 6a3 3 0 013-3h8a3 3 0 013 3v5a4 4 0 01-4 4h-6a4 4 0 01-4-4V6z',
  'animal-foca': 'M6 7a5 5 0 0110 0v6a4 4 0 01-4 4h-2a4 4 0 01-4-4V7z',
  'animal-tiburones': 'M3 15h18l-3-6H6l-3 6z M11 4l2 5h-2V4z',
  'animal-pez-globo': 'M6 6h12v12H6V6z M4 10h2v4H4v-4z M18 10h2v4h-2v-4z',

  // Fila 5
  'animal-tigre': 'M5 4a4 4 0 018 0v1h2a4 4 0 014 4v8a5 5 0 01-5 5H8a5 5 0 01-5-5V9a4 4 0 012-3V4z',
  'animal-gorila': 'M6 4a5 5 0 0112 0v10a5 5 0 01-12 0V4z M9 8h2v2H9V8zm4 0h2v2h-2V8z',
  'animal-ballena': 'M4 10h12a4 4 0 014 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-4z M14 6l3 4h-3V6z',
  'animal-gato-salvaje': 'M5 5l2-2h10l2 2v8a5 5 0 01-5 5h-4a5 5 0 01-5-5V5z',
  'animal-cebra': 'M9 2l2 4 2-4v16H9V2z M10 6h4v1h-4V6zm0 3h4v1h-4V3z',

  // Fila 6
  'animal-chimpance': 'M6 5a6 6 0 0112 0v9a6 6 0 01-12 0V5z M9 9h2v2H9V9zm4 0h2v2h-2V9z',
  'animal-perezoso': 'M6 4h12v12a6 6 0 01-12 0V4z M9 8h2v2H9V8zm4 0h2v2h-2V8z',
  'animal-oso-pardo': 'M5 4a3 3 0 00-3 3v3a5 5 0 0010 0V7a3 3 0 00-3-3H5z M14 4a3 3 0 00-3 3v3a5 5 0 0010 0V7a3 3 0 00-3-3h-4z',
  'animal-hormiguero': 'M8 4l8 2-2 10H10L8 4z',
  'animal-vaca': 'M5 5l-2-2v4a5 5 0 005 5h8a5 5 0 005-5V3l-2 2H5z',

  // Fila 7
  'animal-toro': 'M3 5l3-2v3a6 6 0 0012 0V3l3 2-2 4H5L3 5z',
  'animal-cabra': 'M8 2l2 3-2 3h8l-2-3 2-3H8z M9 9h6v9H9V9z',
  'animal-gato': 'M4 5l3-3h10l3 3v8a5 5 0 01-5 5h-4a5 5 0 01-5-5V5z',
  'animal-pantera-negra': 'M5 4l3-2h8l3 2v10a5 5 0 01-5 5h-6a5 5 0 01-5-5V4z',
  'animal-pajaro': 'M10 4l4 4-4 4V4z M8 12h8v8H8v-8z',

  // Fila 8
  'animal-búfalo': 'M2 6l4-2v4a6 6 0 0012 0V4l4 2-2 5H4L2 6z',
  'animal-pato': 'M8 4a4 4 0 018 0v6a4 4 0 01-8 0V4z M11 14h2v6h-2v-6z',
  'animal-ciervo': 'M9 2l3 4 3-4v5a4 4 0 01-6 0V2z M10 9h4v10h-4V9z',
  'animal-dinosaurio': 'M4 14l6-8h4l6 8v4H4v-4z',
  'animal-perro': 'M5 5l2-2h10l2 2v10a5 5 0 01-5 5h-4a5 5 0 01-5-5V5z',

  // Fila 9
  'animal-burro-perfil': 'M8 2l2 4 4-2-2 6a4 4 0 01-4-8z M9 8h6v11H9V8z',
  'animal-gallina': 'M9 4h6v6a3 3 0 01-6 0V4z M11 10h2v10h-2V10z',
  'animal-perro-poodle': 'M7 4a5 5 0 0110 0v10a5 5 0 01-10 0V4z M9 14h6v6H9v-6z',
  'animal-aguila': 'M6 4l6 2 6-2-2 8H8L6 4z M10 12h4v8h-4v-8z',
  'animal-elefante': 'M7 4a5 5 0 0110 0v8a6 6 0 01-6 6h-2a2 2 0 01-2-2v-6a5 5 0 010-6z',

  // Fila 10
  'animal-conejo-orejas': 'M8 2l2 4v6a3 3 0 01-6 0V6l2-4z M10 12h4v8h-4v-8z',
  'animal-rana': 'M4 8a8 8 0 0116 0v6a4 4 0 01-4 4H8a4 4 0 01-4-4V8z',
  'animal-jirafa': 'M10 2h4v10h-4V2z M8 12h8v8H8v-8z',
  'animal-carnero-2': 'M7 3l3 3-3 3h10l-3-3 3-3H7z M9 9h6v10H9V9z',
  'animal-buho-2': 'M7 3l5 3 5-3v8a5 5 0 01-10 0V3z',
  'animal-burro-cara': 'M7 4h10a3 3 0 013 3v4a7 7 0 01-14 0V7a3 3 0 013-3zm2 5h2v2H9V9zm6 0h2v2h-2V9zm-3 4l-2 3h4l-2-3z',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg [class]="clase" viewBox="0 0 24 24"
         [attr.fill]="relleno ? 'currentColor' : 'none'"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path [attr.d]="trazo" />
    </svg>
  `,
})
export class IconComponent {
  @Input({ required: true }) nombre!: string;
  @Input() clase = 'w-4 h-4';
  @Input() relleno = false;

  get trazo(): string {
    return ICONOS[this.nombre] ?? ICONOS['alert'];
  }
}
