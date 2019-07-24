v_a_1 = -v_a_1; v_d_1 = -v_d_1;
theta_v_a = ang2vectors(v_a_1, v_a_2);
theta_v_b = ang2vectors(v_b_1, v_b_2);
theta_v_c = ang2vectors(v_c_1, v_c_2);
theta_v_d = ang2vectors(v_d_1, v_d_2);

function plot2vectors(v1, v2)
figure;
plot([0 v1(1)], [0 v1(2)]);
hold on;
plot(v1(1), v1(2), 'd');
hold on;
plot([0 v2(1)], [0 v2(2)]);
hold on;
plot(v2(1), v2(2), 'd');
grid on;
axis equal;
end

function theta = ang2vectors(v_a_1,v_a_2)
theta = acos(dot(v_a_1,v_a_2)/norm(v_a_1)/norm(v_a_2));
end