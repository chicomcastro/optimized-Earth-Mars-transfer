# Earth-Mars optimized transfer

Otimização de transferência interplanetária Terra → Marte (com e sem
swing-by por Vênus) usando o problema de Lambert + Particle Swarm
Optimization.

## Versão web (interativa)

Site disponível em **https://chicomcastro.github.io/optimized-Earth-Mars-transfer/**
após o deploy. Roda 100% no navegador (sem servidor): edita parâmetros e
vê ΔV/trajetória em tempo real, executa PSO ao vivo, gera porkchop plot.

Fontes em `docs/` — porte JavaScript do código MATLAB. Veja
[`tests/README.md`](tests/README.md) para os testes e2e.

### Habilitar GitHub Pages (uma vez)

1. **Settings → Pages**
2. **Source: GitHub Actions**

Depois disso, qualquer push em `master` que toque `docs/` aciona o
workflow `.github/workflows/deploy-pages.yml` e publica automaticamente.

## Versão MATLAB (original)

Rode a partir de `main.m`.
