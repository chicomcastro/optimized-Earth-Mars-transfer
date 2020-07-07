function plotar_vetor(vetor, origem, escala)
if nargin < 2
    origem = [0 0 0];
end
if nargin < 3
    escala = 1;
end
hold on;
vetor = vetor/norm(vetor);
ponto1 = origem;
ponto2 = (origem + vetor * escala) ;
plot([ponto1(1) ponto2(1)], [ponto1(2) ponto2(2)]);
hold on;
plot(ponto2(1), ponto2(2), 'd');
grid on;
axis equal;
end