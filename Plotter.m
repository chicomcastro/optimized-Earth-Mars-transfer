% Vetor de estado que caracteriza nossa transferencia de interesse
%x = [ 2.6147    6.2832    3.0095    0.8353 3.09 261.96 2.28];
format shortg
x = best_global;
funcao_custo;

plot_v = 0;
plot_info = 0;

UA = 1.496e8;

figure;
legenda = string();
legenda(end+1) = plotar_ponto([0,0], "Sol",  'd');
legenda(end+1) = plotar_ponto(r_terra_sol/UA, "Terra",  'o');
legenda(end+1) = plotar_ponto(r_venus_sol/UA, "Venus",  'o');
legenda(end+1) = plotar_ponto(r_marte_sol/UA, "Marte",  'o');

% Órbita AB: Transferência Terra - Venus
disp("Velocidade de saída da Terra: ");
disp(banco_velocidades_saida(1,:));
disp("Velocidade de chegada em Venus: ");
disp(banco_velocidades_chegada(1,:));
[x,y] = definir_orbita_cartesiana(...
    r_terra_sol, ...
    banco_velocidades_saida(1,:), ...
    mi_sol);
legenda(end+1) = plotar_ponto([x' y']/UA, "Trajetória T-V", '-');

% Órbita BC: Transferência Venus-Marte
[x,y] = definir_orbita_cartesiana(...
    r_venus_sol, ...
    banco_velocidades_saida(3,:), ...
    mi_sol);
legenda(end+1) = plotar_ponto(([x' y'])/UA, "Trajetória V-M", '-');

disp("Custos: " + deltaV);

grid on;
axis equal
legend(legenda(2:end));
xlabel('x [UA]');
ylabel('y [UA]');

if plot_v == 1
    plotar_vetor(v_terra_sol, (r_terra_sol)/UA, 0.01);
    plotar_vetor(v_venus_sol, (r_venus_sol)/UA, 0.01);
    plotar_vetor(v_marte_sol, (r_marte_sol)/UA, 0.01);
end

if plot_info == 1
    disp("---");
    disp("Referencial na Terra");
    disp("Ângulo saída: " + theta_oe_terra*180/pi);
    disp("Ângulo chegada: " + theta_soi_terra*180/pi);
    
    if venus_swing_by == 1
        disp("---");
        disp("Referencial em Vênus");
        disp("Fase Vênus: " + phase_venus*180/pi);
        disp("Ângulo saída: " + theta_soi_venus*180/pi);
        disp("Ângulo chegada: " + (deflexao_venus + theta_soi_venus)*180/pi);
    end
    
    disp("---");
    disp("Referencial em Marte");
    disp("Fase Marte: " + phase_marte*180/pi);
    disp("Ângulo saída: " + theta_soi_marte*180/pi);
    disp("Ângulo chegada: " + theta_oe_marte*180/pi);
    
    disp("--- Tempos (dias) ---");
    disp("Viagem OE-SOI(Terra): " + t_oe_terra_soi_terra);
    if venus_swing_by == 1
        disp("Viagem SOI(Terra)-SOI(Venus): " + t_soi_terra_soi_venus);
        disp("Viagem swing-by: " + t_soi_venus_soi_venus);
        disp("Viagem SOI(Venus)-SOI(Marte): " + t_soi_venus_soi_marte);
        disp("Viagem SOI(Marte)-OE(Marte): " + t_soi_marte_oe_marte);
        disp("Tempo total de viagem: " + sum(best_global(8:12)));
    else
        disp("Viagem SOI(Terra)-SOI(Marte): " + t_soi_venus_soi_marte);
        disp("Viagem SOI(Marte)-OE(Marte): " + t_soi_marte_oe_marte);
        disp("Tempo total de viagem: " + sum([...
            best_global(9),...
            best_global(11),...
            best_global(12)])...
        );
    end
    
    disp("--- Custos (km/s) ---");
    disp("Saída Terra " + deltaV(1));
    if venus_swing_by == 1
        disp("SOI(Terra) " + deltaV(2));
        disp("Entrada SOI(Venus) " + deltaV(3));
        disp("Saída SOI(Venus) " + deltaV(4));
        disp("SOI(Marte) " + deltaV(5));
        disp("Chegada Marte " + deltaV(6));
    else
        disp("SOI(Terra) " + deltaV(2));
        disp("SOI(Marte) " + deltaV(3));
        disp("Chegada Marte " + deltaV(4));
    end
end

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
