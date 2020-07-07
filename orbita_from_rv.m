
function conica = orbita_from_rv(r, v, mi)

energia = norm(v)^2/2 - mi/norm(r);
h = cross(r,v);
theta = angular_coord(r);

a = -mi/(2*energia);
p = norm(h)^2/mi;
e = (1-p/a)^(0.5);
phi = theta - acos((1-a*(1-e^2)/norm(r))/e);

conica = @(nu) p./(1-e*cos(nu-phi));

% fazer r x r x v para analisar phase da orbita (phi = phi + pi)

end

function theta = ang2vectors(v_a_1,v_a_2)
theta = acos(dot(v_a_1,v_a_2)/norm(v_a_1)/norm(v_a_2));
end