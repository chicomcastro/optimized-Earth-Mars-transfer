% Validar dados

dados;

x = best_global;

funcao_custo;

figure;
plotar(r_terra_sol, '', 'bo');
hold on;
plotar(r_venus_sol, '', 'ro');
hold on;
plotar(r_marte_sol, '', 'go');
hold on;
plotar([0 0 0], '', 'yo');

legend('Terra', 'Venus', 'Marte', 'Sol');