# Pruebas de humo (Maestro)

Recorren la app en el **APK release** en un teléfono de verdad y revisan que no se congele ni se cierre.

| Flujo | Qué hace |
|---|---|
| `01_entrar.yaml` | abre la app desde cero (borra sus datos) y entra sin cuenta, saltando la bienvenida |
| `02_estudio.yaml` | 5 tarjetas de Estudio (elige una opción y «Siguiente») |
| `03_juegos.yaml` | una ronda de humo de Colmena, Pares, Caída, Dulces y Cázala: entra al nivel que toca, toca el tablero, contesta si sale una pregunta y regresa |
| `04_lectura.yaml` | abre «Wero y el taco perdido», la escucha unos segundos y sale |
| `05_pantallas.yaml` | Laboratorio de sonidos (desliza dos fonemas), Gramática, Phrasal y Errores |

`comun/` son pedazos que usan los demás: entrar, abrir un modo desde su grupo en Practicar, jugar y volver. Las
opciones llevan `testID="opcion-N"` (no se ve ni lo anuncia el lector de pantalla); lo demás se toca por su texto.

Una ronda de juego es de humo: toca el tablero en dos puntos y deja correr el tiempo. Sirve para ver que el juego
entra, anima, responde y sale sin trabarse; no para probar que se gana.

## Correrlas en Windows con el teléfono conectado

1. **Java 17 o más nuevo** (`java -version`). Si no está: Temurin 17 (adoptium.net).
2. **adb** (Android platform-tools). Descomprime `platform-tools` y agrega la carpeta al `PATH`.
3. **Maestro:** baja `maestro.zip` del último release de https://github.com/mobile-dev-inc/maestro/releases, descomprímelo
   (p. ej. en `C:\maestro`) y agrega `C:\maestro\bin` al `PATH`. Revisa con `maestro --version`.
   (Alternativa: WSL2 con `curl -fsSL "https://get.maestro.mobile.dev" | bash`, pasando el teléfono con `usbipd`.)
4. En el teléfono: Opciones de desarrollador → **Depuración por USB** activada; conéctalo y acepta la huella.
   `adb devices` debe listarlo como `device`.
5. Instala el release: `adb install -r android\app\build\outputs\apk\release\app-release.apk`.
6. Desde la raíz del proyecto:

   ```powershell
   maestro test e2e            # todas, en orden
   maestro test e2e\02_estudio.yaml   # una sola
   ```

   Al terminar, Maestro dice cuáles pasaron. Si una falla, guarda capturas y el registro en
   `%USERPROFILE%\.maestro\tests\<fecha>`.

Mientras corren, en otra terminal: `scripts\medir-memoria.sh resistencia 30` (desde Git Bash) para ver la memoria y
contar cierres al mismo tiempo.

## Si falla

- **No encuentra un texto:** puede que cambió en la app. Los textos salen de `src/shared/navegacion/modos.ts` (títulos
  de los modos), `AuthScreen` («Entrar sin cuenta») y los botones («Siguiente», «Jugar nivel N»).
- **Se queda esperando «Juegos»:** la app no llegó a Practicar (se trabó en la entrada o se cerró). Copia el reporte de
  Ajustes → Acerca de → «Copiar reporte de errores».
