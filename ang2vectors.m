function theta = ang2vectors(v_a_1,v_a_2)
theta = acos(dot(v_a_1,v_a_2)/norm(v_a_1)/norm(v_a_2));

if theta > pi
    theta = 2*pi - theta;
end
end