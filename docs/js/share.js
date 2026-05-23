// =============================================================================
// share.js — URL com state da missão + params, copiar link, baixar PNG
//
// Formato da URL: <origin>#/m/<missionId>?s=<base64url>
// Payload codificado (JSON): { x: [...], f: 'helio'|'geo'|'syn' }
// Compatibilidade backward: #/mission/<id> sem ?s continua funcionando.
// =============================================================================

(function () {
  'use strict';

  // base64url helpers (encode/decode com URL-safe charset)
  function toB64Url(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64Url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    try { return decodeURIComponent(escape(atob(s))); } catch (_) { return null; }
  }

  // Round params pra encurtar URL (precisão 4 casas)
  function roundParams(x) {
    return x.map((v) => Math.round(v * 10000) / 10000);
  }

  function encodeState({ missionId, x, frame }) {
    const payload = { x: roundParams(x || []) };
    if (frame && frame !== 'helio') payload.f = frame;
    const json = JSON.stringify(payload);
    return toB64Url(json);
  }

  function decodeState(b64) {
    if (!b64) return null;
    const json = fromB64Url(b64);
    if (!json) return null;
    try {
      const obj = JSON.parse(json);
      if (!Array.isArray(obj.x)) return null;
      return { x: obj.x, frame: obj.f || 'helio' };
    } catch (_) { return null; }
  }

  // Constrói URL completa pro share
  function buildShareURL(missionId, x, frame) {
    const s = encodeState({ missionId, x, frame });
    const base = window.location.origin + window.location.pathname;
    return `${base}#/m/${missionId}?s=${s}`;
  }

  // Parse hash atual procurando state codificado
  //   #/m/<id>?s=<b64>     → { missionId, x, frame }
  //   #/mission/<id>       → { missionId } (sem state, usa preset default)
  //   #<seção>             → null (não é mission route)
  function parseHash(hash) {
    hash = hash || window.location.hash || '';
    if (hash.startsWith('#/m/')) {
      const rest = hash.slice(4); // remove "#/m/"
      const qIdx = rest.indexOf('?');
      const missionId = qIdx >= 0 ? rest.slice(0, qIdx) : rest;
      const query = qIdx >= 0 ? rest.slice(qIdx + 1) : '';
      const params = new URLSearchParams(query);
      const state = decodeState(params.get('s'));
      return { missionId, state };
    }
    if (hash.startsWith('#/mission/')) {
      return { missionId: hash.slice(10), state: null };
    }
    return null;
  }

  // Atualiza URL sem fazer scroll/reload (debounced via caller)
  function updateURLWithState(missionId, x, frame) {
    if (!missionId) return;
    const url = `#/m/${missionId}?s=${encodeState({ x, frame })}`;
    try { history.replaceState(null, '', url); } catch (_) {}
  }

  // Clipboard com fallback pra navegadores antigos
  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
    }
    // Fallback: textarea hidden + execCommand('copy')
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  // Download PNG do plot via Plotly.toImage
  async function downloadPlotPNG(divId, filename) {
    const div = document.getElementById(divId);
    if (!div || !window.Plotly) return false;
    try {
      const dataUrl = await Plotly.toImage(div, {
        format: 'png', width: 1200, height: 1200, scale: 1,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename || 'trajectory.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch (e) {
      console.error('PNG download failed:', e);
      return false;
    }
  }

  window.Share = {
    encodeState, decodeState,
    buildShareURL, parseHash, updateURLWithState,
    copyToClipboard, downloadPlotPNG,
  };
})();
