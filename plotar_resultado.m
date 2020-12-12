% Vetor de estado que caracteriza nossa transferencia de interesse
%x = [ 2.6147    6.2832    3.0095    0.8353 3.09 261.96 2.28];
format shortg
x = best_global;
simulate;

plot_v = 0;
plot_info = 0;

UA = 1.496e8;

figure;
legenda = string();
legenda(end+1) = plotar_ponto([0,0], "Sol",  'd');
legenda(end+1) = plotar_ponto(r_terra_sol/UA, "Terra",  'o');
legenda(end+1) = plotar_ponto(r_venus_sol/UA, "Venus",  'o');
legenda(end+1) = plotar_ponto(r_marte_sol/UA, "Marte",  'o');

disp("Velocidade de saída da Terra: " + norm(banco_velocidades_saida(1,:)));
disp(banco_velocidades_saida(1,:));
disp("Velocidade de chegada 1: " + norm(banco_velocidades_chegada(1,:)));
disp(banco_velocidades_chegada(1,:));

if venus_swing_by == 1
    % Órbita BC: Transferência Terra-Venus
    [x,y] = definir_orbita_cartesiana(...
        r_terra_sol, ...
        banco_velocidades_saida(1,:), ...
        mi_sol);
    legenda(end+1) = plotar_ponto([x' y']/UA, "Trajetória T-V", '-');

    % Órbita BC: Transferência Venus-Marte
    [x,y] = definir_orbita_cartesiana(...
        r_venus_sol, ...
        banco_velocidades_saida(2,:), ...
        mi_sol);
    legenda(end+1) = plotar_ponto(([x' y'])/UA, "Trajetória V-M", '-');
else
    % Órbita BC: Transferência Terra-Marte
    [x,y] = definir_orbita_cartesiana(...
        r_terra_sol, ...
        banco_velocidades_saida(1,:), ...
        mi_sol);
    legenda(end+1) = plotar_ponto([x' y']/UA, "Trajetória T-M", '-');
end

theta = [0:pi/180:2*pi];
earth.x = R_earth_sun.*cos(theta)/ud;
earth.y = R_earth_sun.*sin(theta)/ud;
earth.z = theta*0/ud;
mars.x = R_mars_sun.*cos(theta)/ud;
mars.y = R_mars_sun.*sin(theta)/ud;
mars.z = theta*0/ud;
venus.x = R_venus_sun.*cos(theta)/ud;
venus.y = R_venus_sun.*sin(theta)/ud;
venus.z = theta*0/ud;
legenda(end+1) = plotar_ponto([earth.x' earth.y'], "Órbita Terra", '--');
legenda(end+1) = plotar_ponto([mars.x' mars.y'], "Órbita Marte", '--');
legenda(end+1) = plotar_ponto([venus.x' venus.y'], "Órbita Vênus", '--');

disp("Custos: ");
disp(deltaV);

grid on;
axis equal
legend(legenda(2:end), 'Location', 'eastoutside');
title('Cônicas das trajetórias da espaçonave');
xlabel('x [UA]');
ylabel('y [UA]');

% Axis equal
lim = 1.6;
xlim([-lim lim]);
ylim([-lim lim]);

function [x,y] = definir_orbita_cartesiana(r_,v_,mi_)

r = orbita_from_rv(r_, v_, mi_);
theta = pi/180:pi/180:2*pi;
raio = r(theta);
x = raio.*cos(theta);
y = raio.*sin(theta);

end
