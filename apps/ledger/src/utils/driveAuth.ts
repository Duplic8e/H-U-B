export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export const TOKEN_TIMEOUT_MS = 120000

const GIS_SRC = 'https://accounts.google.com/gsi/client'

interface TokenResponse {
  access_token?: string
  error?: string
}

interface TokenClientConfig {
  client_id: string
  scope: string
  callback: (response: TokenResponse) => void
  error_callback?: (error: { type: string }) => void
}

interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient: (config: TokenClientConfig) => { requestAccessToken: () => void }
    }
  }
}

function googleGlobal(): GoogleGlobal | undefined {
  return (window as unknown as { google?: GoogleGlobal }).google
}

let cachedToken: string | undefined
let gisPromise: Promise<void> | undefined

export function getCachedToken(): string | undefined {
  return cachedToken
}

export function clearCachedToken(): void {
  cachedToken = undefined
}

/** Injects the GIS script once. Resolves immediately if google is already present. */
export function loadGis(): Promise<void> {
  if (googleGlobal()) return Promise.resolve()
  if (gisPromise) return gisPromise
  gisPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      gisPromise = undefined
      reject(new Error('Could not reach Google. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })
  return gisPromise
}

/** Prompts for consent and resolves with an in-memory access token. */
export async function requestAccessToken(clientId: string): Promise<string> {
  await loadGis()
  const google = googleGlobal()
  if (!google) throw new Error('Could not reach Google. Check your connection and try again.')

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Google did not respond. The sign-in window may have been blocked. Try again.'))
    }, TOKEN_TIMEOUT_MS)

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        clearTimeout(timer)
        if (response.access_token) {
          cachedToken = response.access_token
          resolve(response.access_token)
          return
        }
        reject(new Error(response.error ?? 'Google did not return an access token.'))
      },
      error_callback: () => {
        clearTimeout(timer)
        reject(new Error('Google sign-in was cancelled.'))
      },
    })
    client.requestAccessToken()
  })
}
