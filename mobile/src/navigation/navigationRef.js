import { createNavigationContainerRef } from '@react-navigation/native';

// Ref global de navegación — permite navegar desde fuera de un componente
// (ej. al tocar una notificación push, ver services/pushNavigation.js). Se
// separa de navigation/index.js en su propio archivo para que ese módulo
// (que sí importa todas las pantallas) no tenga que importarse desde donde
// se procesan las notificaciones, y viceversa.
export const navigationRef = createNavigationContainerRef();
