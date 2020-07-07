% Vetor de estado que caracteriza nossa transferencia de interesse
%x = [ 2.6147    6.2832    3.0095    0.8353 3.09 261.96 2.28];
x = best_global;
funcao_custo;

UA = 1.496e8;

% Órbita BC: Transferência entre esferas de influência Terra - Venus
disp("Velocidade de saída da SOI da Terra: ");
disp(banco_velocidades_saida(2,:));
disp("Velocidade de chegada na SOI de Venus: ");
disp(banco_velocidades_chegada(2,:));
[x,y] = definir_orbita_cartesiana(...
    r_soi_terra + r_terra_sol, ...
    banco_velocidades_saida(2,:), ...
    mi_sol);
figure;
legenda = string();
legenda(end+1) = plotar_ponto([0,0], "Sol");
legenda(end+1) = plotar_ponto(r_terra_sol/UA, "Terra");
legenda(end+1) = plotar_ponto((r_soi_terra + r_terra_sol)/UA, "B");
legenda(end+1) = plotar_ponto(r_venus_sol/UA, "Venus");
legenda(end+1) = plotar_ponto((r_soi_venus + r_venus_sol)/UA, "C");
legenda(end+1) = plotar_ponto([x' y']/UA, "Trajetória", '-');

% Órbita CD: Transferência entre esferas dentro da influência de Vênus
[x,y] = definir_orbita_cartesiana(...
    r_soi_venus, ...
    banco_velocidades_saida(3,:), ...
    mi_venus);
legenda(end+1) = plotar_ponto((r_soi_venus * M(deflexao_venus) + r_venus_sol)/UA, "D");
legenda(end+1) = plotar_ponto(([x' y'] + r_venus_sol(1:2))/UA, "Trajetória", '-');

% Órbita DE: Transferência SOI(Venus)-SOI(Marte)
[x,y] = definir_orbita_cartesiana(...
    r_soi_venus * M(deflexao_venus) + r_venus_sol, ...
    banco_velocidades_saida(4,:), ...
    mi_sol);
legenda(end+1) = plotar_ponto((r_soi_marte + r_marte_sol)/UA, "E");
legenda(end+1) = plotar_ponto(([x' y'])/UA, "Trajetória", '-');
legenda(end+1) = plotar_ponto(r_marte_sol/UA, "Marte");


% Órbita DE: Transferência SOI(Marte)-OE(Marte)
[x,y] = definir_orbita_cartesiana(...
    r_soi_marte, ...
    banco_velocidades_saida(5,:), ...
    mi_marte);
legenda(end+1) = plotar_ponto(([x' y'] + r_marte_sol(1:2))/UA, "Trajetória", '-');
legenda(end+1) = plotar_ponto((r_marte_sol + r_oe_marte)/UA, "F");

grid on;
axis equal
legend(legenda(2:end));
xlabel('x [UA]');
ylabel('y [UA]');

plotar_vetor(banco_velocidades_saida(2,:), (r_soi_terra + r_terra_sol)/UA, 0.01);
plotar_vetor(banco_velocidades_saida(3,:), (r_soi_venus + r_venus_sol)/UA, 0.01);
plotar_vetor(v_venus_sol, (r_venus_sol)/UA, 0.01);
plotar_vetor(banco_velocidades_saida(4,:), (r_soi_venus * M(deflexao_venus) + r_venus_sol)/UA, 0.01);
plotar_vetor(banco_velocidades_chegada(4,:), (r_soi_marte + r_marte_sol)/UA, 0.01);


function [x,y] = definir_orbita_cartesiana(r_,v_,mi_)

r = orbita_from_rv(r_, v_, mi_);
theta = pi/180:pi/180:2*pi;
raio = r(theta);
x = raio.*cos(theta);
y = raio.*sin(theta);

end
