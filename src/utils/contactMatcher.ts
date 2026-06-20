// ── Tipos ───────────────────────────────────────────────────────────────────

export interface ParsedContact {
  name:  string;
  phone: string;
}

export type Confidence = 'alta' | 'media' | 'baja' | 'ninguna';

export interface MatchResult {
  clientId:    string;
  clientName:  string;
  clientPhone: string; // teléfono actual en la app (puede estar vacío)
  contact:     ParsedContact | null;
  confidence:  Confidence;
  score:       number;
}

// ── Normalización de teléfono ────────────────────────────────────────────────

export function normalizePhone(raw: string): string {
  let cleaned = raw.replace(/[-\s()+.]/g, '');
  if (cleaned.startsWith('0057')) cleaned = cleaned.slice(4);
  if (cleaned.startsWith('57') && cleaned.length === 12) cleaned = cleaned.slice(2);
  return cleaned;
}

function isValidColombian(phone: string): boolean {
  return /^3\d{9}$/.test(phone);
}

// ── Parser VCF ───────────────────────────────────────────────────────────────

export function parseVCF(content: string): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  const blocks = content.split(/BEGIN:VCARD/i).slice(1);

  for (const block of blocks) {
    let name  = '';
    let phone = '';
    const lines = block.split(/\r?\n/);

    for (const line of lines) {
      if (/^FN[:;]/i.test(line)) {
        name = line.replace(/^FN[:;][^:]*:/i, '').trim();
      } else if (/^TEL[:;]/i.test(line) && !phone) {
        const raw  = line.replace(/^TEL[:;][^:]*:/i, '').trim();
        const norm = normalizePhone(raw);
        if (norm.length >= 7) phone = norm;
      }
    }

    if (name) contacts.push({ name: name.trim(), phone });
  }
  return contacts;
}

// ── Parser CSV ───────────────────────────────────────────────────────────────

export function parseCSV(content: string): ParsedContact[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.toLowerCase().trim().replace(/"/g, ''));
  const nameIdx  = headers.findIndex(h => ['name','nombre','full name','nombre completo','fn'].includes(h));
  const phoneIdx = headers.findIndex(h => ['phone','tel','celular','mobile','movil','telefono','number'].includes(h));

  if (nameIdx === -1) return [];

  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const name  = cols[nameIdx]  ?? '';
    const phone = phoneIdx !== -1 ? normalizePhone(cols[phoneIdx] ?? '') : '';
    return { name: name.trim(), phone };
  }).filter(c => c.name);
}

// ── Parser XLSX (usa la lib ya instalada) ────────────────────────────────────

export async function parseXLSX(buffer: ArrayBuffer): Promise<ParsedContact[]> {
  const XLSX = await import('xlsx');
  const wb   = XLSX.read(buffer, { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  return rows.map(row => {
    const keys = Object.keys(row).map(k => k.toLowerCase());
    const nameKey  = Object.keys(row).find(k => ['name','nombre','full name','nombre completo'].includes(k.toLowerCase()));
    const phoneKey = Object.keys(row).find(k => ['phone','celular','tel','mobile','telefono'].includes(k.toLowerCase()));
    const name  = nameKey  ? String(row[nameKey]).trim()  : '';
    const phone = phoneKey ? normalizePhone(String(row[phoneKey])) : '';
    void keys;
    return { name, phone };
  }).filter(c => c.name);
}

// ── Normalización de nombre ──────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Distancia Levenshtein ────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

// ── Matching principal ───────────────────────────────────────────────────────

export function matchContactsToClients(
  clients: { id: string; name: string; phone: string }[],
  contacts: ParsedContact[],
): MatchResult[] {
  return clients.map(client => {
    const normClient   = normalizeName(client.name);
    const clientWords  = normClient.split(' ').filter(w => w.length > 2);
    const normClientPhone = normalizePhone(client.phone ?? '');

    let best: { contact: ParsedContact; confidence: Confidence; score: number } | null = null;

    for (const contact of contacts) {
      if (!contact.phone) continue;
      const normContact  = normalizeName(contact.name);
      const contactWords = normContact.split(' ').filter(w => w.length > 2);
      const normPhone    = normalizePhone(contact.phone);

      let score      = 0;
      let confidence: Confidence = 'ninguna';

      // 1. Teléfono igual → coincidencia directa
      if (normClientPhone && normClientPhone === normPhone) {
        score = 100; confidence = 'alta';
      }
      // 2. Nombre exacto normalizado
      else if (normClient === normContact) {
        score = 95; confidence = 'alta';
      }
      // 3. Uno contiene al otro
      else if (normClient.includes(normContact) || normContact.includes(normClient)) {
        const ratio = Math.min(normClient.length, normContact.length) /
                      Math.max(normClient.length, normContact.length);
        score = Math.round(ratio * 88);
        confidence = ratio >= 0.55 ? 'alta' : 'media';
      }
      // 4. Palabras compartidas
      else {
        const shared = clientWords.filter(w => contactWords.includes(w));
        if (shared.length >= 2) {
          score = Math.round(shared.length / Math.max(clientWords.length, contactWords.length) * 80);
          confidence = 'alta';
        } else if (shared.length === 1 && shared[0].length >= 4) {
          score = 48; confidence = 'media';
        } else {
          // 5. Levenshtein como fallback
          const dist = levenshtein(normClient, normContact);
          if (dist <= 2)      { score = 70; confidence = 'alta'; }
          else if (dist <= 4) { score = 38; confidence = 'media'; }
          else if (dist <= 6) { score = 15; confidence = 'baja'; }
        }
      }

      if (score > (best?.score ?? 0)) {
        best = { contact, confidence, score };
      }
    }

    // Si el número sugerido ya es válido y el cliente no tiene celular → subir confianza
    if (best && best.confidence === 'media' && !isValidColombian(normClientPhone)) {
      const normSuggested = normalizePhone(best.contact.phone);
      if (isValidColombian(normSuggested) && best.score >= 45) {
        best.confidence = 'alta';
      }
    }

    return {
      clientId:    client.id,
      clientName:  client.name,
      clientPhone: client.phone ?? '',
      contact:     best?.contact ?? null,
      confidence:  best?.confidence ?? 'ninguna',
      score:       best?.score ?? 0,
    };
  });
}

export { isValidColombian };
