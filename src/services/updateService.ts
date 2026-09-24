export interface AppVersionInfo {
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  changelog: string[];
  downloadUrl: string;
  isMandatory: boolean;
  hasUpdate: boolean;
}

const CURRENT_APP_VERSION = '1.0.0';
const DEFAULT_VERSION_MANIFEST_URL = 'https://raw.githubusercontent.com/borneoetam/ketoko-pos/main/public/version.json';

// Compare simple semver string '1.0.1' > '1.0.0'
export function isNewerVersion(remoteVer: string, currentVer: string): boolean {
  try {
    const rParts = remoteVer.replace(/^v/i, '').split('.').map(Number);
    const cParts = currentVer.replace(/^v/i, '').split('.').map(Number);
    for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
      const r = rParts[i] || 0;
      const c = cParts[i] || 0;
      if (r > c) return true;
      if (r < c) return false;
    }
    return false;
  } catch {
    return false;
  }
}

export async function checkForAppUpdates(customUrl?: string): Promise<AppVersionInfo | null> {
  const targetUrl = customUrl || DEFAULT_VERSION_MANIFEST_URL;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    // Try fetching remote version.json
    const res = await fetch(targetUrl + `?t=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      // Fallback check from local public version.json
      const localRes = await fetch('./version.json');
      if (localRes.ok) {
        const localData = await localRes.json();
        const hasUp = isNewerVersion(localData.latestVersion || CURRENT_APP_VERSION, CURRENT_APP_VERSION);
        return {
          currentVersion: CURRENT_APP_VERSION,
          latestVersion: localData.latestVersion || CURRENT_APP_VERSION,
          releaseDate: localData.releaseDate || new Date().toISOString().split('T')[0],
          changelog: localData.changelog || ['Peningkatan performa dan stabilitas sistem kasir'],
          downloadUrl: localData.downloadUrl || 'https://borneoetam.com',
          isMandatory: Boolean(localData.isMandatory),
          hasUpdate: hasUp
        };
      }
      return null;
    }

    const data = await res.json();
    const latestVersion = data.latestVersion || data.version || CURRENT_APP_VERSION;
    const hasUpdate = isNewerVersion(latestVersion, CURRENT_APP_VERSION);

    return {
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: latestVersion,
      releaseDate: data.releaseDate || new Date().toISOString().split('T')[0],
      changelog: Array.isArray(data.changelog) ? data.changelog : [data.changelog || 'Pembaruan versi terbaru'],
      downloadUrl: data.downloadUrl || 'https://borneoetam.com',
      isMandatory: Boolean(data.isMandatory),
      hasUpdate: hasUpdate
    };
  } catch {
    // If offline or fetch failed, check local version.json
    try {
      const localRes = await fetch('./version.json');
      if (localRes.ok) {
        const localData = await localRes.json();
        const hasUp = isNewerVersion(localData.latestVersion || CURRENT_APP_VERSION, CURRENT_APP_VERSION);
        return {
          currentVersion: CURRENT_APP_VERSION,
          latestVersion: localData.latestVersion || CURRENT_APP_VERSION,
          releaseDate: localData.releaseDate || new Date().toISOString().split('T')[0],
          changelog: localData.changelog || ['Peningkatan performa'],
          downloadUrl: localData.downloadUrl || 'https://borneoetam.com',
          isMandatory: Boolean(localData.isMandatory),
          hasUpdate: hasUp
        };
      }
    } catch {}
    return null;
  }
}

