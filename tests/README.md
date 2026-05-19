# Testes E2E

Testes end-to-end do simulador web em `/docs`, usando Playwright. Geram
screenshots automaticamente para servirem como evidências visuais em cada PR.

## Localmente

```bash
npm install
npx playwright install --with-deps chromium
npm run test:e2e
npm run report     # abre o relatório HTML
```

Os screenshots ficam em `screenshots/` e também aparecem no relatório HTML
(`playwright-report/index.html`).

## CI

O workflow `.github/workflows/e2e.yml` roda automaticamente em todo PR que
toca `docs/`, `tests/`, ou config. Ao final, ele:

1. Faz upload de `screenshots/` como artifact (30 dias) e `playwright-report/` (14 dias)
2. **Publica os PNGs na branch dedicada `screenshots`** sob `pr-{N}/{commit_short}/`
3. **Comenta no PR (sticky) com as imagens embutidas inline**, referenciando-as via `raw.githubusercontent.com`

Assim cada push em um PR atualiza um único comentário com a grade visual
das telas — sem precisar baixar artifact. Imagens são clicáveis pra ver em
tamanho original.

### Como funciona o auto-postagem das evidências

- Permissão `contents: write` no workflow permite ao `GITHUB_TOKEN` fazer push.
- A branch `screenshots` é criada como **orphan** na primeira execução.
- Cada PR tem seu diretório isolado; uma execução não sobrescreve a anterior
  (o commit SHA vira parte do path), então o histórico de evidências fica
  preservado.
- Para limpar evidências antigas, basta deletar diretórios ou a branch toda
  manualmente — não há nada acoplado a ela.

## Fluxos cobertos

| # | Nome | O que valida |
|---|------|--------------|
| 01 | landing page | hero, nav, todas as 7 seções presentes |
| 02 | swing-by preset | ΔV ≈ 8 km/s, 5 inputs |
| 03 | direct preset | ΔV ≈ 5,7 km/s, 2 inputs |
| 04 | edição de parâmetro | ΔV recalcula em tempo real |
| 05 | PSO direto | convergência < 7 km/s |
| 06 | PSO swing-by | convergência válida |
| 07 | porkchop plot | renderização do mapa de contorno |
| 08 | viewport mobile | layout responsivo (390×844) |
