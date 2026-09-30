package app.wero.mobile.googleauth

import android.app.Activity
import android.util.Base64
import android.util.Log
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CredentialOption
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialInterruptedException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

/**
 * «Continuar con Google» con Credential Manager: la hoja nativa de cuentas de Android, sin
 * navegador y sin Custom Tabs. No hay servidor: Google solo dice quién es la persona y todo lo
 * demás se queda en el teléfono.
 *
 * Los errores salen con un código fijo que el lado JS traduce a un mensaje para la persona:
 * ERR_CANCELADO, ERR_SIN_CUENTAS, ERR_SIN_INTERNET, ERR_CONFIGURACION, ERR_NO_DISPONIBLE y
 * ERR_DESCONOCIDO. El detalle técnico va en el mensaje (el JS lo muestra solo en __DEV__).
 */
class WeroGoogleAuthModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("WeroGoogleAuth")

    // El botón «Continuar con Google»: GetSignInWithGoogleOption muestra todas las cuentas del
    // teléfono (y deja agregar una), que es lo que Google recomienda para un botón explícito.
    AsyncFunction("iniciarSesion") Coroutine { serverClientId: String ->
      try {
        val opcion = GetSignInWithGoogleOption.Builder(serverClientId).build()
        perfilDe(pedir(opcion))
      } catch (e: GetCredentialException) {
        throw traducir(e)
      } catch (e: IllegalArgumentException) {
        // serverClientId vacío o mal escrito: es configuración, no algo que la persona pueda arreglar.
        throw CodedException("ERR_CONFIGURACION", e.message, e)
      }
    }

    // Al abrir la app: solo cuentas que ya autorizaron a Wero, con selección automática. Si no
    // hay ninguna (o falla cualquier cosa) devuelve null sin mostrar nada: nunca molesta.
    AsyncFunction("iniciarSesionAutomatica") Coroutine { serverClientId: String ->
      val opcion = GetGoogleIdOption.Builder()
        .setServerClientId(serverClientId)
        .setFilterByAuthorizedAccounts(true)
        .setAutoSelectEnabled(true)
        .build()
      try {
        perfilDe(pedir(opcion))
      } catch (e: GetCredentialException) {
        Log.d(TAG, "Sin entrada automática: ${e.type} ${e.message}")
        null
      } catch (e: Exception) {
        // Cualquier otra cosa (ID de cliente vacío, sin Activity, credencial rara) tampoco molesta.
        Log.d(TAG, "Sin entrada automática: ${e.message}")
        null
      }
    }

    // Cerrar sesión o eliminar la cuenta: Credential Manager olvida la cuenta elegida, así que la
    // próxima entrada automática no entra sola con ella.
    AsyncFunction("cerrarSesion") Coroutine { ->
      val contexto = appContext.currentActivity ?: appContext.reactContext
      if (contexto != null) {
        try {
          withContext(Dispatchers.Main) {
            CredentialManager.create(contexto).clearCredentialState(ClearCredentialStateRequest())
          }
        } catch (e: ClearCredentialException) {
          // La sesión local ya se cerró; esto solo limpia la elección de cuenta. No es fatal.
          Log.w(TAG, "No se pudo limpiar Credential Manager: ${e.type} ${e.message}")
        }
      }
    }
  }

  /** Pide la credencial con la hoja nativa. Necesita la Activity de la app: la hoja sube sobre ella. */
  private suspend fun pedir(opcion: CredentialOption): androidx.credentials.Credential {
    val actividad: Activity = appContext.currentActivity
      ?: throw CodedException("ERR_NO_DISPONIBLE", "No hay una Activity en primer plano", null)
    val solicitud = GetCredentialRequest.Builder().addCredentialOption(opcion).build()
    return withContext(Dispatchers.Main) {
      CredentialManager.create(actividad).getCredential(actividad, solicitud).credential
    }
  }

  /**
   * El perfil a partir de la credencial. `GoogleIdTokenCredential.id` es el CORREO, no la
   * identidad: la identidad estable de la cuenta es el `sub` del idToken. El token no se verifica
   * (no hay servidor que lo haga) ni se guarda: solo se lee su contenido.
   */
  private fun perfilDe(credencial: androidx.credentials.Credential): Map<String, Any?> {
    if (credencial !is CustomCredential ||
      credencial.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
    ) {
      throw CodedException("ERR_DESCONOCIDO", "Credencial inesperada: ${credencial.type}", null)
    }
    val google = try {
      GoogleIdTokenCredential.createFrom(credencial.data)
    } catch (e: GoogleIdTokenParsingException) {
      throw CodedException("ERR_DESCONOCIDO", "No se pudo leer la credencial de Google", e)
    }
    val datos = leerToken(google.idToken)
    val sub = datos?.optString("sub").orEmpty()
    if (sub.isEmpty()) throw CodedException("ERR_DESCONOCIDO", "El idToken no trae sub", null)
    val email = datos?.optString("email")?.takeIf { it.isNotEmpty() } ?: google.id
    return mapOf(
      "sub" to sub,
      "email" to email,
      "nombre" to (google.displayName ?: datos?.optString("name")?.takeIf { it.isNotEmpty() }),
      "foto" to (google.profilePictureUri?.toString() ?: datos?.optString("picture")?.takeIf { it.isNotEmpty() }),
      "idToken" to google.idToken,
    )
  }

  /** El contenido (payload) del JWT, sin verificar la firma. Null si no se puede leer. */
  private fun leerToken(idToken: String): JSONObject? = try {
    val partes = idToken.split('.')
    if (partes.size < 2) null
    else JSONObject(String(Base64.decode(partes[1], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)))
  } catch (e: Exception) {
    null
  }

  /** Cada falla de Credential Manager a un código que el JS sabe explicar. */
  private fun traducir(e: GetCredentialException): CodedException {
    val detalle = "${e.type}: ${e.message}"
    val codigo = when (e) {
      is GetCredentialCancellationException -> "ERR_CANCELADO"
      // Con GetSignInWithGoogleOption, "sin credenciales" es que el teléfono no tiene cuentas de Google.
      is NoCredentialException -> "ERR_SIN_CUENTAS"
      // Sin Google Play Services o sin proveedor de credenciales: esta instalación no puede.
      is GetCredentialProviderConfigurationException, is GetCredentialUnsupportedException -> "ERR_CONFIGURACION"
      is GetCredentialInterruptedException -> "ERR_DESCONOCIDO"
      else -> porMensaje(e.message)
    }
    return CodedException(codigo, detalle, e)
  }

  /**
   * Lo que Play Services solo dice en el texto: 28444 / DEVELOPER_ERROR es el paquete o el SHA-1
   * sin registrar en Google Cloud; 7 / NETWORK_ERROR es que no hay internet.
   */
  private fun porMensaje(mensaje: String?): String {
    val m = mensaje.orEmpty().lowercase()
    return when {
      "28444" in m || "developer" in m || "[10]" in m -> "ERR_CONFIGURACION"
      "network" in m || "[7]" in m || "internet" in m -> "ERR_SIN_INTERNET"
      else -> "ERR_DESCONOCIDO"
    }
  }

  companion object {
    private const val TAG = "WeroGoogleAuth"
  }
}
