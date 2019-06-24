% Loads variables
simplePatchedConics;

% Test 1: Vetores a 90 graus
r1 = r_st*[1 0 0]; r2 = r_sm*[0 -1 0];
[V1, V2, extremal_distances, exitflag] = lambert(r1, r2, 9*30, 0, mi_terra)
plotter
hold on

% Test 2: vetores a 45 graus
r1 = r_st*[1 0 0]; r2 = r_sm*[1/2^0.5 -1/2^0.5 0];
[V1, V2, extremal_distances, exitflag] = lambert(r1, r2, 9*30, 0, mi_terra)
plotter

% Test 3: vetores a 180 graus (DÁ RUIM: V = NaN)
%r1 = r_ta*[1 0 0]; r2 = r_tb*[-1 0 0];
%[V1, V2, extremal_distances, exitflag] = lambert(r1, r2, 15, 0, mi_terra)
%plotter

%{
Observações:
- Quando os vetores estão alinhados, a velocidade fica indefinida
- O tempo de voo muda a velocidade, não as características da órbita
- Para m != 0, não há solução
- extremal_distances é sempre a mesma (como se a elipse não mudasse para r1
e r2 se deslocando angularmente em uma circunferência predefinida)
- Nâo encontrei garantia na documentação de que as soluções seriam
elipticas, será que serão?
%}