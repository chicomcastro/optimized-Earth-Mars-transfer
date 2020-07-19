%% Load current existing data
if exist('venus_swing_by','var') == 0
    venus_swing_by = 1;
end

if venus_swing_by == 1
    data_title = "-swing-by";
else
    data_title = "-direct-transfer";
end
    
output_file_name = "results" + data_title + ".txt";

if exist('T','var') == 1
    disp("Data already loaded");
elseif exist(output_file_name, 'file') == 2
    T = readtable(output_file_name);
else
    T = T_to_append;
end

%% Sorting results by cost
S = sortrows(T, 1);

%%
disp("Custo total: " + table2array(S(1,1)));
loaded_data = table2array(S(1,:));
best_global = loaded_data(2:5);