
opts = optimset(...
    'TolFun', 1e-14,...
    'TolX', 1e-14,...
    'MaxFunEvals', 1e4,...
    'MaxIter', 1e4...
);

itr = 0;
while itr < 10
    itr = itr + 1;
    x0 = random_uniform(lower_boundary, upper_boundary);
    x = fminsearch(@custo, x0, opts);

    disp("Iteração: " + itr);
    disp(x);
    disp("Custo: " + custo(x));
    %% Storage
    % Create a table with the data and variable names to store
    data_to_store = [
        custo(x), ...
        x(:)' ...
    ];
    T_to_append = array2table(...
        data_to_store...
    );

    %% Load current existing data

    output_file_name = "results_fminsearch.txt";

    if exist('T_fminsearch','var') == 1
        T_fminsearch = [T_fminsearch; T_to_append];
    elseif exist(output_file_name, 'file') == 2
        T_fminsearch = readtable(output_file_name);
    else
        T_fminsearch = T_to_append;
    end

    %% Write data to text file
    writetable(T_fminsearch, output_file_name);
end