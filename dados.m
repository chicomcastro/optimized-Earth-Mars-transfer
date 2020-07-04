% Dados
G = 6.67408e-20; %km3 kg-1 s-2
m_terra = 5.972e24; %kg
m_sol = 1.98892e30; %kg
m_marte = 6.39e23; %kg

R_t = 6.371e3; %km
R_m = 3.389e3; %km

r_st = 1.496e8; %km;
r_sm = 2.279e8; %km

% Definições
mi_terra = G*m_terra;
mi_sol = G*m_sol;
mi_marte = G*m_marte;

v = @(mi,r,a) (2*mi*(-1/(2*a)+1/r))^0.5;
soi = @(a, m, M) 0.9431*a*(m/M)^(2/5);
t_voo = @(mi, a) 2*pi*(a^3/mi)^0.5;

% Parâmetros de projeto
h_o = 0.1*R_t; % Altitude da órbita de saída
h_f = 0.3*R_m; % Altitude da orbita de chegada

R_oe_terra = R_t + h_o;
R_soi_terra = soi(r_st, m_terra, m_sol);
R_soi_marte = soi(r_sm, m_marte, m_sol);
R_oe_marte = R_m + h_f;