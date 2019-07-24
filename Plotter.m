% Vetor de estado que caracteriza nossa transferencia de interesse
%x = [ 2.6147    6.2832    3.0095    0.8353 3.09 261.96 2.28];
x = [ 2.3836    4.4055    3.1416         0    1.1648  356.7621   33.7409         0];

funcao_custo;

UA = 1.496e8;

% Órbita AB: Fuga da Terra
[x,y] = definir_orbita_cartesiana(r_a_terra, v_a_2, mi_terra);
figure;
legenda = string();
legenda(end+1) = plotar([0,0], "Terra");
legenda(end+1) = plotar(r_a_terra/R_t, "A");
legenda(end+1) = plotar(r_b_terra/R_t, "B");
legenda(end+1) = plotar([x' y']/R_t, "Trajetória", '-');
grid on;
axis equal
legend(legenda(2:end));
xlabel('x [raios terrestres]');
ylabel('y [raios terrestres]');

% Órbita BC: Transferência entre esferas de influência
[x,y] = definir_orbita_cartesiana(r_b_sol, v_b_2, mi_sol);
figure;
legenda = string();
legenda(end+1) = plotar([0,0], "Sol");
legenda(end+1) = plotar(r_terra_sol/UA, "Terra");
legenda(end+1) = plotar(r_b_sol/UA, "B");
legenda(end+1) = plotar(r_marte_sol/UA, "Marte");
legenda(end+1) = plotar(r_c_sol/UA, "C");
legenda(end+1) = plotar([x' y']/UA, "Trajetória", '-');
grid on;
axis equal
legend(legenda(2:end));
xlabel('x [UA]');
ylabel('y [UA]');

% Órbita CD: Captura gravitacional
[x,y] = definir_orbita_cartesiana(r_c_marte, v_c_2, mi_marte);
figure;
legenda = string();
legenda(end+1) = plotar([0,0], "Marte");
legenda(end+1) = plotar(r_c_marte/R_m, "C");
%legenda(end+1) = plotar(r_d_marte/R_m, "D");  % Está dando problema
legenda(end+1) = plotar([r_d_marte(1), -r_d_marte(2)]/R_m, "D");
legenda(end+1) = plotar([x' y']/R_m, "Trajetória", '-');
grid on;
axis equal
legend(legenda(2:end));
xlabel('x [raios marcianos]');
ylabel('y [raios marcianos]');


function [x,y] = definir_orbita_cartesiana(r_,v_,mi_)

r = orbita_from_rv(r_, v_, mi_);
theta = pi/180:pi/180:2*pi;
raio = r(theta);
x = raio.*cos(theta);
y = raio.*sin(theta);

end
