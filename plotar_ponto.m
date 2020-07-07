function value = plotar_ponto(r, legenda, mark_)
if nargin < 3
    mark = 'x';
    lineWidth = 2;
else
    mark = mark_;
    lineWidth = 1;
end
plot(r(:,1),r(:,2), mark, 'LineWidth', lineWidth);
hold on;
value = legenda;
end