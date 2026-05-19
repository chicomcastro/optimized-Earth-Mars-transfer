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
toca `docs/`, `tests/`, ou config. Ao final:

- faz upload de `screenshots/` como artifact (30 dias de retenção)
- faz upload de `playwright-report/` como artifact (14 dias)
- comenta no PR com links para o run do workflow (sticky, atualizado a cada push)

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
