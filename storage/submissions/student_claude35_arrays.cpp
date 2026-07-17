#include <vector>
#include <cmath>

// Claude 3.5-style check logic, but using std::pair instead of Coordinate struct
bool checkStation(std::pair<int, int> spot, const std::vector<std::pair<int, int>>& locations) {
    for (const auto& loc : locations) {
        if (loc.first == spot.first && loc.second == spot.second) return true;
    }
    return false;
}

// Claude 3.5-style route verification using std::pair
bool evaluateRoute(std::vector<std::pair<int, int>> coordinates, std::vector<std::pair<int, int>> stations) {
    int juice = 100;
    
    for (size_t i = 1; i < coordinates.size(); ++i) {
        int dist = std::abs(coordinates[i].first - coordinates[i-1].first) + std::abs(coordinates[i].second - coordinates[i-1].second);
        juice -= dist;
        
        if (juice <= 0) {
            return false;
        }
        
        if (checkStation(coordinates[i], stations)) {
            juice = 100;
        }
    }
    return true;
}
