
state = [];
best = [];
for i = 1:hyperparams.num_particles
    state(i,:) = particles(i).x;
    best(i,:) = particles(i).best;
end

figure;
plot(state);
title("Estado final");
xlabel("Particula");
ylabel("valor");

figure;
plot(best);
title("Velocidade final");
xlabel("Particula");
ylabel("valor");