function value = random_uniform(lb, ub)
%random_uniform generates a pseudorandomic value in [lb, ub] range
%   The value is taken from standard uniform distribution (rand())

for i = 1:length(lb)
    value(i) = rand(1)*(ub(i)-lb(i))+lb(i);
end

end


